import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
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
 * Issue volume chart — uses ArgusVolumeChart for consistent UX.
 * Fetches its own data from the API.
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

  const [volumeData, setVolumeData] = useState<
    { day: string; count: number; issue_count: number }[]
  >([]);
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

  useEffect(() => {
    fetchVolume();
  }, [fetchVolume]);

  const { chartLabels, chartDatasets, buckets } = useMemo(() => {
    if (volumeData.length === 0)
      return { chartLabels: [], chartDatasets: [], buckets: [] };

    const mapped = volumeData.map((d) => {
      let label = d.day;
      try {
        const dt = new Date(d.day);
        label = dt.toLocaleString(i18n.language || 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      } catch {
        /* ignore */
      }
      return { label, count: d.count };
    });

    const datasets: ChartDataset[] = [
      {
        label: t('argus.issues.events', 'Events'),
        data: mapped.map((d) => d.count),
        type: 'bar',
        color: theme.palette.error.main,
      },
    ];

    return {
      chartLabels: mapped.map((d) => d.label),
      chartDatasets: datasets,
      buckets: volumeData.map((d) => d.day),
    };
  }, [volumeData, i18n.language, t, theme.palette.error.main]);

  const handleZoom = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!onDateRangeSelect) return;
      const startIdx = Math.min(startIndex, endIndex);
      const endIdx = Math.max(startIndex, endIndex);

      if (buckets[startIdx] && buckets[endIdx]) {
        try {
          const startDate = new Date(buckets[startIdx]);
          let endDate = new Date(buckets[endIdx]);

          if (buckets.length > 1) {
            const gap =
              new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
            endDate = new Date(endDate.getTime() + gap - 1);
          } else {
            endDate.setHours(23, 59, 59, 999);
          }

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            onDateRangeSelect(startDate, endDate);
          }
        } catch {
          /* ignore */
        }
      }
    },
    [buckets, onDateRangeSelect]
  );

  return (
    <ArgusVolumeChart
      datasets={chartDatasets}
      labels={chartLabels}
      loading={volumeLoading}
      emptyMessage={t('argus.issues.noVolumeData', 'No event data')}
      onZoom={onDateRangeSelect ? handleZoom : undefined}
      storagePrefix="argus_issue_volume"
      showChartTypeToggle={false}
      showCompactToggle={false}
      skeletonColor={theme.palette.error.main}
      mb={1.5}
    />
  );
};

export default React.memo(IssueVolumeChart);
