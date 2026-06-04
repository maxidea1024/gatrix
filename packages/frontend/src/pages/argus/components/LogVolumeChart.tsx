import React, { useMemo } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
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
}

const LogVolumeChart = React.memo<LogVolumeChartProps>(({ data, isDark, period, onZoom }) => {
  const { t, i18n } = useTranslation();

  const { chartData, buckets } = useMemo(() => {
    if (data.length === 0) return { chartData: [], buckets: [] };
    const bucketMap = new Map<string, number>();
    data.forEach(p => {
      const count = Number(p.count) || 0;
      bucketMap.set(p.bucket, (bucketMap.get(p.bucket) || 0) + count);
    });
    const sorted = [...bucketMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const mapped = sorted.map(([b, count]) => {
      const d = new Date(b);
      const label = d.toLocaleString(i18n.language || 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      return { label, count };
    });

    return { chartData: mapped, buckets: sorted.map(([b]) => b) };
  }, [data, i18n.language]);

  const handleZoom = (startIndex: number, endIndex: number) => {
    if (onZoom && buckets[startIndex] && buckets[endIndex]) {
      const start = buckets[startIndex] < buckets[endIndex] ? buckets[startIndex] : buckets[endIndex];
      const end = buckets[startIndex] < buckets[endIndex] ? buckets[endIndex] : buckets[startIndex];

      const startDate = new Date(start);
      let endDate = new Date(end);

      if (buckets.length > 1) {
        const gap = new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
        endDate = new Date(endDate.getTime() + gap);
      } else {
        endDate = new Date(endDate.getTime() + 3600000);
      }

      onZoom(startDate.toISOString(), endDate.toISOString());
    }
  };

  if (chartData.length === 0) return (
    <EmptyPlaceholder message={t('argus.logs.noLogData')} minHeight={130} />
  );

  return (
    <Paper elevation={0} sx={{
      mb: 2, p: 2, pt: 1.5, borderRadius: 2,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, mb: 1, color: 'text.secondary' }}>
        count(logs)
      </Typography>
      <Box sx={{ height: 130 }}>
        <InteractiveTimeSeriesChart data={chartData} type="bar" height={130} onZoom={onZoom ? handleZoom : undefined} />
      </Box>
    </Paper>
  );
});

export default LogVolumeChart;
