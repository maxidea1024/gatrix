import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusTraceDetail } from '@/services/argusService';

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

const TraceWaterfall: React.FC<{ trace: ArgusTraceDetail; isDark: boolean }> = ({ trace, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
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

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > 280) { // 280px is the width of the left operation column
      setHoverX(x);
    } else {
      setHoverX(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverX(null);
  }, []);

  const getBarPosition = (startTs: string, dur: number) => {
    const start = new Date(startTs).getTime();
    const left = ((start - timelineStart) / totalDuration) * 100;
    const width = Math.max((dur / totalDuration) * 100, 0.5);
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  return (
    <Box>
      {/* Root transaction header */}
      {root && (
        <Paper elevation={0} sx={{
          p: 2, mb: 2,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}>
          <Box>
            <Typography variant="body1" fontWeight={700}>{root.transaction}</Typography>
            <Typography variant="caption" color="text.secondary">{root.transaction_op}</Typography>
          </Box>
          <Chip label={`${Number(root.duration).toLocaleString()}ms`} size="small" sx={{ fontWeight: 700 }} />
          <Chip
            label={root.transaction_status}
            size="small"
            sx={{
              fontWeight: 600,
              backgroundColor: alpha(root.transaction_status === 'ok' ? '#4caf50' : '#f44336', 0.12),
              color: root.transaction_status === 'ok' ? '#4caf50' : '#f44336',
              border: 'none',
            }}
          />
          {root.http_status_code > 0 && (
            <Chip label={`HTTP ${root.http_status_code}`} size="small" variant="outlined" sx={{ fontSize: '0.72rem' }} />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {spans.length} spans · {root.environment} · {root.release}
          </Typography>
        </Paper>
      )}

      {/* Zoom controls */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
        <IconButton size="small" onClick={() => setZoomLevel(1)} disabled={zoomLevel === 1} title="Reset Size"><FitScreenIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={() => setZoomLevel(z => Math.max(1, z - 0.5))} disabled={zoomLevel <= 1} title="Zoom Out"><ZoomOutIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={() => setZoomLevel(z => Math.min(5, z + 0.5))} disabled={zoomLevel >= 5} title="Zoom In"><ZoomInIcon fontSize="small" /></IconButton>
      </Box>

      {/* Timeline header */}
      <Paper elevation={0} sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2, overflowX: 'auto',
      }}>
        <Box 
          sx={{ minWidth: `${100 + (zoomLevel - 1) * 100}%`, position: 'relative' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {hoverX !== null && (
            <Box sx={{
              position: 'absolute',
              left: hoverX,
              top: 0,
              bottom: 0,
              width: '1px',
              backgroundColor: '#f44336',
              zIndex: 10,
              pointerEvents: 'none',
              opacity: 0.7,
            }} />
          )}
          <Box sx={{
            display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <Typography variant="caption" fontWeight={600} sx={{
              px: 1.5, py: 0.8,
              position: 'sticky', left: 0, zIndex: 2,
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
              borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              {t('argus.performance.operation', 'Operation')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 0.8 }}>
              <Typography variant="caption" color="text.secondary">0ms</Typography>
              <Typography variant="caption" color="text.secondary">{(totalDuration / 2).toFixed(0)}ms</Typography>
              <Typography variant="caption" color="text.secondary">{totalDuration.toFixed(0)}ms</Typography>
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
          />
        )}

        {/* Span bars */}
        {(() => {
          const rootSpanId = root?.span_id;
          const depthMap = new Map<string, number>();
          if (rootSpanId) depthMap.set(rootSpanId, 0);
          for (let pass = 0; pass < 5; pass++) {
            for (const span of spans) {
              if (depthMap.has(span.span_id)) continue;
              if (span.parent_span_id && depthMap.has(span.parent_span_id)) {
                depthMap.set(span.span_id, (depthMap.get(span.parent_span_id) || 0) + 1);
              }
            }
          }
          return spans.map((span, idx) => {
            const depth = depthMap.get(span.span_id) ?? 1;
            return (
              <WaterfallRow
                key={span.span_id || idx}
                label={span.description || span.op}
                sublabel={span.op}
                op={span.op}
                duration={Number(span.duration)}
                barPos={getBarPosition(span.start_timestamp, Number(span.duration))}
                status={span.status}
                isDark={isDark}
                depth={depth}
                data={typeof span.data === 'object' ? span.data : undefined}
              />
            );
          });
        })()}

        {spans.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('argus.performance.noTraceSpans', 'No spans found for this trace.')}</Typography>
          </Box>
        )}
        </Box>
      </Paper>
    </Box>
  );
};

const WaterfallRow: React.FC<{
  label: string;
  sublabel: string;
  op: string;
  duration: number;
  barPos: { left: string; width: string };
  status: string;
  isRoot?: boolean;
  isDark: boolean;
  depth?: number;
  data?: Record<string, string>;
}> = ({ label, sublabel, op, duration, barPos, status, isRoot, isDark, depth = 0, data }) => {
  const { t } = useTranslation();
  const opColor = getOpColor(op);
  const isErr = status !== 'ok' && status !== '';

  return (
      <Box sx={{
        display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}`,
        '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        transition: 'background 0.1s',
      }}>
        <Tooltip
          title={
            <Box sx={{ fontSize: '0.75rem' }}>
              <Box><strong>{op}</strong>: {label}</Box>
              <Box>{t('argus.performance.duration', 'Duration')}: {duration}ms</Box>
              <Box>{t('argus.performance.status', 'Status')}: {status}</Box>
              {data && Object.entries(data).slice(0, 3).map(([k, v]) => (
                <Box key={k}>{k}: {v}</Box>
              ))}
            </Box>
          }
          placement="right"
          arrow
        >
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.6, overflow: 'hidden', cursor: 'default',
            position: 'sticky', left: 0, zIndex: 1,
            backgroundColor: isDark ? '#1a1a1a' : '#fff',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <Box sx={{ width: isRoot ? 0 : 12 + depth * 16, flexShrink: 0 }} />
            {!isRoot && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.3, flexShrink: 0 }}>
                <Box sx={{ width: 8, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />
              </Box>
            )}
            <Box sx={{ width: 56, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <Chip label={op.split('.')[0]} size="small" sx={{
                height: 18, fontSize: '0.6rem', fontWeight: 600,
                backgroundColor: alpha(opColor, isDark ? 0.15 : 0.08), color: opColor,
                border: 'none', borderRadius: 0.8, width: '100%',
              }} />
            </Box>
            <Typography variant="caption" noWrap sx={{
              fontFamily: 'monospace', fontSize: '0.73rem', ml: 0.5,
              fontWeight: isRoot ? 700 : 400,
              color: isErr ? '#f44336' : (isDark ? '#ccc' : '#333'),
            }}>
              {label}
            </Typography>
          </Box>
        </Tooltip>

        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', px: 1 }}>
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
            borderRadius: 1,
            backgroundColor: isErr ? alpha('#f44336', 0.7) : alpha(opColor, 0.7),
            border: `1px solid ${isErr ? '#f44336' : opColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 2,
            transition: 'all 0.2s',
          }}>
            {duration > totalDuration(barPos) * 0.15 && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#fff', textShadow: '0 0 2px rgba(0,0,0,0.3)' }}>
                {duration}ms
              </Typography>
            )}
          </Box>
          {duration <= totalDuration(barPos) * 0.15 && (
            <Typography variant="caption" sx={{
              position: 'absolute',
              left: `calc(${barPos.left} + ${barPos.width} + 4px)`,
              fontSize: '0.62rem', fontWeight: 600, color: isDark ? '#777' : '#999',
            }}>
              {duration}ms
            </Typography>
          )}
        </Box>
      </Box>
  );
};

function totalDuration(barPos: { width: string }): number {
  return parseFloat(barPos.width) || 100;
}

export default TraceWaterfall;
