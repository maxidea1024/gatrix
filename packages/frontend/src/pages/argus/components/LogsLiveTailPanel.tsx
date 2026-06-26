import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Button,
  Paper,
  useTheme,
  GlobalStyles,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Search as SearchIcon,
  FiberManualRecord as DotIcon,
  Highlight as HighlightIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useTranslation } from 'react-i18next';
import SafeTooltip from '@/components/common/SafeTooltip';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import argusService, { ArgusLogEntry } from '@/services/argusService';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { formatCompactNumber } from '@/utils/numberFormat';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

export interface LogsLiveTailPanelProps {
  projectId: string;
  searchDebounce?: string;
  isDark: boolean;
  onSelectLog?: (log: ArgusLogEntry) => void;
  selectedLogId?: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  error: ARGUS_SEMANTIC.negative,
  warn: ARGUS_SEMANTIC.warning,
  warning: ARGUS_SEMANTIC.warning,
  info: ARGUS_SEMANTIC.info,
  debug: '#9e9e9e',
  trace: '#607d8b',
};

/** Fixed column layout matching LogsTablePanel */
const COLUMNS = [
  { key: 'timestamp', label: 'TIMESTAMP', flex: 1.3, minWidth: 165 },
  { key: 'severity', label: 'SEVERITY', flex: 0.6, minWidth: 70 },
  { key: 'service', label: 'SERVICE', flex: 0.8, minWidth: 90 },
  { key: 'message', label: 'MESSAGE', flex: 3, minWidth: 200 },
];

/** Maximum number of logs to keep in the live tail buffer */
const MAX_LOGS = 2000;

/** Duration (ms) for the new-log highlight animation */
const HIGHLIGHT_DURATION = 1500;

/** Interval (ms) for flushing buffered logs to state — throttles renders */
const FLUSH_INTERVAL = 200;

/** Generate CSS @keyframes for each severity level */
const HIGHLIGHT_ALPHA = 0.1;
const HIGHLIGHT_KEYFRAMES = Object.entries(SEVERITY_COLORS)
  .map(
    ([level, color]) => `
@keyframes liveTailHighlight-${level} {
  0% { background-color: ${color}${Math.round(HIGHLIGHT_ALPHA * 255)
    .toString(16)
    .padStart(2, '0')}; }
  100% { background-color: transparent; }
}`
  )
  .join('\n');

/* ──────────────────────── Static styles (avoid per-row sx) ──────────────────────── */
const ROW_STYLE_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 12px',
  cursor: 'pointer',
};

const DOT_CONTAINER_STYLE: React.CSSProperties = {
  width: 44,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
};

const TS_STYLE: React.CSSProperties = {
  fontSize: '0.73rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const LEVEL_STYLE_BASE: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
};

const SERVICE_STYLE: React.CSSProperties = {
  fontSize: '0.72rem',
  overflow: 'hidden',
};

