import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import argusService from '@/services/argusService';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import { ArgusFilterState } from '@/components/argus/ArgusFilterBar';

interface IssueVolumeChartProps {
  projectId: string | number;
  filters: ArgusFilterState;
  status: string;
  level: string;
  query?: string;
  /** Called when user drag-selects a date range on the chart */
  onDateRangeSelect?: (start: Date, end: Date) => void;
}

/**
 * Bar chart showing issue event volume over time.
 * Supports click-drag selection to zoom into a date range.
 */
const IssueVolumeChart: React.FC<IssueVolumeChartProps> = ({
  projectId,
  filters,
  status,
  level,
  query,
  onDateRangeSelect,
}) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [volumeData, setVolumeData] = useState<{ day: string; count: number; issue_count: number }[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);

  const fetchVolume = useCallback(async () => {
    if (!projectId) return;
    setVolumeLoading(true);
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const data = await argusService.getIssueVolume(projectId, {
        ...dateParams,
        status: status || undefined,
        level: level || undefined,
        query: query || undefined,
      });
      setVolumeData(data);
    } catch (e) {
      console.error('Failed to fetch issue volume:', e);
      setVolumeData([]);
    } finally {
      setVolumeLoading(false);
    }
  }, [projectId, filters, status, level, query]);

  useEffect(() => { fetchVolume(); }, [fetchVolume]);

  const { chartData, buckets } = useMemo(() => {
    if (volumeData.length === 0) return { chartData: [], buckets: [] };

    const mapped = volumeData.map((d) => {
      let label = d.day;
      try {
        const dt = new Date(d.day);
        label = dt.toLocaleString(i18n.language || 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      } catch { /* ignore */ }
      return { label, count: d.count };
    });

    return { chartData: mapped, buckets: volumeData.map(d => d.day) };
  }, [volumeData, i18n.language]);

  const handleZoom = useCallback((startIndex: number, endIndex: number) => {
    if (!onDateRangeSelect) return;
    const startIdx = Math.min(startIndex, endIndex);
    const endIdx = Math.max(startIndex, endIndex);

    if (buckets[startIdx] && buckets[endIdx]) {
      try {
        const startDate = new Date(buckets[startIdx]);
        let endDate = new Date(buckets[endIdx]);
        
        // Add duration of one bucket to the end date
        if (buckets.length > 1) {
          const gap = new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
          endDate = new Date(endDate.getTime() + gap - 1);
        } else {
          endDate.setHours(23, 59, 59, 999);
        }

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          onDateRangeSelect(startDate, endDate);
        }
      } catch { /* ignore */ }
    }
  }, [buckets, onDateRangeSelect]);

  return (
    <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2, position: 'relative' }}>
      <Box sx={{ height: 120 }}>
        {volumeLoading ? (
          <ArgusChartSkeleton type="bar" height={120} color={theme.palette.error.main} />
        ) : (
          <InteractiveTimeSeriesChart 
            data={chartData} 
            type="bar" 
            height={120} 
            onZoom={onDateRangeSelect ? handleZoom : undefined} 
            datasets={[{
              label: t('argus.issues.events'),
              data: chartData.map(d => d.count),
              type: 'bar',
              color: theme.palette.error.main,
            }]}
          />
        )}
      </Box>
    </Paper>
  );
};

export default React.memo(IssueVolumeChart);
