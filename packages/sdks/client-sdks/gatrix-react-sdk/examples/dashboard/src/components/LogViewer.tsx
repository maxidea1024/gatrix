import { useState, useEffect, useRef, useCallback } from 'react';

export interface LogEntry {
    id: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: Date;
    args: any[];
}

interface LogViewerProps {
    logs: LogEntry[];
    onClose: () => void;
    onClear: () => void;
}

function getLevelColor(level: string): string {
    switch (level) {
        case 'debug': return '#adafbc';
        case 'info': return '#209cee';
        case 'warn': return '#f7d51d';
        case 'error': return '#e76e55';
        default: return '#fff';
    }
}

function getLevelIcon(level: string): string {
    switch (level) {
        case 'debug': return '⚙';
        case 'info': return 'ℹ';
        case 'warn': return '⚠';
        case 'error': return '✕';
        default: return '•';
    }
}

function formatTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
}

function formatArgs(args: any[]): string {
    if (!args || args.length === 0) return '';
    return args.map((a) => {
        try {
            if (typeof a === 'object') return JSON.stringify(a);
            return String(a);
        } catch { return String(a); }
    }).join(' ');
}

const LEVELS = ['all', 'debug', 'info', 'warn', 'error'] as const;

export default function LogViewer({ logs, onClose, onClear }: LogViewerProps) {
    const [filterLevel, setFilterLevel] = useState<'all' | 'debug' | 'info' | 'warn' | 'error'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [panelWidth, setPanelWidth] = useState(() =>
        parseInt(localStorage.getItem('gatrix-log-panel-width') || '420', 10),
    );
    const [isResizing, setIsResizing] = useState(false);
    const logListRef = useRef<HTMLDivElement>(null);

    const filteredLogs = logs.filter((l) => {
        if (filterLevel !== 'all' && l.level !== filterLevel) return false;
        if (searchQuery) return l.message.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
    });

    const countByLevel = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const log of logs) countByLevel[log.level]++;

    // Auto-scroll
    useEffect(() => {
        const el = logListRef.current;
        if (!el || !autoScroll) return;

        // Check if we are close to the bottom (within 50px)
        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;

        if (isAtBottom) {
            el.scrollTop = el.scrollHeight;
        }
    }, [logs.length, autoScroll]);

    // Resize
    const onResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = panelWidth;

        const onMouseMove = (ev: MouseEvent) => {
            const delta = startX - ev.clientX;
            const newWidth = Math.max(280, Math.min(window.innerWidth * 0.7, startWidth + delta));
            setPanelWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsResizing(false);
            setPanelWidth((w) => {
                localStorage.setItem('gatrix-log-panel-width', String(Math.round(w)));
                return w;
            });
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [panelWidth]);

    return (
        <div className="log-panel" style={{ width: `${panelWidth}px` }}>
            {/* Resize handle */}
            <div
                className={`log-panel-resize-handle ${isResizing ? 'resizing' : ''}`}
                onMouseDown={onResizeStart}
            />

            {/* Header */}
            <div className="log-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#92cc41', fontSize: '10px' }}>SDK LOGS</span>
                    <span style={{ fontSize: '7px', color: '#adafbc' }}>
                        ({filteredLogs.length}/{logs.length})
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <label className="log-panel-autoscroll">
                        <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                        <span>AUTO</span>
                    </label>
                    <button type="button" className="nes-btn is-warning" onClick={onClear}
                        style={{ fontSize: '7px', padding: '2px 6px' }}>CLR</button>
                    <button type="button" className="nes-btn is-error" onClick={onClose}
                        style={{ fontSize: '7px', padding: '2px 6px' }}>✕</button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="log-panel-toolbar">
                {LEVELS.map((level) => (
                    <button
                        key={level}
                        type="button"
                        className={`log-filter-btn ${filterLevel === level ? 'active' : ''}`}
                        style={{ color: level === 'all' ? '#fff' : getLevelColor(level) }}
                        onClick={() => setFilterLevel(level)}
                    >
                        {level === 'all' ? 'ALL' : level.toUpperCase()}
                        <span className="log-filter-count">
                            {level === 'all' ? logs.length : countByLevel[level]}
                        </span>
                    </button>
                ))}
                <div style={{ flex: 1 }} />
                <input
                    type="text" className="nes-input is-dark log-panel-search"
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter..."
                />
            </div>

            {/* Log list */}
            <div ref={logListRef} className="log-panel-list">
                {filteredLogs.length === 0 ? (
                    <div className="log-panel-empty">
                        {logs.length === 0 ? 'NO LOGS YET...' : 'NO MATCHING LOGS'}
                    </div>
                ) : (
                    filteredLogs.map((entry) => (
                        <div key={entry.id} className={`log-entry log-entry-${entry.level}`}>
                            <span className="log-entry-time">{formatTime(entry.timestamp)}</span>
                            <span className="log-entry-icon" style={{ color: getLevelColor(entry.level) }}>
                                {getLevelIcon(entry.level)}
                            </span>
                            <span className="log-entry-msg" style={{ color: getLevelColor(entry.level) }}>
                                {entry.message}
                                {entry.args.length > 0 && (
                                    <span className="log-entry-args"> {formatArgs(entry.args)}</span>
                                )}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
