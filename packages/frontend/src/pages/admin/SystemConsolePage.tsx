import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Menu, MenuItem, alpha } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSSENotifications } from '@/hooks/useSSENotifications';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { useTheme } from '@mui/material/styles';
interface LogEntry { id: number; html: React.ReactNode; }
interface StoredLine { kind: 'prompt' | 'output'; text: string; }

// Minimal ANSI color parser (supports 31-36 + reset)
const parseAnsiToReact = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let currentStyle: React.CSSProperties = {};
  const pushText = (t: string) => { if (t) parts.push(<span style={currentStyle} key={parts.length}>{t}</span>); };

  while (i < text.length) {
    if (text.charCodeAt(i) === 27 /* ESC */ && text[i+1] === '[') {
      const mIndex = text.indexOf('m', i);
      if (mIndex === -1) { pushText(text.slice(i)); break; }
      const codeStr = text.slice(i + 2, mIndex);
      const code = parseInt(codeStr, 10);
      i = mIndex + 1;
      if (code === 0) { currentStyle = {}; continue; }
      const colorMap: Record<number, string> = { 30:'#000000',31:'#ef4444',32:'#22c55e',33:'#eab308',34:'#3b82f6',35:'#a855f7',36:'#06b6d4',37:'#e5e7eb' } as any;
      if (colorMap[code]) { currentStyle = { ...currentStyle, color: colorMap[code] }; }
    } else {
      const nextEsc = text.indexOf('\u001b[', i);
      if (nextEsc === -1) { pushText(text.slice(i)); break; }
      pushText(text.slice(i, nextEsc));
      i = nextEsc;
    }
  }
  return <>{parts}</>;
};

