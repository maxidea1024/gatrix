import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';

// ─── Constants ───

export const OP_COLORS: Record<string, string> = {
  db: '#8b5cf6',
  'db.query': '#8b5cf6',
  http: '#3b82f6',
  'http.client': '#3b82f6',
  'http.server': '#60a5fa',
  cache: '#f59e0b',
  queue: '#ef4444',
  grpc: '#10b981',
  resource: '#6366f1',
  browser: '#ec4899',
  ui: '#f97316',
  navigation: '#14b8a6',
  serialize: '#a855f7',
  middleware: '#06b6d4',
};

export function getOpColor(op: string): string {
  return OP_COLORS[op?.toLowerCase()] || '#6b7280';
}

export function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── SpanVolumeChart ───

export const SpanVolumeChart: React.FC<{
  data: { bucket: string; op: string; count: number }[];
  isDark: boolean;
  onZoom?: (start: string, end: string) => void;
}> = ({ data, isDark, onZoom }) => {
  const { t } = useTranslation();

  const { chartData, buckets } = useMemo(() => {
    if (data.length === 0) return { chartData: [], buckets: [] };
    const bucketMap = new Map<string, number>();
    data.forEach((p) => {
      const count = Number(p.count) || 0;
      bucketMap.set(p.bucket, (bucketMap.get(p.bucket) || 0) + count);
    });
    const sorted = [...bucketMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    const mapped = sorted.map(([b, count]) => {
      const d = new Date(b);
      const label = d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return { label, count };
    });
    return { chartData: mapped, buckets: sorted.map(([b]) => b) };
  }, [data]);

  const handleZoom = (startIndex: number, endIndex: number) => {
    if (onZoom && buckets[startIndex] && buckets[endIndex]) {
      const start =
        buckets[startIndex] < buckets[endIndex]
          ? buckets[startIndex]
          : buckets[endIndex];
      const end =
        buckets[startIndex] < buckets[endIndex]
          ? buckets[endIndex]
          : buckets[startIndex];
      const startDate = new Date(start);
      let endDate = new Date(end);
      if (buckets.length > 1) {
        const gap =
          new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
        endDate = new Date(endDate.getTime() + gap);
      } else {
        endDate = new Date(endDate.getTime() + 3600000);
      }
      onZoom(startDate.toISOString(), endDate.toISOString());
    }
  };

  if (chartData.length === 0)
    return (
      <EmptyPlaceholder
        message={t('argus.traces.noSpanData')}
        minHeight={130}
      />
    );

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        p: 2,
        pt: 1.5,
        borderRadius: 2,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.78rem',
          fontWeight: 700,
          mb: 1,
          color: 'text.secondary',
        }}
      >
        count(spans)
      </Typography>
      <Box sx={{ height: 130 }}>
        <InteractiveTimeSeriesChart
          data={chartData}
          type="bar"
          height={130}
          onZoom={onZoom ? handleZoom : undefined}
        />
      </Box>
    </Paper>
  );
};
