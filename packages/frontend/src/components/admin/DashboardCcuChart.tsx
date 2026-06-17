import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
} from '@mui/material';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToDatePair,
} from '../common/DateRangeSelector';
import {
  OpenInNew as OpenInNewIcon,
  BarChart as BarChartIcon,
  StackedBarChart as StackedBarChartIcon,
  ShowChart as LineChartIcon,
  Timeline as AreaChartIcon,
  StackedLineChart as StackedAreaChartIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import playerConnectionService from '../../services/playerConnectionService';
import type { CcuHistoryRecord } from '../../services/playerConnectionService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const WORLD_COLORS = [
  { border: '#2196f3', bg: 'rgba(33,150,243,0.1)' },
  { border: '#4caf50', bg: 'rgba(76,175,80,0.1)' },
  { border: '#ff9800', bg: 'rgba(255,152,0,0.1)' },
  { border: '#e91e63', bg: 'rgba(233,30,99,0.1)' },
  { border: '#9c27b0', bg: 'rgba(156,39,176,0.1)' },
  { border: '#00bcd4', bg: 'rgba(0,188,212,0.1)' },
  { border: '#795548', bg: 'rgba(121,85,72,0.1)' },
  { border: '#607d8b', bg: 'rgba(96,125,139,0.1)' },
];

interface Props {
  projectApiPath: string;
}

