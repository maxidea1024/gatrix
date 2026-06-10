import React, { useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';

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
}> = ({ data, onZoom }) => {
  const { t } = useTranslation();

  const { sortedBuckets, chartLabels, chartDatasets } = useMemo(() => {
    if (data.length === 0)
      return {
        sortedBuckets: [] as string[],
        chartLabels: [] as string[],
        chartDatasets: [],
      };

    const bucketMap = new Map<string, number>();
    data.forEach((p) => {
      const count = Number(p.count) || 0;
      bucketMap.set(p.bucket, (bucketMap.get(p.bucket) || 0) + count);
    });
    const sorted = [...bucketMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    const labels = sorted.map(([b]) => {
      const d = new Date(b);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    });

    const datasets = [
      {
        label: 'count(spans)',
        data: sorted.map(([, c]) => c),
        type: 'bar' as const,
        color: '#7c4dff',
      },
    ];

    return {
      sortedBuckets: sorted.map(([b]) => b),
      chartLabels: labels,
      chartDatasets: datasets,
    };
  }, [data]);

  const handleZoom = useCallback(
    (startIdx: number, endIdx: number) => {
      if (!onZoom) return;
      const si = Math.min(startIdx, endIdx);
      const ei = Math.max(startIdx, endIdx);
      if (sortedBuckets[si] && sortedBuckets[ei]) {
        const startDate = new Date(sortedBuckets[si]);
        let endDate = new Date(sortedBuckets[ei]);
        if (sortedBuckets.length > 1) {
          const gap =
            new Date(sortedBuckets[1]).getTime() -
            new Date(sortedBuckets[0]).getTime();
          endDate = new Date(endDate.getTime() + gap);
        } else {
          endDate = new Date(endDate.getTime() + 3600000);
        }
        onZoom(startDate.toISOString(), endDate.toISOString());
      }
    },
    [onZoom, sortedBuckets]
  );

  return (
    <ArgusVolumeChart
      datasets={chartDatasets}
      labels={chartLabels}
      emptyMessage={t('argus.traces.noSpanData')}
      title="count(spans)"
      onZoom={onZoom ? handleZoom : undefined}
      storagePrefix="argus_span_volume"
      showChartTypeToggle={false}
      showCompactToggle={false}
    />
  );
};
