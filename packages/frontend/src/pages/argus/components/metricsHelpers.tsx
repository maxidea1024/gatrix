import React from 'react';
import { Box, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import InteractiveTimeSeriesChart, {
  ChartDataset,
} from '@/components/argus/InteractiveTimeSeriesChart';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// ─── Types ───

export type MetricQuery = {
  id: string; // 'a', 'b', etc.
  metric: string;
  agg: string;
  groupBy: string;
  isHidden: boolean;
};

export type EquationQuery = {
  id: string; // 'f1', 'f2', etc.
  equation: string;
  isHidden: boolean;
};

export type ChartConfig = {
  type: 'line' | 'bar' | 'area';
  yAxisType: 'linear' | 'logarithmic';
  showLegend: boolean;
};

// ─── Constants ───

export const getAggOptions = (t: any) => [
  { value: 'avg', label: t('argus.metrics.agg.avg', 'Average') },
  { value: 'sum', label: t('argus.metrics.agg.sum', 'Sum') },
  { value: 'min', label: t('argus.metrics.agg.min', 'Min') },
  { value: 'max', label: t('argus.metrics.agg.max', 'Max') },
  { value: 'count', label: t('argus.metrics.agg.count', 'Count') },
];

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

// ─── MetricChart ───

interface MetricChartProps {
  labels: string[];
  datasets: ChartDataset[];
  isDark: boolean;
  onZoom?: (start: string, end: string) => void;
  config: ChartConfig;
  buckets: string[];
}

export const MetricChart: React.FC<MetricChartProps> = ({
  labels,
  datasets,
  isDark,
  onZoom,
  config,
  buckets,
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
          labels={labels}
          datasets={datasets}
          height={350}
          onZoom={onZoom ? handleZoom : undefined}
          type={config.type}
          yAxisType={config.yAxisType}
          showLegend={config.showLegend}
          legendPosition="bottom"
        />
      </Box>
    </Paper>
  );
};
