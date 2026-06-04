import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Typography, Paper, Chip, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import argusService from '@/services/argusService';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import { ArgusFilterState } from '@/components/argus/ArgusFilterBar';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, ChartTooltip, ChartLegend);

interface IssueVolumeChartProps {
  projectId: string | number;
  filters: ArgusFilterState;
  status: string;
  level: string;
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
  onDateRangeSelect,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [volumeData, setVolumeData] = useState<{ day: string; count: number; issue_count: number }[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const chartRef = useRef<any>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchVolume = useCallback(async () => {
    if (!projectId) return;
    setVolumeLoading(true);
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const data = await argusService.getIssueVolume(projectId, {
        ...dateParams,
        status: status || undefined,
        level: level || undefined,
      });
      setVolumeData(data);
    } catch (e) {
      console.error('Failed to fetch issue volume:', e);
      setVolumeData([]);
    } finally {
      setVolumeLoading(false);
    }
  }, [projectId, filters, status, level]);

  useEffect(() => { fetchVolume(); }, [fetchVolume]);

  const volumeLabelsRaw = useMemo(() => volumeData.map(d => d.day), [volumeData]);

  const volumeChartData = useMemo(() => {
    if (!volumeData.length) return { labels: [], datasets: [] };
    const barColors = volumeData.map((_, idx) => {
      if (dragStart !== null && dragEnd !== null) {
        const lo = Math.min(dragStart, dragEnd);
        const hi = Math.max(dragStart, dragEnd);
        if (idx >= lo && idx <= hi) return theme.palette.error.main;
        return alpha(theme.palette.error.main, 0.2);
      }
      return alpha(theme.palette.error.main, 0.6);
    });
    return {
      labels: volumeData.map(d => {
        try { const dt = new Date(d.day); return `${dt.getMonth() + 1}/${dt.getDate()}`; } catch { return d.day; }
      }),
      datasets: [{
        label: t('argus.issues.events'),
        data: volumeData.map(d => d.count),
        backgroundColor: barColors,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 4,
        borderSkipped: false as const,
      }],
    };
  }, [volumeData, t, dragStart, dragEnd, theme]);

  const getBarIndex = (e: React.MouseEvent<HTMLElement>) => {
    const chart = chartRef.current;
    if (!chart) return null;
    const elements = chart.getElementsAtEventForMode(e.nativeEvent, 'index', { intersect: false }, false);
    if (elements.length > 0) return elements[0].index;
    return null;
  };

  const handleChartMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    const idx = getBarIndex(e);
    if (idx !== null) {
      setDragStart(idx);
      setDragEnd(idx);
      setIsDragging(true);
    }
  };

  const handleChartMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!isDragging) return;
    const idx = getBarIndex(e);
    if (idx !== null) setDragEnd(idx);
  };

  const handleChartMouseUp = () => {
    if (!isDragging || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    const lo = Math.min(dragStart, dragEnd);
    const hi = Math.max(dragStart, dragEnd);
    if (volumeLabelsRaw.length > 0 && lo >= 0 && hi < volumeLabelsRaw.length) {
      const startDay = volumeLabelsRaw[lo];
      const endDay = volumeLabelsRaw[hi];
      try {
        const startDate = new Date(startDay);
        const endDate = new Date(endDay);
        endDate.setHours(23, 59, 59, 999);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          onDateRangeSelect?.(startDate, endDate);
        }
      } catch { /* ignore */ }
    }
  };

  const handleChartReset = () => {
    setDragStart(null);
    setDragEnd(null);
  };

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } },
    },
  }), [isDark]);

  return (
    <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2, position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600 }}>
          {t('argus.issues.volumeChart')}
        </Typography>
        {dragStart !== null && dragEnd !== null && (
          <Chip
            label={t('argus.issues.clearSelection')}
            size="small"
            onDelete={handleChartReset}
            sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-deleteIcon': { fontSize: 12 } }}
          />
        )}
      </Box>
      <Box
        sx={{ height: 80, cursor: 'crosshair', userSelect: 'none' }}
        onMouseDown={handleChartMouseDown}
        onMouseMove={handleChartMouseMove}
        onMouseUp={handleChartMouseUp}
        onMouseLeave={() => { if (isDragging) handleChartMouseUp(); }}
      >
        {volumeLoading
          ? <ArgusChartSkeleton type="bar" height={80} color={theme.palette.error.main} />
          : <Bar ref={chartRef} data={volumeChartData} options={chartOpts as any} />}
      </Box>
      {isDragging && (
        <Typography variant="caption" sx={{ position: 'absolute', bottom: 4, right: 8, fontSize: '0.58rem', color: 'text.disabled' }}>
          {t('argus.issues.dragToSelect')}
        </Typography>
      )}
    </Paper>
  );
};

export default React.memo(IssueVolumeChart);
