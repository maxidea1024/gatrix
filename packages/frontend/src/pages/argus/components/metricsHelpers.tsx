import React from 'react';
import { Box, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import InteractiveTimeSeriesChart, {
  ChartDataset,
} from '@/components/argus/InteractiveTimeSeriesChart';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { formatDuration } from '@/utils/dateFormat';
import { formatCompactNumber } from '@/utils/numberFormat';

// ─── Types ───

export type MetricQuery = {
  id: string; // 'a', 'b', etc.
  metric: string;
  agg: string;
  groupBy: string; // comma-separated for multiple: "environment,region"
  filter: string; // filter conditions: "environment=production,region=us-east-1"
  isHidden: boolean;
};

export type EquationQuery = {
  id: string; // 'f1', 'f2', etc.
  equation: string;
  isHidden: boolean;
};

export type ChartConfig = {
  type:
    | 'line'
    | 'bar'
    | 'area'
    | 'stacked-bar'
    | 'stacked-area'
    | 'stacked-line'
    | 'pie'
    | 'doughnut'
    | 'scatter';
  yAxisType: 'linear' | 'logarithmic';
  showLegend: boolean;
};

export type GroupByOption = {
  key: string;
  source: 'column' | 'tag';
};

// ─── Constants ───

export const getAggOptions = (t: any) => [
  { value: 'avg', label: t('argus.metrics.agg.avg', 'Average') },
  { value: 'sum', label: t('argus.metrics.agg.sum', 'Sum') },
  { value: 'min', label: t('argus.metrics.agg.min', 'Min') },
  { value: 'max', label: t('argus.metrics.agg.max', 'Max') },
  { value: 'count', label: t('argus.metrics.agg.count', 'Count') },
  { value: 'p50', label: 'P50' },
  { value: 'p75', label: 'P75' },
  { value: 'p90', label: 'P90' },
  { value: 'p95', label: 'P95' },
  { value: 'p99', label: 'P99' },
  {
    value: 'per_second',
    label: t('argus.metrics.agg.perSecond', 'Per Second'),
  },
  {
    value: 'per_minute',
    label: t('argus.metrics.agg.perMinute', 'Per Minute'),
  },
];

/** Default aggregation per metric type */
export const DEFAULT_AGG_BY_TYPE: Record<string, string> = {
  counter: 'sum',
  gauge: 'avg',
  distribution: 'p95',
};

export const QUERY_COLORS = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
];

export function getQueryColor(index: number) {
  return QUERY_COLORS[index % QUERY_COLORS.length];
}

// ─── Unit Formatting ───

export function formatMetricValue(
  value: number,
  unit?: string,
  metricType?: string
): string {
  if (value == null || isNaN(value)) return '—';

  if (metricType === 'counter' || unit === 'count') {
    return formatCompactNumber(value);
  }

  switch (unit) {
    case 'millisecond':
    case 'ms':
      return formatDuration(value);
    case 'byte':
    case 'bytes':
      if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
      if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`;
      return `${value.toFixed(0)} B`;
    case 'percent':
    case '%':
      return `${value.toFixed(1)}%`;
    case 'second':
    case 's':
      return formatDuration(value * 1000);
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

// ─── ClickHouse Date Parser ───

export function parseChDate(s: string): Date {
  if (!s) return new Date(NaN);
  if (s.includes('T')) return new Date(s);
  if (/^\d+$/.test(s)) return new Date(Number(s));
  return new Date(s.replace(' ', 'T'));
}

// ─── MetricChart ───

interface MetricChartProps {
  labels: string[];
  datasets: ChartDataset[];
  isDark: boolean;
  onZoom?: (start: string, end: string) => void;
  config: ChartConfig;
  buckets: string[];
  onPointClick?: (timestamp: string, label: string) => void;
}

export const MetricChart: React.FC<MetricChartProps> = ({
  labels,
  datasets,
  isDark,
  onZoom,
  config,
  buckets,
  onPointClick,
}) => {
  const { t } = useTranslation();

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
      const startDate = parseChDate(start);
      let endDate = parseChDate(end);
      if (buckets.length > 1) {
        const gap =
          parseChDate(buckets[1]).getTime() - parseChDate(buckets[0]).getTime();
        endDate = new Date(endDate.getTime() + gap);
      } else {
        endDate = new Date(endDate.getTime() + 3600000);
      }
      onZoom(startDate.toISOString(), endDate.toISOString());
    }
  };

  const handlePointClick = (index: number, label: string) => {
    if (onPointClick && buckets[index]) {
      onPointClick(buckets[index], label);
    }
  };

  if (datasets.length === 0 || labels.length === 0)
    return (
      <EmptyPlaceholder message={t('argus.metrics.noData')} minHeight={300} />
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
      <Box sx={{ height: 350 }}>
        <InteractiveTimeSeriesChart
          key={`${config.type}-${config.yAxisType}-${datasets.map((d) => d.label).join(',')}`}
          labels={labels}
          datasets={datasets}
          height={350}
          onZoom={onZoom ? handleZoom : undefined}
          type={config.type}
          yAxisType={config.yAxisType}
          showLegend={config.showLegend}
          legendPosition="bottom"
          onPointClick={handlePointClick}
        />
      </Box>
    </Paper>
  );
};