const MSG_STYLE: React.CSSProperties = {
  fontSize: '0.73rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/* ──────────────────────── Memoized row component ──────────────────────── */

interface LogRowProps {
  log: ArgusLogEntry;
  isSelected: boolean;
  isNew: boolean;
  isDark: boolean;
  borderColor: string;
  primaryColor: string;
  onSelect?: (log: ArgusLogEntry) => void;
  formatTimestamp: (ts: string) => string;
}

const LogRow = React.memo<LogRowProps>(
  ({
    log,
    isSelected,
    isNew,
    isDark,
    borderColor,
    primaryColor,
    onSelect,
    formatTimestamp,
  }) => {
    const levelColor = SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e';

    const rowStyle: React.CSSProperties = {
      ...ROW_STYLE_BASE,
      borderBottom: `1px solid ${borderColor}`,
      backgroundColor: isSelected
        ? isDark
          ? 'rgba(33,150,243,0.08)'
          : 'rgba(33,150,243,0.06)'
        : undefined,
      animation: isNew
        ? `liveTailHighlight-${log.level?.toLowerCase() || 'info'} ${HIGHLIGHT_DURATION}ms ease-out`
        : undefined,
      borderLeft: isSelected ? `2px solid ${primaryColor}` : undefined,
    };

    return (
      <div style={rowStyle} onClick={() => onSelect?.(log)} className="lt-row">
        <div style={DOT_CONTAINER_STYLE}>
          <DotIcon style={{ fontSize: 8, color: levelColor }} />
        </div>

        <div style={{ flex: 1.3, minWidth: 165, overflow: 'hidden' }}>
          <span
            style={{
              ...TS_STYLE,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            }}
          >
            {formatTimestamp(log.timestamp)}
          </span>
        </div>

        <div style={{ flex: 0.6, minWidth: 70, overflow: 'hidden' }}>
          <span style={{ ...LEVEL_STYLE_BASE, color: levelColor }}>
            {log.level?.toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 0.8, minWidth: 90, overflow: 'hidden' }}>
          <span
            style={{
              ...SERVICE_STYLE,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            }}
          >
            {log.service || '—'}
          </span>
        </div>

        <div style={{ flex: 3, minWidth: 200, overflow: 'hidden' }}>
          <span style={MSG_STYLE}>{log.message || log.body}</span>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.log.log_id === next.log.log_id &&
    prev.isSelected === next.isSelected &&
    prev.isNew === next.isNew &&
    prev.isDark === next.isDark
);
LogRow.displayName = 'LogRow';

/* ──────────────────────── Main component ──────────────────────── */

const LogsLiveTailPanel: React.FC<LogsLiveTailPanelProps> = ({
  projectId,
  searchDebounce,
  isDark,
  onSelectLog,
  selectedLogId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [liveTailLogs, setLiveTailLogs] = useState<ArgusLogEntry[]>([]);
  const [liveTailActive, setLiveTailActive] = useState(false);
  const [liveTailPaused, setLiveTailPaused] = useState(false);
  const [liveTailCount, setLiveTailCount] = useState(0);
  const liveTailRef = useRef<EventSource | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [highlightEnabled, setHighlightEnabled] = useLocalStorage(
    'argus_liveTail_highlight',
    true
  );

  // ── State for tracking scroll and missed logs (Datadog style) ──
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newLogsCount, setNewLogsCount] = useState(0);
  const isAtBottomRef = useRef(true);
  const autoPausedRef = useRef(false);

  // ── Refs for closure-safe access in SSE callback ──
  const liveTailPausedRef = useRef(false);
  const pendingLogsRef = useRef<ArgusLogEntry[]>([]);
  const pausedBufferRef = useRef<ArgusLogEntry[]>([]);
  const newLogIdsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Derived stable values
  const borderColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const primaryColor = theme.palette.primary.main;

  // ── Stable formatTimestamp (no deps) ──
  const formatTimestamp = useCallback((ts: string) => {
    try {
      const formatted =
        formatDateTimeDetailed(ts) +
        '.' +
        String(new Date(ts + 'Z').getMilliseconds()).padStart(3, '0');
      return formatted;
    } catch {
      return ts;
    }
  }, []);

  // ── Flush pending logs from buffer → state (throttled) ──
  const startFlushTimer = useCallback(() => {
    if (flushTimerRef.current) return; // already running
    flushTimerRef.current = setInterval(() => {
      if (pendingLogsRef.current.length === 0) return;

      const batch = pendingLogsRef.current.splice(0);

      // Track highlight IDs
      batch.forEach((l) => newLogIdsRef.current.add(l.log_id));
      const timer = setTimeout(() => {
        batch.forEach((l) => newLogIdsRef.current.delete(l.log_id));
      }, HIGHLIGHT_DURATION);
      highlightTimersRef.current.push(timer);

      if (!liveTailPausedRef.current) {
        setLiveTailLogs((prev) => [...prev, ...batch].slice(-MAX_LOGS));
        if (!isAtBottomRef.current) {
          setNewLogsCount((c) => c + batch.length);
        }
      } else {
        pausedBufferRef.current.push(...batch);
        if (pausedBufferRef.current.length > MAX_LOGS) {
          pausedBufferRef.current = pausedBufferRef.current.slice(-MAX_LOGS);
        }
      }
    }, FLUSH_INTERVAL);
  }, []);

  const stopFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  // ── Start / Stop live tail ──
  const stopLiveTail = useCallback(() => {
    if (liveTailRef.current) {
      liveTailRef.current.close();
      liveTailRef.current = null;
    }
    stopFlushTimer();
    setLiveTailActive(false);
    autoPausedRef.current = false;
  }, [stopFlushTimer]);

  const startLiveTail = useCallback(() => {
    if (liveTailRef.current) liveTailRef.current.close();
    stopFlushTimer();
    pendingLogsRef.current = [];
    pausedBufferRef.current = [];

    setLiveTailLogs([]);
    setLiveTailCount(0);
    setLiveTailPaused(false);
    liveTailPausedRef.current = false;
    autoPausedRef.current = false;
    setLiveTailActive(true);

    const es = argusService.createLiveTailConnection(
      projectId,
      { search: searchDebounce || undefined },
      (newLogs) => {
        setLiveTailCount((prev) => prev + newLogs.length);
        // Push into pending buffer — flushed on interval
        pendingLogsRef.current.push(...newLogs);
      },
      () => {
        /* SSE error — will auto-reconnect */
      }
    );
    liveTailRef.current = es;
    startFlushTimer();
  }, [projectId, searchDebounce, stopFlushTimer, startFlushTimer]);

  // ── Pause toggle (sync ref) ──
  const togglePause = useCallback(() => {
    autoPausedRef.current = false;
    setLiveTailPaused((prev) => {
      const next = !prev;
      liveTailPausedRef.current = next;
      if (!next) {
        // Resuming — flush paused buffer
        if (pausedBufferRef.current.length > 0) {
          setLiveTailLogs((logs) =>
            [...logs, ...pausedBufferRef.current].slice(-MAX_LOGS)
          );
          pausedBufferRef.current = [];
        }
      }
      return next;
    });
  }, []);

  // ── Auto-pause / resume based on selectedLogId ──
  useEffect(() => {
    if (selectedLogId && liveTailActive && !liveTailPausedRef.current) {
      setLiveTailPaused(true);
      liveTailPausedRef.current = true;
      autoPausedRef.current = true;
    } else if (
      !selectedLogId &&
      liveTailActive &&
      liveTailPausedRef.current &&
      autoPausedRef.current
    ) {
      setLiveTailPaused(false);
      liveTailPausedRef.current = false;
      autoPausedRef.current = false;
      if (pausedBufferRef.current.length > 0) {
        setLiveTailLogs((logs) =>
          [...logs, ...pausedBufferRef.current].slice(-MAX_LOGS)
        );
        pausedBufferRef.current = [];
      }
    }
  }, [selectedLogId, liveTailActive]);

  // ── Auto-restart stream when project or filter query changes ──
  useEffect(() => {
    if (liveTailActive) {
      startLiveTail();
    } else {
      setLiveTailLogs([]);
      setLiveTailCount(0);
      setNewLogsCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, searchDebounce]);

  // ── Virtuoso scroll event and helper handlers ──
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setNewLogsCount(0);
    }
  }, []);

  const handleScrollToBottom = useCallback(() => {
    if (liveTailLogs.length > 0) {
      virtuosoRef.current?.scrollToIndex({
        index: liveTailLogs.length - 1,
        align: 'end',
        behavior: 'smooth',
      });
    }
    setNewLogsCount(0);
  }, [liveTailLogs.length]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (liveTailRef.current) liveTailRef.current.close();
      stopFlushTimer();
      highlightTimersRef.current.forEach((t) => clearTimeout(t));
      highlightTimersRef.current = [];
    };
  }, [stopFlushTimer]);

  // ── Row renderer for Virtuoso ──
  const renderRow = useCallback(
    (index: number, log: ArgusLogEntry) => {
      const isSelected = selectedLogId === log.log_id;
      const isNew = highlightEnabled && newLogIdsRef.current.has(log.log_id);
      return (
        <LogRow
          log={log}
          isSelected={isSelected}
          isNew={isNew}
          isDark={isDark}
          borderColor={borderColor}
          primaryColor={primaryColor}
          onSelect={onSelectLog}
          formatTimestamp={formatTimestamp}
        />
      );
    },
    [
      selectedLogId,
      highlightEnabled,
      isDark,
      borderColor,
      primaryColor,
      onSelectLog,
      formatTimestamp,
    ]
  );

  return (
    <Box
      sx={{
        px: 1,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 300,
      }}
    >
      <GlobalStyles styles={HIGHLIGHT_KEYFRAMES} />
      {/* When not active and no logs: centered empty state with start button */}
      {!liveTailActive && liveTailLogs.length === 0 ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <SearchIcon
            sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }}
          />
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              sx={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'text.secondary',
                mb: 0.5,
              }}
            >
              {t('argus.logs.liveTail.noLogs', '아직 수신된 로그가 없습니다')}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.disabled',
              }}
            >
              {t(
                'argus.logs.liveTail.noLogsDesc',
                '스트리밍을 시작하면 새로운 로그가 여기에 표시됩니다.'
              )}
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="success"
            onClick={startLiveTail}
            startIcon={<PlayArrowIcon sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: '8px',
              px: 3,
              py: 0.8,
              mt: 1,
            }}
          >
            {t('argus.logs.liveTail.start', 'Start Streaming')}
          </Button>
        </Box>
      ) : (
        <>
          {/* Active controls toolbar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1,
              flexShrink: 0,
            }}
          >
            {liveTailActive ? (
              <Button
                variant="contained"
                size="small"
                color="error"
                onClick={stopLiveTail}
                startIcon={<StopIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
              >
                {t('argus.logs.liveTail.stop', 'Stop Streaming')}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={startLiveTail}
                startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
              >
                {t('argus.logs.liveTail.start', 'Start Streaming')}
              </Button>
            )}
            {liveTailActive && (
              <Button
                variant="outlined"
                size="small"
                onClick={togglePause}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  borderRadius: '6px',
                }}
              >
                {liveTailPaused
                  ? t('argus.logs.liveTail.resume', 'Resume')
                  : t('argus.logs.liveTail.pause', 'Pause')}
              </Button>
            )}
            {liveTailLogs.length > 0 && (
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setLiveTailLogs([]);
                  setLiveTailCount(0);
                  setNewLogsCount(0);
                  setIsAtBottom(true);
                  isAtBottomRef.current = true;
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                }}
              >
                {t('argus.logs.liveTail.clear', 'Clear Logs')}
              </Button>
            )}
            <SafeTooltip
              title={t('argus.logs.liveTail.highlightNew', 'Highlight New')}
            >
              <IconButton
                size="small"
                onClick={() => setHighlightEnabled((v) => !v)}
                color={highlightEnabled ? 'primary' : 'default'}
                sx={{ p: 0.4 }}
              >
                <HighlightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </SafeTooltip>
            <Box sx={{ flex: 1 }} />
            {liveTailActive && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: liveTailPaused ? ARGUS_SEMANTIC.warning : ARGUS_SEMANTIC.positive,
                    animation: liveTailPaused ? 'none' : 'pulse 1.5s infinite',
                    '@keyframes pulse': {
                      '0%,100%': { opacity: 1 },
                      '50%': { opacity: 0.4 },
                    },
                  }}
                />
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    color: 'text.secondary',
                    fontWeight: 600,
                  }}
                >
                  {liveTailPaused
                    ? t('argus.logs.liveTail.paused', 'Paused')
                    : t('argus.logs.liveTail.streaming', 'Streaming...')}
                </Typography>
                <Chip
                  size="small"
                  label={t(
                    'argus.logs.liveTail.received',
                    '{{count}} received',
                    {
                      count: formatCompactNumber(liveTailCount) as any,
                    }
                  )}
                  sx={{ height: 20, fontSize: '0.65rem', ml: 0.5 }}
                />
              </Box>
            )}
          </Box>

          {/* Log table */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
          >
            {/* Column headers — matches LogsTablePanel */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1.5,
                py: 0.8,
                flexShrink: 0,
                borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.015)',
              }}
            >
              <Box sx={{ width: 44 }} />
              {COLUMNS.map((col) => (
                <Box
                  key={col.key}
                  sx={{
                    flex: col.flex,
                    minWidth: col.minWidth,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.3,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'text.disabled',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {col.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Virtualized log rows */}
            <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {liveTailLogs.length === 0 && liveTailActive ? (
                <EmptyPlaceholder
                  variant="text"
                  icon={<SearchIcon sx={{ fontSize: 48 }} />}
                  message={t(
                    'argus.logs.liveTail.waiting',
                    '로그를 수신 대기 중입니다...'
                  )}
                  sx={{ flex: 1, height: '100%' }}
                />
              ) : (
                <>
                  <Virtuoso
                    ref={virtuosoRef}
                    data={liveTailLogs}
                    itemContent={renderRow}
                    style={{ height: '100%' }}
                    overscan={50}
                    defaultItemHeight={33}
                    initialTopMostItemIndex={
                      liveTailLogs.length > 0
                        ? liveTailLogs.length - 1
                        : undefined
                    }
                    atBottomStateChange={handleAtBottomStateChange}
                    followOutput={isAtBottom ? 'auto' : false}
                  />
                  {newLogsCount > 0 && !isAtBottom && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleScrollToBottom}
                      startIcon={<ArrowDownIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        position: 'absolute',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        textTransform: 'none',
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        borderRadius: '20px',
                        boxShadow: 3,
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        '&:hover': {
                          backgroundColor: theme.palette.primary.dark,
                        },
                      }}
                    >
                      {t('argus.logs.liveTail.newLogs', '{{count}} new logs', {
                        count: newLogsCount,
                      })}
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default LogsLiveTailPanel;