const splitCommand = (line: string): { command: string; args: string[] } => {
  const tokens: string[] = [];
  let cur = '';
  let inQuote: string | null = null;
  for (let ch of line.trim()) {
    if ((ch === '"' || ch === "'") && !inQuote) { inQuote = ch; continue; }
    if (inQuote && ch === inQuote) { inQuote = null; continue; }
    if (!inQuote && ch === ' ') { if (cur) { tokens.push(cur); cur=''; } continue; }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  const [command, ...args] = tokens;
  return { command: command || '', args };
};


const SystemConsolePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const nextId = useRef(1);
  const outputRef = useRef<HTMLDivElement>(null);

  const theme = useTheme();

  const prompt = useMemo(() => '', [user]);
  // xterm.js integration
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputBufRef = useRef<string>('');
  const historyRef = useRef<string[]>([]);
  // Simple tab-completion candidates (sync with backend commands)
  const completionsRef = useRef<string[]>([
    'help','clear','whoami','sysinfo','env','uuid','base64','health','date','time','timezone','uptime'
  ]);

  const historyIndexRef = useRef<number>(-1);

  const cursorRef = useRef<number>(0);

  const redrawLine = (term: Terminal) => {
    term.write('\u001b[2K\r');
    writePrompt(term);
    const buf = inputBufRef.current;
    term.write(buf);
    const moves = buf.length - cursorRef.current;
    if (moves > 0) term.write(`\u001b[${moves}D`);
  };

  // Context menu (copy/paste)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [canCopy, setCanCopy] = useState(false);
  const [canPaste, setCanPaste] = useState(false);

  const handleContextMenu: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const sel = termRef.current?.getSelection() || '';
    setCanCopy(!!sel);
    setCtxMenu({ x: e.clientX, y: e.clientY });
    // Try to read clipboard text (user gesture)
    navigator.clipboard.readText()
      .then((txt) => setCanPaste(!!txt))
      .catch(() => setCanPaste(false));
  };
  const handleCopy = async () => {
    try {
      const sel = termRef.current?.getSelection();
      if (sel) await navigator.clipboard.writeText(sel);
    } catch {}
    setCtxMenu(null);
  };
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (termRef.current && text) {
        const before = inputBufRef.current.slice(0, cursorRef.current);
        const after = inputBufRef.current.slice(cursorRef.current);
        inputBufRef.current = before + text + after;
        cursorRef.current += text.length;
        redrawLine(termRef.current);
      }
    } catch {}
    setCtxMenu(null);
  };

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  const getPromptAnsi = useCallback(() => {
    const username = (user?.name || user?.email || 'user').split('@')[0];
    const host = (typeof window !== 'undefined' ? window.location.hostname : 'host');
    return `\u001b[32m${username}@${host}\u001b[0m:\u001b[34m~\u001b[0m % `;
  }, [user]);

  const writePrompt = (term: Terminal) => {
    term.write(getPromptAnsi());
  };

  const pushRaw = (text: string, writeToTerm = false) => {
    if (writeToTerm && termRef.current) termRef.current.write(text);
    try {
      const saved = localStorage.getItem('console:raw:v2');
      const arr: string[] = saved ? JSON.parse(saved) : [];
      const MAX = 1000;
      arr.push(text);
      localStorage.setItem('console:raw:v2', JSON.stringify(arr.slice(-MAX)));
    } catch {}
  };

  const replaceBufferWith = (text: string) => {
    inputBufRef.current = text;
    if (termRef.current) {
      termRef.current.write('\u001b[2K\r');
      writePrompt(termRef.current);
      termRef.current.write(text);
    }
  };

  // Initialize xterm
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      // Prefer CJK-friendly monospace fonts first
      fontFamily: 'D2Coding, "NanumGothicCoding", "Source Han Mono", "Noto Sans Mono CJK KR", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: (theme.palette.background?.paper as any) || '#000000',
        foreground: (theme.palette.text?.primary as any) || '#d1d5db',
        cursor: (theme.palette.text?.secondary as any) || '#9ca3af',
      },
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    if (containerRef.current) {
      term.open(containerRef.current);
      try { fit.fit(); } catch {}
      term.focus();
    }

    termRef.current = term;
    fitRef.current = fit;

    // Restore previous session
    try {
      const saved = localStorage.getItem('console:raw:v2');
      if (saved) {
        const arr: string[] = JSON.parse(saved);
        for (const s of arr) term.write(s);
      }
    } catch {}

    writePrompt(term);

    const onResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', onResize);

    term.onData((data) => {
      // Enter
      if (data === '\r') {
        const line = inputBufRef.current.trim();
        term.write('\r\n');
        if (!line) {
          writePrompt(term);
        } else if (line === 'clear') {
          term.clear();
          try { localStorage.removeItem('console:raw:v2'); } catch {}
          writePrompt(term);
        } else {
          // history update
          const next = [...historyRef.current, line];
          setHistory(next);
          setHistoryIndex(-1);
          try { localStorage.setItem('console:history:v1', JSON.stringify(next.slice(-200))); } catch {}

          // persist prompt+command only
          pushRaw(`${getPromptAnsi()}${line}\r\n`, false);

          // execute backend
          const { command, args } = splitCommand(line);
          const token = localStorage.getItem('accessToken');
          fetch('/api/v1/admin/console/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
            credentials: 'include',
            body: JSON.stringify({ command, args })
          }).then(async (res) => {
            if (!res.ok) {
              const json = await res.json().catch(() => null);
              const msg = json?.message || res.statusText || 'Unknown error';
              const errLine = `${t('console.backendError')}${msg}`;
              term.write(errLine.replace(/\n/g, '\r\n') + '\r\n');
              pushRaw(errLine + '\r\n', false);
              const cannot = t('console.cannotExecute');
              term.write(cannot + '\r\n');
              pushRaw(cannot + '\r\n', false);
              writePrompt(term);
            }
          }).catch(() => {
            const errLine = `${t('console.backendError')}${t('common.error')}`;
            term.write(errLine + '\r\n'); pushRaw(errLine + '\r\n', false);
            const cannot = t('console.cannotExecute');
            term.write(cannot + '\r\n'); pushRaw(cannot + '\r\n', false);
            writePrompt(term);
          });
        }
        inputBufRef.current = '';
        cursorRef.current = 0;
        return;
      }

      // Backspace
      if (data === '\u007f') {
        if (cursorRef.current > 0) {
          const i = cursorRef.current;
          const before = inputBufRef.current.slice(0, i - 1);
          const after = inputBufRef.current.slice(i);
          inputBufRef.current = before + after;
          cursorRef.current = i - 1;
          // Incremental backspace: move left, print tail, add space to clear last char, move cursor back over tail
          term.write('\b');
          if (after) {
            term.write(after + ' ');
            term.write(`\u001b[${after.length + 1}D`);
          } else {
            term.write(' \b');
          }
        }
        return;
      }

      // Arrow Up/Down: history
      if (data === '\u001b[A') {
        const h = historyRef.current;
        if (h.length) {
          const idx = historyIndexRef.current === -1 ? h.length - 1 : Math.max(0, historyIndexRef.current - 1);
          historyIndexRef.current = idx;
          setHistoryIndex(idx);
          inputBufRef.current = h[idx] || '';
          cursorRef.current = inputBufRef.current.length;
          redrawLine(term);
        }
        return;
      }
      if (data === '\u001b[B') {
        const h = historyRef.current;
        if (h.length) {
          const next = historyIndexRef.current + 1;
          if (historyIndexRef.current === -1) return;
          if (next >= h.length) {
            historyIndexRef.current = -1;
            setHistoryIndex(-1);
            inputBufRef.current = '';
            cursorRef.current = 0;
            redrawLine(term);
          } else {
            historyIndexRef.current = next;
            setHistoryIndex(next);
            inputBufRef.current = h[next] || '';
            cursorRef.current = inputBufRef.current.length;
            redrawLine(term);
          }
        }
        return;
      }

      // Arrow Left/Right
      if (data === '\u001b[D') { // Left
        if (cursorRef.current > 0) { cursorRef.current -= 1; term.write('\u001b[D'); }
        return;
      }
      if (data === '\u001b[C') { // Right
        if (cursorRef.current < inputBufRef.current.length) { cursorRef.current += 1; term.write('\u001b[C'); }
        return;
      }

      // Tab completion
      if (data === '\t') {
        const buf = inputBufRef.current;
        const cur = cursorRef.current;
        const start = buf.lastIndexOf(' ', Math.max(0, cur - 1)) + 1;
        const prefix = buf.slice(start, cur);
        const cand = completionsRef.current.filter(c => c.startsWith(prefix));
        if (cand.length === 1) {
          const rest = cand[0].slice(prefix.length);
          inputBufRef.current = buf.slice(0, cur) + rest + buf.slice(cur);
          cursorRef.current = cur + rest.length;
          // Echo minimal
          const after = buf.slice(cur);
          if (after) { term.write(rest + after); term.write(`\u001b[${after.length}D`); }
          else { term.write(rest); }
        } else if (cand.length > 1) {
          term.write('\r\n' + cand.join('  ') + '\r\n');
          redrawLine(term);
        } else {
          // Bell
          term.write('\u0007');
        }
        return;
      }

      // Home
      if (data === '\u001b[H') {
        if (cursorRef.current > 0) term.write(`\u001b[${cursorRef.current}D`);
        cursorRef.current = 0;
        return;
      }
      // End
      if (data === '\u001b[F') {
        const moves = inputBufRef.current.length - cursorRef.current;
        if (moves > 0) term.write(`\u001b[${moves}C`);
        cursorRef.current = inputBufRef.current.length;
        return;
      }
      // Delete key (ESC [3~)
      if (data === '\u001b[3~') {
        const i = cursorRef.current;
        if (i < inputBufRef.current.length) {
          const before = inputBufRef.current.slice(0, i);
          const after = inputBufRef.current.slice(i + 1);
          inputBufRef.current = before + after;
          // Overwrite from cursor with tail and blank, then move back
          if (after) {
            term.write(after + ' ');
            term.write(`\u001b[${after.length + 1}D`);
          } else {
            term.write(' ');
            term.write('\u001b[D');
          }
        }
        return;
      }

      // Printable chunk (may contain multiple chars)
      const printable = data.replace(/[\x00-\x1F\x7F]/g, '');
      if (printable) {
        const before = inputBufRef.current.slice(0, cursorRef.current);
        const after = inputBufRef.current.slice(cursorRef.current);
        inputBufRef.current = before + printable + after;
        cursorRef.current += printable.length;
        if (after) {
          // Insert in middle: print inserted + tail then move cursor back over tail
          term.write(printable + after);
          term.write(`\u001b[${after.length}D`);
        } else {
          // Append at end: just echo
          term.write(printable);
        }
      }
    });

    return () => {
      window.removeEventListener('resize', onResize);
      term.dispose();
    };
  }, [getPromptAnsi]);



  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs]);
  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);


  // Load persisted logs and history
  // Apply MUI theme to xterm when theme changes
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    // xterm v5+: setOption removed; use options/theme instead. Guard until opened.
    if (!term.element) return;
    term.options = {
      ...term.options,
      theme: {
        background: (theme.palette.background?.paper as any) || '#000000',
        foreground: (theme.palette.text?.primary as any) || '#d1d5db',
        cursor: (theme.palette.text?.secondary as any) || '#9ca3af',
      } as any,
    } as any;
  }, [theme]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('console:lines:v1');
      if (saved) {
        const items: StoredLine[] = JSON.parse(saved);
        const restored: LogEntry[] = items.map((it, idx) => {
          if (it.kind === 'prompt') {
            return { id: idx + 1, html: (<div><span style={{ color: '#9ca3af' }}>{prompt} </span><span>{it.text}</span></div>) };
          }
          return { id: idx + 1, html: (<div>{parseAnsiToReact(it.text)}</div>) };
        });
        setLogs(restored);
        nextId.current = restored.length + 1;
      }
      const savedHistory = localStorage.getItem('console:history:v1');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch {}
  }, [prompt]);

  const appendLog = useCallback((html: React.ReactNode) => {
    setLogs(prev => [...prev, { id: nextId.current++, html }]);
  }, []);

  const persistLines = (lines: StoredLine[]) => {
    try {
      const MAX = 500;
      localStorage.setItem('console:lines:v1', JSON.stringify(lines.slice(-MAX)));
    } catch {}
  };

  const appendPromptLine = (text: string) => {
    appendLog(<div><span style={{ color: '#9ca3af' }}>{prompt} </span><span>{text}</span></div>);
    try {
      const saved = localStorage.getItem('console:lines:v1');
      const arr: StoredLine[] = saved ? JSON.parse(saved) : [];
      arr.push({ kind: 'prompt', text });
      persistLines(arr);
    } catch {}
  };

  const appendOutputAnsi = (text: string) => {
    appendLog(<div>{parseAnsiToReact(text)}</div>);

    try {
      const saved = localStorage.getItem('console:lines:v1');
      const arr: StoredLine[] = saved ? JSON.parse(saved) : [];
      arr.push({ kind: 'output', text });
      persistLines(arr);
    } catch {}
  };

  const inputRef = useRef<HTMLDivElement | null>(null);

  const setInputContent = (text: string) => {
    if (inputRef.current) {
      inputRef.current.innerText = text;

      setInput(text);
      const sel = window.getSelection();
      if (sel && inputRef.current.firstChild) {
        sel.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(inputRef.current);
        range.collapse(false);
        sel.addRange(range);
      }
    }
  };

  const handleExecute = useCallback(async () => {
    const line = input.trim();
    if (!line) return;
  // Focus input on page enter
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);


    // show the entered line with prompt and persist
    appendPromptLine(line);

    // history update + persist
    setHistory((prev) => {

      const next = [...prev, line];
      try { localStorage.setItem('console:history:v1', JSON.stringify(next.slice(-200))); } catch {}
      return next;
    });
    setHistoryIndex(-1);

    setInput('');
    if (inputRef.current) inputRef.current.innerText = '';

    const { command, args } = splitCommand(line);
    try {
      const token = localStorage.getItem('accessToken');
      const resp = await fetch('/api/v1/admin/console/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ command, args })
      });
      const data = await resp.json();
      if (!data?.success) {
        appendLog(<div style={{ color: '#ef4444' }}>{t('common.error')}: {data?.message || 'Unknown error'}</div>);
      } else {
        // Do not append HTTP output here to avoid duplicates; rely on SSE broadcast
      }
    } catch (e: any) {
      appendLog(<div style={{ color: '#ef4444' }}>{t('common.error')}: {e?.message || 'Network error'}</div>);
    }
  }, [appendLog, input, prompt, t]);

  const onInputKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const current = (inputRef.current?.innerText || '').replace(/\r/g, '');
      const trimmed = current.trim();
      if (!trimmed) {
        // just line feed
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const br = document.createTextNode('\n');
        range.insertNode(br);
        range.setStartAfter(br);
        range.setEndAfter(br);
        sel.removeAllRanges();
        sel.addRange(range);
        setInput((inputRef.current?.innerText || '').replace(/\r/g, ''));
      } else {
        handleExecute();
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInputContent(history[newIndex] || '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!history.length) return;
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setInputContent('');
      } else {
        setHistoryIndex(newIndex);
        setInputContent(history[newIndex] || '');
      }
      return;
    }
  };

  // SSE listen for console_output events
  useSSENotifications({
    autoConnect: true,
    onEvent: (evt) => {
      if (evt.type === 'console_output') {
        const raw = String(evt.data?.output ?? '');
        const normalized = raw.replace(/\r?\n/g, '\r\n');
        if (termRef.current) {
          termRef.current.write(normalized + '\r\n');
          // persist output only (already written to term)
          pushRaw(normalized + '\r\n', false);
          // show next prompt
          termRef.current.write(getPromptAnsi());
        }
      }
    }
  });

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }} onKeyDown={(e) => {
      // [ ignore default browser find etc.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') e.preventDefault();
    }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>{t('console.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('console.subtitle')}</Typography>
      <Box sx={(th) => ({ flex: 1, bgcolor: th.palette.background.paper, color: th.palette.text.primary, borderRadius: 1, p: 1, minHeight: 0,
        fontFamily: 'D2Coding, "NanumGothicCoding", "Source Han Mono", "Noto Sans Mono CJK KR", Menlo, Monaco, "Courier New", monospace',
        '& .xterm-viewport::-webkit-scrollbar': { width: '8px' },
        '& .xterm-viewport::-webkit-scrollbar-track': {
          background: th.palette.mode === 'dark' ? alpha(th.palette.common.black, 0.35) : 'transparent'
        },
        '& .xterm-viewport::-webkit-scrollbar-thumb': { background: alpha(th.palette.text.primary, 0.2), borderRadius: '4px' },
        '& .xterm-viewport::-webkit-scrollbar-thumb:hover': { background: alpha(th.palette.text.primary, 0.3) },
        '& .xterm-viewport::-webkit-scrollbar-thumb:active': { background: alpha(th.palette.text.primary, 0.4) },
        '& .xterm-viewport': { scrollbarWidth: 'thin', scrollbarColor: `${alpha(th.palette.text.primary, 0.3)} ${th.palette.mode === 'dark' ? alpha(th.palette.common.black, 0.35) : 'transparent'}` },
      })}>
        <div ref={containerRef as any} onContextMenu={handleContextMenu} style={{ width: '100%', height: '100%' }} />
      </Box>

      <Menu
        open={!!ctxMenu}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}
      >
        <MenuItem onClick={handleCopy} disabled={!canCopy}>{t('common.copy')}</MenuItem>
        <MenuItem onClick={handlePaste} disabled={!canPaste}>{t('common.paste')}</MenuItem>
      </Menu>
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('console.hint')}: echo --green "Hello World" | help | date | time | timezone | uptime
        </Typography>
      </Box>
    </Box>
  );
};

export default SystemConsolePage;

