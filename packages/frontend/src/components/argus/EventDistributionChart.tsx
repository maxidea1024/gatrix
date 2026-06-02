import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
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
}

const PERIODS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
];

const EventDistributionChart: React.FC<EventDistributionChartProps> = ({ projectId, issueId, isDark }) => {
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
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 3,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header and Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChartIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
          {t('argus.issues.eventDistribution')}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Metric Toggle */}
          <ToggleButtonGroup
            value={metric}
            exclusive
            onChange={handleMetricChange}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="events" sx={{ px: 1.5, py: 0, textTransform: 'none', fontSize: '0.75rem', gap: 0.5 }}>
              <BarChartIcon sx={{ fontSize: 14 }} />
              {t('argus.common.events', 'Events')}
            </ToggleButton>
            <ToggleButton value="users" sx={{ px: 1.5, py: 0, textTransform: 'none', fontSize: '0.75rem', gap: 0.5 }}>
              <PeopleIcon sx={{ fontSize: 14 }} />
              {t('argus.common.users', 'Users')}
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Period Toggle */}
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={handlePeriodChange}
            size="small"
            sx={{ height: 28 }}
          >
            {PERIODS.map(p => (
              <ToggleButton key={p.value} value={p.value} sx={{ px: 1.5, py: 0, fontSize: '0.75rem', textTransform: 'none' }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Chart */}
      <Box sx={{ position: 'relative', height: 160 }}>
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
            height={160}
          />
        )}
      </Box>
    </Paper>
  );
};

export default EventDistributionChart;
