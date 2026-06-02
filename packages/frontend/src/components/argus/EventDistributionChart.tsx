import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import argusService from '@/services/argusService';
import InteractiveTimeSeriesChart from './InteractiveTimeSeriesChart';

interface EventDistributionChartProps {
  projectId: string | number;
  issueId: string | number;
  isDark: boolean;
  compact?: boolean;
}

const PERIODS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
];

const EventDistributionChart: React.FC<EventDistributionChartProps> = ({ projectId, issueId, isDark, compact = false }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  
  const [period, setPeriod] = useState<string>('14d');
  const [metric, setMetric] = useState<'events' | 'users'>('events');
  const [loading, setLoading] = useState<boolean>(true);
  const [statsData, setStatsData] = useState<{ timestamp: string; event_count: number; user_count: number }[]>([]);

  const fetchStats = useCallback(async () => {
    if (!projectId || !issueId) return;
    setLoading(true);
    try {
      const data = await argusService.getIssueStats(projectId, issueId, period);
      setStatsData(data);
    } catch (error) {
      console.error('Failed to fetch issue stats:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, newPeriod: string | null) => {
    if (newPeriod) {
      setPeriod(newPeriod);
    }
  };

  const handleMetricChange = (_: React.MouseEvent<HTMLElement>, newMetric: 'events' | 'users' | null) => {
    if (newMetric) {
      setMetric(newMetric);
    }
  };

  // Format data for InteractiveTimeSeriesChart
  const chartData = statsData.map(d => {
    const date = new Date(d.timestamp);
    let label = '';
    if (period === '24h') {
      label = `${date.getHours()}:00`;
    } else {
      label = `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return {
      label,
      count: metric === 'events' ? d.event_count : d.user_count,
    };
  });

  return (
    <Box
      sx={{
        pb: compact ? 1.5 : 2,
        mb: 2,
      }}
    >
      {/* Header and Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: compact ? 1 : 2, flexWrap: 'wrap', gap: compact ? 1 : 2 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChartIcon fontSize={compact ? "inherit" : "small"} sx={{ color: theme.palette.primary.main }} />
          {t('argus.issues.eventDistribution')}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: compact ? 1 : 2 }}>
          {/* Metric Toggle */}
          <ToggleButtonGroup
            value={metric}
            exclusive
            onChange={handleMetricChange}
            size="small"
            sx={{ height: compact ? 24 : 28 }}
          >
            <ToggleButton value="events" sx={{ px: compact ? 1 : 1.5, py: 0, textTransform: 'none', fontSize: '0.75rem', gap: 0.5 }}>
              <BarChartIcon sx={{ fontSize: 14 }} />
              {!compact && t('argus.common.events', 'Events')}
            </ToggleButton>
            <ToggleButton value="users" sx={{ px: compact ? 1 : 1.5, py: 0, textTransform: 'none', fontSize: '0.75rem', gap: 0.5 }}>
              <PeopleIcon sx={{ fontSize: 14 }} />
              {!compact && t('argus.common.users', 'Users')}
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Period Toggle */}
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={handlePeriodChange}
            size="small"
            sx={{ height: compact ? 24 : 28 }}
          >
            {PERIODS.map(p => (
              <ToggleButton key={p.value} value={p.value} sx={{ px: compact ? 0.8 : 1.5, py: 0, fontSize: compact ? '0.65rem' : '0.75rem', textTransform: 'none' }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Chart */}
      <Box sx={{ position: 'relative', height: compact ? 100 : 160 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={24} />
          </Box>
        ) : statsData.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.disabled">
              {t('argus.common.noData', 'No data available')}
            </Typography>
          </Box>
        ) : (
          <InteractiveTimeSeriesChart
            data={chartData}
            type="bar"
            height={compact ? 100 : 160}
          />
        )}
      </Box>
      <Divider />
    </Box>
  );
};

export default EventDistributionChart;