const DashboardCcuChart: React.FC<Props> = ({ projectApiPath }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CcuHistoryRecord[]>([]);
  const [dateRange, setDateRangeRaw] = useState<DateRangeValue>(() => ({
    type: 'preset',
    preset: localStorage.getItem('ccu-time-range') || '24h',
  }));
  const setDateRange = useCallback((v: DateRangeValue) => {
    setDateRangeRaw(v);
    if (v.type === 'preset' && v.preset) {
      localStorage.setItem('ccu-time-range', v.preset);
    }
  }, []);

  const [chartType, setChartTypeRaw] = useState<
    'bar' | 'stacked-bar' | 'line' | 'area' | 'stacked-area'
  >(
    () =>
      (localStorage.getItem('dashboard.ccuChart.chartType') as any) || 'line'
  );

  const setChartType = useCallback(
    (val: 'bar' | 'stacked-bar' | 'line' | 'area' | 'stacked-area') => {
      setChartTypeRaw(val);
      localStorage.setItem('dashboard.ccuChart.chartType', val);
    },
    []
  );

  const [showLegend] = useState(
    () => localStorage.getItem('ccu-show-legend') !== 'false'
  );

  const getDateRange = useCallback(() => {
    const { start, end } = dateRangeToDatePair(dateRange);
    return { from: start, to: end };
  }, [dateRange]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const data = await playerConnectionService.getCcuHistory(projectApiPath, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setRecords(data);
    } catch (err) {
      console.error('Dashboard CCU history load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [projectApiPath, getDateRange]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Build chart data
  const chartData = useMemo(() => {
    if (records.length === 0) return { labels: [], datasets: [] };

    // Group by worldId
    const groups = new Map<string, CcuHistoryRecord[]>();
    records.forEach((r) => {
      const key = r.worldId ?? '__total__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    // Use total's timestamps as labels
    const totalRecords = groups.get('__total__') || [];
    const labels = totalRecords.map((r) => {
      const d = new Date(r.recordedAt);
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const datasets: any[] = [];

    // Total line (bold, filled)
    if (totalRecords.length > 0) {
      datasets.push({
        label: t('playerConnections.ccu.total'),
        data: totalRecords.map((r) => r.playerCount),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.15)',
        borderWidth: 2.5,
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 3,
        spanGaps: true,
      });
    }

    // Per-world lines
    let colorIdx = 0;
    groups.forEach((recs, key) => {
      if (key === '__total__') return;
      const c = WORLD_COLORS[colorIdx % WORLD_COLORS.length];
      datasets.push({
        label: recs[0]?.worldName || key,
        data: recs.map((r) => r.playerCount),
        borderColor: c.border,
        backgroundColor: c.bg,
        borderWidth: 1.5,
        tension: 0.3,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 2,
        spanGaps: true,
      });
      colorIdx++;
    });

    const finalDatasets = datasets.map((ds) => {
      const isBar = chartType === 'bar' || chartType === 'stacked-bar';
      const isArea = chartType === 'area' || chartType === 'stacked-area';
      return {
        ...ds,
        type: isBar ? 'bar' : 'line',
        fill: isArea,
        backgroundColor: isBar || isArea ? ds.backgroundColor : 'transparent',
        borderWidth: isBar ? 0 : ds.borderWidth || 2,
        borderRadius: isBar ? 4 : 0,
      };
    });

    return { labels, datasets: finalDatasets };
  }, [records, t, chartType]);

  const isStacked = chartType === 'stacked-bar' || chartType === 'stacked-area';

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: {
          display: showLegend,
          position: 'top' as const,
          labels: {
            boxWidth: 12,
            font: { size: 11 },
            padding: 8,
          },
        },
        tooltip: { mode: 'index' as const, intersect: false },
      },
      scales: {
        x: {
          stacked: isStacked,
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            font: { size: 10 },
          },
        },
        y: {
          stacked: isStacked,
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 10 } },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [showLegend, isStacked]
  );

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {t('dashboard.ccuChartTitle')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              compact
            />
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, val) => val && setChartType(val)}
              size="small"
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                p: 0.25,
                '& .MuiToggleButton-root': {
                  px: 1,
                  py: 0.25,
                  border: 'none',
                  borderRadius: 1.5,
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.12),
                    },
                  },
                },
              }}
            >
              <ToggleButton value="bar">
                <Tooltip title={t('argus.chart.bar', 'Bar')}>
                  <BarChartIcon sx={{ fontSize: 14 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="stacked-bar">
                <Tooltip title={t('argus.chart.stackedBar', 'Stacked Bar')}>
                  <StackedBarChartIcon sx={{ fontSize: 14 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="line">
                <Tooltip title={t('argus.chart.line', 'Line')}>
                  <LineChartIcon sx={{ fontSize: 14 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="area">
                <Tooltip title={t('argus.chart.area', 'Area')}>
                  <AreaChartIcon sx={{ fontSize: 14 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="stacked-area">
                <Tooltip title={t('argus.chart.stackedArea', 'Stacked Area')}>
                  <StackedAreaChartIcon sx={{ fontSize: 14 }} />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title={t('dashboard.ccuChartViewDetail')}>
              <IconButton
                size="small"
                onClick={() =>
                  navigate('/admin/player-connections?tab=ccu-graph')
                }
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {loading ? (
          <Box
            sx={{
              height: 280,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 1,
            }}
          >
            {/* Animated shimmer skeleton */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)'
                    : 'linear-gradient(90deg, rgba(0,0,0,0.03) 25%, rgba(0,0,0,0.06) 50%, rgba(0,0,0,0.03) 75%)',
                backgroundSize: '200% 100%',
                animation: 'ccuShimmer 1.5s infinite ease-in-out',
                '@keyframes ccuShimmer': {
                  '0%': { backgroundPosition: '200% 0' },
                  '100%': { backgroundPosition: '-200% 0' },
                },
                borderRadius: 1,
              }}
            />
            {/* Faint chart-like placeholder lines */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                p: 2,
                gap: 0.5,
              }}
            >
              {[60, 40, 70, 35, 55, 45].map((w, i) => (
                <Box
                  key={i}
                  sx={{
                    height: 2,
                    width: `${w}%`,
                    borderRadius: 1,
                    bgcolor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.04)',
                  }}
                />
              ))}
            </Box>
          </Box>
        ) : chartData.datasets.length === 0 ? (
          <Box
            sx={{
              height: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">
              {t('playerConnections.ccuGraph.noData')}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              height: 280,
              animation:
                'ccuReveal 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
              '@keyframes ccuReveal': {
                from: { opacity: 0, transform: 'translateY(12px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            <Chart
              type={
                chartType === 'bar' || chartType === 'stacked-bar'
                  ? 'bar'
                  : 'line'
              }
              data={chartData}
              options={chartOptions as any}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCcuChart;
