import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  InputBase,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Close as CloseIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusTraceDetail, ArgusTraceSpan } from '@/services/argusService';
import SpanDetailPanel from './SpanDetailDrawer';

export const OP_COLORS: Record<string, string> = {
  'db.query': '#26a69a',
  'db': '#26a69a',
  'http.client': '#7c4dff',
  'http': '#7c4dff',
  'cache.get': '#42a5f5',
  'cache.set': '#42a5f5',
  'cache': '#42a5f5',
  'function': '#ffa726',
  'crypto': '#ef5350',
  'message.publish': '#66bb6a',
  'message': '#66bb6a',
};

export const getOpColor = (op: string) => OP_COLORS[op] || OP_COLORS[op.split('.')[0]] || '#9e9e9e';

/** Format ms duration to human-readable */
const fmtDur = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

/** Grid column definition — fixed operation column + flexible timeline */
const GRID_COLS = '280px 1fr';

// ─── FlatNode type used by both main component and row ───
interface FlatNode {
  span: ArgusTraceSpan;
  depth: number;
  isLastChild: boolean;
  hasChildren: boolean;
  connectors: boolean[];
}

const TraceWaterfall: React.FC<{ trace: ArgusTraceDetail; isDark: boolean }> = ({ trace, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsedSpanIds, setCollapsedSpanIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [focusedSpanIdx, setFocusedSpanIdx] = useState(-1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const headerTimelineRef = useRef<HTMLDivElement>(null);
  const waterfallContainerRef = useRef<HTMLDivElement>(null);
  const root = trace.root;
  const spans = trace.spans || [];

  // Calculate timeline boundaries
  const allTimestamps = [
    root?.start_timestamp,
    root?.timestamp,
    ...spans.map((s) => s.start_timestamp),
    ...spans.map((s) => s.timestamp),
  ].filter(Boolean).map((t) => new Date(t).getTime());

  const timelineStart = Math.min(...allTimestamps);
  const timelineEnd = Math.max(...allTimestamps);
  const totalDuration = timelineEnd - timelineStart || 1;

  // ─── Build flat list (memoized) ───
  const { flatList, getDescendants, toggleCollapse, childrenMap } = useMemo(() => {
    const rootSpanId = root?.span_id;
    const spanMap = new Map<string, ArgusTraceSpan>();
    const childMap = new Map<string, string[]>();
    for (const span of spans) {
      spanMap.set(span.span_id, span);
      if (span.parent_span_id) {
        const ch = childMap.get(span.parent_span_id) || [];
        ch.push(span.span_id);
        childMap.set(span.parent_span_id, ch);
      }
    }
    const getDesc = (spanId: string): Set<string> => {
      const result = new Set<string>();
      for (const childId of (childMap.get(spanId) || [])) {
        result.add(childId);
        for (const desc of getDesc(childId)) result.add(desc);
      }
      return result;
    };
    const hiddenIds = new Set<string>();
    for (const cId of collapsedSpanIds) {
      for (const desc of getDesc(cId)) hiddenIds.add(desc);
    }
    const list: FlatNode[] = [];
    const dfs = (parentId: string, depth: number, connectors: boolean[]) => {
      const childIds = childMap.get(parentId) || [];
      const visIds = childIds.filter(id => !hiddenIds.has(id));
      visIds.forEach((childId, idx) => {
        const span = spanMap.get(childId);
        if (!span) return;
        const isLast = idx === visIds.length - 1;
        const hasChildren = (childMap.get(childId) || []).length > 0;
        list.push({ span, depth, isLastChild: isLast, hasChildren, connectors: [...connectors] });
        if (!collapsedSpanIds.has(childId)) {
          dfs(childId, depth + 1, [...connectors, !isLast]);
        }
      });
    };
    if (rootSpanId) dfs(rootSpanId, 1, []);
    const inTree = new Set(list.map(n => n.span.span_id));
    for (const span of spans) {
      if (!inTree.has(span.span_id) && !hiddenIds.has(span.span_id)) {
        list.push({ span, depth: 1, isLastChild: true, hasChildren: false, connectors: [] });
      }
    }
    return { flatList: list, getDescendants: getDesc, toggleCollapse: undefined, childrenMap: childMap };
  }, [spans, root, collapsedSpanIds]);

  const handleToggleCollapse = useCallback((spanId: string) => {
    setCollapsedSpanIds(prev => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId); else next.add(spanId);
      return next;
    });
  }, []);

  // ─── Search logic ───
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return flatList
      .map((node, idx) => ({ idx, span: node.span }))
      .filter(({ span }) =>
        (span.description || '').toLowerCase().includes(q) ||
        span.op.toLowerCase().includes(q) ||
        span.span_id.toLowerCase().includes(q)
      );
  }, [searchQuery, flatList]);

  const searchMatchSpanIds = useMemo(
    () => new Set(searchMatches.map(m => m.span.span_id)),
    [searchMatches]
  );

  const navigateSearch = useCallback((dir: 1 | -1) => {
    if (searchMatches.length === 0) return;
    setSearchMatchIdx(prev => {
      const next = (prev + dir + searchMatches.length) % searchMatches.length;
      // Scroll the matched row into view
      const matchSpanId = searchMatches[next].span.span_id;
      setTimeout(() => {
        const el = document.getElementById(`span-row-${matchSpanId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return next;
    });
  }, [searchMatches]);

  const activeSearchSpanId = searchMatches[searchMatchIdx]?.span.span_id || null;

  // ─── Zoom ───
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.25 : 0.25;
        setZoomLevel(z => Math.min(5, Math.max(1, z + delta)));
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // ─── Mouse hover for time indicator ───
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const headerEl = headerTimelineRef.current;
    if (headerEl) {
      const headerRect = headerEl.getBoundingClientRect();
      const relX = e.clientX - headerRect.left;
      const pct = relX / headerRect.width;
      if (pct >= 0 && pct <= 1) {
        setHoverTime(pct * totalDuration);
        setHoverX(x);
      } else {
        setHoverX(null);
        setHoverTime(null);
      }
    } else if (x > 280) {
      setHoverX(x);
      setHoverTime(null);
    } else {
      setHoverX(null);
      setHoverTime(null);
    }
  }, [totalDuration]);

  const handleMouseLeave = useCallback(() => {
    setHoverX(null);
    setHoverTime(null);
  }, []);

  const getBarPosition = (startTs: string, dur: number) => {
    const start = new Date(startTs).getTime();
    const left = ((start - timelineStart) / totalDuration) * 100;
    const width = Math.max((dur / totalDuration) * 100, 0.5);
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  // ─── Click vs Double-click disambiguation ───
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpanClick = useCallback((spanId: string) => {
    // Delay single-click to allow double-click to cancel it
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setSelectedSpanId(prev => prev === spanId ? null : spanId);
      clickTimerRef.current = null;
    }, 200);
  }, []);

  // ─── Keyboard navigation ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = waterfallContainerRef.current;
      if (!container) return;
      // Don't capture if focus is on an input
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        // Allow Esc to close search
        if (e.key === 'Escape') {
          setSearchQuery('');
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        setSelectedSpanId(null);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedSpanIdx(prev => {
          const next = Math.min(prev + 1, flatList.length - 1);
          const el = document.getElementById(`span-row-${flatList[next]?.span.span_id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedSpanIdx(prev => {
          const next = Math.max(prev - 1, 0);
          const el = document.getElementById(`span-row-${flatList[next]?.span.span_id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'Enter') {
        if (focusedSpanIdx >= 0 && focusedSpanIdx < flatList.length) {
          handleSpanClick(flatList[focusedSpanIdx].span.span_id);
        }
      }
      // '/' to focus search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = container.querySelector<HTMLInputElement>('[data-search-input]');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flatList, focusedSpanIdx, handleSpanClick]);

  // ─── Double-click zoom ───
  const handleDoubleClick = useCallback((span: ArgusTraceSpan) => {
    // Cancel pending single-click (prevents detail toggle on double-click)
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const dur = Number(span.duration);
    if (dur <= 0) return;
    // Calculate zoom level to make span fill ~60% of timeline width
    const spanPct = dur / totalDuration;
    const targetZoom = Math.min(5, Math.max(1, 0.6 / spanPct));
    setZoomLevel(targetZoom);
    // Reset scroll so operation column stays visible
    setTimeout(() => {
      timelineRef.current?.scrollTo({ left: 0 });
    }, 50);
  }, [totalDuration]);

  const hoverLineColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';

  // Timeline width style for zoom (only affects the timeline grid column)
  const timelineMinWidth = zoomLevel > 1 ? `${zoomLevel * 100}%` : undefined;

  return (
    <Box ref={waterfallContainerRef} tabIndex={0} sx={{ outline: 'none' }}>
      {/* Root transaction header */}
      {root && (
        <Paper elevation={0} sx={{
          p: 2, mb: 2,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography variant="body1" fontWeight={700} sx={{ fontSize: '1rem', lineHeight: 1.3 }}>
                {root.transaction}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                {root.transaction_op}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', textAlign: 'right', flexShrink: 0, ml: 2 }}>
              {t('argus.performance.spanCount', '{{count}} spans', { count: spans.length })} · {root.environment} · {root.release}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={`${Number(root.duration).toLocaleString()}ms`} size="small" sx={{
              fontWeight: 700, fontSize: '0.78rem',
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main, border: 'none',
            }} />
            <Chip
              label={root.transaction_status}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.72rem',
                backgroundColor: alpha(root.transaction_status === 'ok' ? '#4caf50' : '#f44336', 0.12),
                color: root.transaction_status === 'ok' ? '#4caf50' : '#f44336',
                border: 'none',
              }}
            />
            {root.http_status_code > 0 && (
              <Chip label={`HTTP ${root.http_status_code}`} size="small" variant="outlined" sx={{
                fontSize: '0.72rem', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              }} />
            )}
          </Box>
        </Paper>
      )}

      {/* Toolbar: Search + Zoom controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {/* Search within trace */}
        <Box sx={{
          display: 'flex', alignItems: 'center', flex: 1,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: 1, px: 1, height: 32,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}>
          <SearchIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
          <InputBase
            inputProps={{ 'data-search-input': true }}
            placeholder={t('argus.performance.searchSpans', 'Search spans... (press /)')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchMatchIdx(0); }}
            sx={{ flex: 1, fontSize: '0.78rem' }}
            size="small"
          />
          {searchQuery && (
            <>
              <Typography variant="caption" sx={{ mx: 0.5, fontSize: '0.68rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {searchMatches.length > 0 ? `${searchMatchIdx + 1}/${searchMatches.length}` : '0/0'}
              </Typography>
              <IconButton size="small" onClick={() => navigateSearch(-1)} disabled={searchMatches.length === 0} sx={{ p: 0.3 }}>
                <ArrowUpIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" onClick={() => navigateSearch(1)} disabled={searchMatches.length === 0} sx={{ p: 0.3 }}>
                <ArrowDownIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" onClick={() => { setSearchQuery(''); setSearchMatchIdx(0); }} sx={{ p: 0.3 }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </>
          )}
        </Box>
        {/* Zoom controls */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => setZoomLevel(1)} disabled={zoomLevel === 1} title="Reset"><FitScreenIcon sx={{ fontSize: 18 }} /></IconButton>
          <IconButton size="small" onClick={() => setZoomLevel(z => Math.max(1, z - 0.5))} disabled={zoomLevel <= 1} title="Zoom Out"><ZoomOutIcon sx={{ fontSize: 18 }} /></IconButton>
          <IconButton size="small" onClick={() => setZoomLevel(z => Math.min(5, z + 0.5))} disabled={zoomLevel >= 5} title="Zoom In"><ZoomInIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
      </Box>

      {/* Timeline waterfall */}
      <Paper elevation={0} sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <Box sx={{ overflowX: 'auto' }} ref={timelineRef}>
        <Box
          sx={{ position: 'relative' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Hover time indicator line */}
          {hoverX !== null && (
            <Box sx={{
              position: 'absolute',
              left: hoverX,
              top: 0,
              bottom: 0,
              width: '1px',
              backgroundColor: hoverLineColor,
              zIndex: 10,
              pointerEvents: 'none',
            }}>
              {hoverTime !== null && (
                <Box sx={{
                  position: 'absolute',
                  top: 2,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: isDark ? '#2a2a2a' : '#fff',
                  boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.15)',
                  borderRadius: 0.5,
                  px: 0.6, py: 0.15,
                  whiteSpace: 'nowrap',
                  zIndex: 11,
                }}>
                  <Typography variant="caption" sx={{
                    fontSize: '0.6rem', fontWeight: 600, color: theme.palette.text.primary,
                  }}>
                    {fmtDur(hoverTime)}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Header row */}
          <Box sx={{
            display: 'flex', minWidth: 'max-content',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <Typography variant="caption" fontWeight={600} sx={{
              px: 1.5, py: 0.8,
              width: 280, flexShrink: 0,
              position: 'sticky', left: 0, zIndex: 2,
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
              borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              {t('argus.performance.operation', 'Operation')}
            </Typography>
            <Box ref={headerTimelineRef} sx={{
              display: 'flex', justifyContent: 'space-between', px: 1.5, py: 0.8,
              position: 'relative', flex: 1,
              minWidth: timelineMinWidth,
            }}>
              <Typography variant="caption" color="text.secondary">0ms</Typography>
              <Typography variant="caption" color="text.secondary">{fmtDur(totalDuration / 2)}</Typography>
              <Typography variant="caption" color="text.secondary">{fmtDur(totalDuration)}</Typography>
            </Box>
          </Box>

          {/* Root transaction bar */}
          {root && (
            <WaterfallRow
              label={root.transaction}
              sublabel={root.transaction_op}
              op="http.server"
              duration={Number(root.duration)}
              barPos={getBarPosition(root.start_timestamp, Number(root.duration))}
              status={root.transaction_status}
              isRoot
              isDark={isDark}
              timelineMinWidth={timelineMinWidth}
            />
          )}

          {/* Span bars with inline detail */}
          {flatList.map((node, idx) => {
            const { span, depth, isLastChild, hasChildren, connectors } = node;
            const isCollapsed = collapsedSpanIds.has(span.span_id);
            const hiddenChildCount = isCollapsed ? getDescendants(span.span_id).size : 0;
            const isSelected = selectedSpanId === span.span_id;
            const isFocused = focusedSpanIdx === idx;
            const isSearchMatch = searchMatchSpanIds.has(span.span_id);
            const isActiveMatch = activeSearchSpanId === span.span_id;
            return (
              <React.Fragment key={span.span_id || idx}>
                <WaterfallRow
                  id={`span-row-${span.span_id}`}
                  label={span.description || span.op}
                  sublabel={span.op}
                  op={span.op}
                  duration={Number(span.duration)}
                  barPos={getBarPosition(span.start_timestamp, Number(span.duration))}
                  status={span.status}
                  isDark={isDark}
                  depth={depth}
                  onClick={() => handleSpanClick(span.span_id)}
                  onDoubleClick={() => handleDoubleClick(span)}
                  isSelected={isSelected}
                  isFocused={isFocused}
                  isSearchMatch={isSearchMatch}
                  isActiveMatch={isActiveMatch}
                  hasChildren={hasChildren}
                  isCollapsed={isCollapsed}
                  hiddenChildCount={hiddenChildCount}
                  onToggle={() => handleToggleCollapse(span.span_id)}
                  isLastChild={isLastChild}
                  treeConnectors={connectors}
                  timelineMinWidth={timelineMinWidth}
                  zoomLevel={zoomLevel}
                />
                {/* Inline span detail */}
                {isSelected && (
                  <Box
                    onMouseEnter={() => { setHoverX(null); setHoverTime(null); }}
                    onMouseMove={(e) => e.stopPropagation()}
                    sx={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                    backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
                    position: 'relative',
                    zIndex: 12,
                  }}>
                    <SpanDetailPanel
                      span={span}
                      onClose={() => setSelectedSpanId(null)}
                      isDark={isDark}
                      totalDuration={totalDuration}
                      allSpans={spans}
                      inline
                    />
                  </Box>
                )}
              </React.Fragment>
            );
          })}

          {spans.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">{t('argus.performance.noTraceSpans', 'No spans found for this trace.')}</Typography>
            </Box>
          )}
        </Box>
        </Box>
      </Paper>

      {/* Keyboard shortcut hint */}
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.disabled', fontSize: '0.65rem', textAlign: 'right' }}>
        ↑↓ {t('argus.performance.navigate', 'navigate')} · Enter {t('argus.performance.select', 'select')} · Esc {t('argus.performance.close', 'close')} · / {t('argus.performance.search', 'search')} · {t('argus.performance.dblClickZoom', 'double-click to zoom')}
      </Typography>
    </Box>
  );
};

// ─── WaterfallRow ───
const WaterfallRow: React.FC<{
  id?: string;
  label: string;
  sublabel: string;
  op: string;
  duration: number;
  barPos: { left: string; width: string };
  status: string;
  isRoot?: boolean;
  isDark: boolean;
  depth?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
  isSelected?: boolean;
  isFocused?: boolean;
  isSearchMatch?: boolean;
  isActiveMatch?: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  hiddenChildCount?: number;
  onToggle?: () => void;
  isLastChild?: boolean;
  treeConnectors?: boolean[];
  timelineMinWidth?: string;
  zoomLevel?: number;
}> = ({ id, label, sublabel, op, duration, barPos, status, isRoot, isDark, depth = 0, onClick, onDoubleClick, isSelected, isFocused, isSearchMatch, isActiveMatch, hasChildren, isCollapsed, hiddenChildCount = 0, onToggle, isLastChild, treeConnectors = [], timelineMinWidth, zoomLevel = 1 }) => {
  const theme = useTheme();
  const opColor = getOpColor(op);
  const isErr = status !== 'ok' && status !== '';
  const lineColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';

  // Determine row background
  let rowBg: string | undefined;
  if (isSelected) rowBg = alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04);
  else if (isActiveMatch) rowBg = alpha(theme.palette.warning.main, isDark ? 0.15 : 0.1);
  else if (isSearchMatch) rowBg = alpha(theme.palette.warning.main, isDark ? 0.06 : 0.04);

  return (
      <Box
        id={id}
        onClick={onClick}
        onDoubleClick={(e) => { e.preventDefault(); onDoubleClick?.(); }}
        sx={{
        display: 'flex', minWidth: 'max-content',
        borderBottom: isSelected ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}`,
        '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
        transition: 'background 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: rowBg,
        ...(isFocused && !isSelected && {
          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.04 : 0.02),
        }),
      }}>
        {/* Operation cell */}
          <Box sx={{
            display: 'flex', alignItems: 'center', height: 32, overflow: 'hidden',
            width: 280, flexShrink: 0,
            position: 'sticky', left: 0, zIndex: 1,
            backgroundColor: isSelected
              ? (isDark ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04))
              : isFocused
              ? (isDark ? alpha(theme.palette.primary.main, 0.04) : alpha(theme.palette.primary.main, 0.02))
              : isActiveMatch
              ? (isDark ? alpha(theme.palette.warning.main, 0.15) : alpha(theme.palette.warning.main, 0.1))
              : (isDark ? '#1a1a1a' : '#fff'),
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            {/* SVG tree lines */}
            {!isRoot && (() => {
              const SLOT = 20;
              const BASE = 10;
              const svgW = BASE + (treeConnectors.length + 1) * SLOT;
              const MID = 16;
              return (
                <svg width={svgW} height={32} style={{ flexShrink: 0, display: 'block' }}>
                  {treeConnectors.map((show, i) => show ? (
                    <line key={i}
                      x1={BASE + i * SLOT + SLOT / 2} y1={0}
                      x2={BASE + i * SLOT + SLOT / 2} y2={32}
                      stroke={lineColor} strokeWidth={1}
                    />
                  ) : null)}
                  <line
                    x1={BASE + treeConnectors.length * SLOT + SLOT / 2}
                    y1={0}
                    x2={BASE + treeConnectors.length * SLOT + SLOT / 2}
                    y2={isLastChild ? MID : 32}
                    stroke={lineColor} strokeWidth={1}
                  />
                  <line
                    x1={BASE + treeConnectors.length * SLOT + SLOT / 2}
                    y1={MID}
                    x2={svgW}
                    y2={MID}
                    stroke={lineColor} strokeWidth={1}
                  />
                </svg>
              );
            })()}
            {isRoot && <Box sx={{ width: 12, flexShrink: 0 }} />}
            {/* Toggle */}
            {hasChildren && !isRoot ? (
              <Box
                onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                sx={{
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                  cursor: 'pointer', width: 16, justifyContent: 'center',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
                  '&:hover': { color: theme.palette.primary.main },
                  transition: 'color 0.15s',
                }}
              >
                {isCollapsed
                  ? <ChevronRightIcon sx={{ fontSize: 14 }} />
                  : <ExpandMoreIcon sx={{ fontSize: 14 }} />
                }
              </Box>
            ) : (
              <Box sx={{ width: isRoot ? 0 : 6, flexShrink: 0 }} />
            )}
            {/* Op chip */}
            <Box sx={{ width: 80, display: 'flex', justifyContent: 'center', flexShrink: 0, ml: 0.3 }}>
              <Chip label={op} size="small" sx={{
                height: 18, fontSize: '0.6rem', fontWeight: 600,
                backgroundColor: alpha(opColor, isDark ? 0.15 : 0.08), color: opColor,
                border: 'none', borderRadius: 0.8, maxWidth: '100%',
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              }} />
            </Box>
            {/* Error icon */}
            {isErr && (
              <ErrorIcon sx={{ fontSize: 14, color: '#f44336', ml: 0.3, flexShrink: 0 }} />
            )}
            {/* Label */}
            <Typography variant="caption" noWrap sx={{
              fontSize: '0.73rem', ml: 0.5,
              fontWeight: isRoot ? 700 : 400,
              color: isErr ? '#f44336' : (isDark ? '#ccc' : '#333'),
              flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {label}
            </Typography>
            {isCollapsed && hiddenChildCount > 0 && (
              <Chip
                label={`+${hiddenChildCount}`}
                size="small"
                sx={{
                  height: 16, fontSize: '0.58rem', fontWeight: 600, ml: 0.5, flexShrink: 0,
                  backgroundColor: alpha(theme.palette.text.secondary, 0.1),
                  color: theme.palette.text.secondary,
                }}
              />
            )}
          </Box>

        {/* Timeline bar cell */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', px: 1, flex: 1, minWidth: timelineMinWidth }}>
          {[25, 50, 75].map(pct => (
            <Box key={pct} sx={{
              position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, width: '1px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            }} />
          ))}
          <Box sx={{
            position: 'absolute',
            left: barPos.left,
            width: barPos.width,
            height: isRoot ? 20 : 16,
            borderRadius: 0,
            backgroundColor: isErr ? alpha('#f44336', 0.7) : alpha(opColor, 0.7),
            borderTop: `1px solid ${isErr ? alpha('#f44336', 0.9) : alpha(opColor, 0.9)}`,
            borderBottom: `1px solid ${isErr ? alpha('#f44336', 0.5) : alpha(opColor, 0.5)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 2,
            transition: 'all 0.2s',
            overflow: 'hidden',
          }}>
            {parseFloat(barPos.width) * zoomLevel > 8 && (
              <Typography variant="caption" noWrap sx={{
                fontSize: '0.6rem', fontWeight: 600, color: '#fff',
                textShadow: '0 0 3px rgba(0,0,0,0.5)',
                px: 0.3,
              }}>
                {fmtDur(duration)}
              </Typography>
            )}
          </Box>
          {parseFloat(barPos.width) * zoomLevel <= 8 && (
            <Typography variant="caption" sx={{
              position: 'absolute',
              left: `calc(${barPos.left} + ${barPos.width} + 6px)`,
              fontSize: '0.62rem', fontWeight: 600, color: isDark ? '#888' : '#777',
              whiteSpace: 'nowrap',
            }}>
              {fmtDur(duration)}
            </Typography>
          )}
        </Box>
      </Box>
  );
};

export default TraceWaterfall;
