import React, { useMemo } from 'react';
import { Box, Typography, Paper, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

export interface VolumePoint {
  bucket: string;
  level: string;
  count: number;
}

export interface LogVolumeChartProps {
  data: VolumePoint[];
  isDark: boolean;
  period: string;
  onZoom?: (start: string, end: string) => void;
  isDragging?: boolean;
}

/**
 * Severity-level color mapping for stacked bar chart.
 * Each severity level gets a distinct, recognizable color.
 */
const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  critical: '#d32f2f',
  error: '#f44336',
  warn: '#ff9800',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
  trace: '#607d8b',
};

/** Canonical ordering so legend is consistent */
const SEVERITY_ORDER = [
  'fatal',
  'critical',
  'error',
  'warn',
  'warning',
  'info',
  'debug',
  'trace',
];

function getSeverityColor(level: string): string {
  return SEVERITY_COLORS[level?.toLowerCase()] || '#6b7280';
}

const LogVolumeChart = React.memo<LogVolumeChartProps>(
  ({ data, isDark, period, onZoom, isDragging }) => {
    const { t, i18n } = useTranslation();

    const { chartConfig, buckets } = useMemo(() => {
      if (data.length === 0)
        return { chartConfig: null, buckets: [] as string[] };

      // 1. Collect all unique buckets (sorted chronologically) and levels
      const bucketSet = new Set<string>();
      const levelSet = new Set<string>();
      data.forEach((p) => {
        bucketSet.add(p.bucket);
        levelSet.add(p.level?.toLowerCase() || 'unknown');
      });
      const sortedBuckets = [...bucketSet].sort();

      // Sort levels by canonical severity order, unknowns go to the end
      const levels = [...levelSet].sort((a, b) => {
        const ai = SEVERITY_ORDER.indexOf(a);
        const bi = SEVERITY_ORDER.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      // 2. Build a lookup: Map<bucket, Map<level, count>>
      const lookup = new Map<string, Map<string, number>>();
      data.forEach((p) => {
        const bkt = p.bucket;
        const lvl = p.level?.toLowerCase() || 'unknown';
        if (!lookup.has(bkt)) lookup.set(bkt, new Map());
        const lvlMap = lookup.get(bkt)!;
        lvlMap.set(lvl, (lvlMap.get(lvl) || 0) + (Number(p.count) || 0));
      });

      // 3. Build Chart.js labels
      const labels = sortedBuckets.map((b) => {
        const d = new Date(b);
        return d.toLocaleString(i18n.language || 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      });

      // Deduplicate levels that map to the same color (warn/warning)
      const deduped: { level: string; color: string }[] = [];
      const seenColors = new Set<string>();
      levels.forEach((lvl) => {
        const color = getSeverityColor(lvl);
        const displayKey = `${color}`;
        if (!seenColors.has(displayKey)) {
          seenColors.add(displayKey);
          deduped.push({ level: lvl, color });
        }
      });

      // 4. Build datasets (one per severity level)
      const datasets = deduped.map(({ level, color }) => ({
        label: level.charAt(0).toUpperCase() + level.slice(1),
        data: sortedBuckets.map((bkt) => {
          const lvlMap = lookup.get(bkt);
          if (!lvlMap) return 0;
          // Merge warn + warning
          if (level === 'warn' || level === 'warning') {
            return (lvlMap.get('warn') || 0) + (lvlMap.get('warning') || 0);
          }
          return lvlMap.get(level) || 0;
        }),
        backgroundColor: alpha(color, 0.75),
        hoverBackgroundColor: color,
        borderRadius: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.92,
      }));

      return { chartConfig: { labels, datasets }, buckets: sortedBuckets };
    }, [data, i18n.language]);

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

    if (isDragging) {
      return (
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            p: 2,
            height: 172,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', fontWeight: 600 }}>
            {t('argus.logs.chartResizing', 'Adjusting chart size...')}
          </Typography>
        </Paper>
      );
    }

    if (!chartConfig)
      return (
        <Box sx={{ mb: 2 }}>
          <EmptyPlaceholder
            message={t('argus.logs.noLogData')}
            minHeight={130}
          />
        </Box>
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
          count(logs)
        </Typography>
        <Box sx={{ height: 140 }}>
          <Bar
            data={chartConfig}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 300 },
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: {
                  display: true,
                  position: 'top',
                  align: 'end',
                  labels: {
                    boxWidth: 10,
                    boxHeight: 10,
                    font: { size: 10, weight: 'bold' as const },
                    padding: 8,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                  },
                },
                tooltip: {
                  enabled: true,
                  callbacks: {
                    title: (items) => items[0]?.label || '',
                    label: (item) =>
                      `${item.dataset.label}: ${Number(item.raw).toLocaleString()}`,
                  },
                },
              },
              scales: {
                x: {
                  stacked: true,
                  grid: { display: false },
                  ticks: {
                    font: { size: 9 },
                    color: isDark ? '#555' : '#bbb',
                    maxTicksLimit: 10,
                  },
                  border: { display: false },
                },
                y: {
                  stacked: true,
                  grid: {
                    color: isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.04)',
                  },
                  ticks: {
                    font: { size: 9 },
                    color: isDark ? '#555' : '#bbb',
                  },
                  border: { display: false },
                  beginAtZero: true,
                },
              },
              onClick: (_event, elements, chart) => {
                if (!onZoom || elements.length === 0) return;
                const idx = elements[0].index;
                // Zoom to single bucket
                handleZoom(idx, idx);
              },
            }}
          />
        </Box>
      </Paper>
    );
  }
);

export default LogVolumeChart;
