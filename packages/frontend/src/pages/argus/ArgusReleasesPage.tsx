import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Skeleton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  NewReleases as ReleaseIcon,
  BugReport as BugReportIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
  Devices as DevicesIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusRelease } from '@/services/argusService';
import ArgusSparkline from '@/components/argus/ArgusSparkline';
import ArgusDateRangePicker, { ArgusDateRangeValue, argusDateRangeToApiParams } from '@/components/argus/ArgusDateRangePicker';


const ArgusReleasesPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const projectId = '1';

  const [releases, setReleases] = useState<ArgusRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<ArgusDateRangeValue>(() => {
    const saved = localStorage.getItem('argus-releases-period');
    return { type: 'preset', preset: saved || '30d' };
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(dateRange);
      const data = await argusService.getReleases(projectId, ap.period, ap.start, ap.end);
      setReleases(data || []);
    } catch (error) {
      console.error('Failed to fetch releases:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDateRangeChange = (value: ArgusDateRangeValue) => {
    setDateRange(value);
    if (value.type === 'preset' && value.preset) {
      localStorage.setItem('argus-releases-period', value.preset);
    }
  };

  // Summary stats across all releases
  const totalErrors = releases.reduce((s, r) => s + Number(r.error_count), 0);
  const totalUsers = releases.reduce((s, r) => s + Number(r.affected_users), 0);
  const avgCrashFree = releases.length > 0
    ? releases.reduce((s, r) => s + Number(r.crash_free_rate), 0) / releases.length
    : 100;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ReleaseIcon sx={{ fontSize: 26, color: '#7c4dff' }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.releases.title')}
          </Typography>
          {!loading && (
            <Chip label={`${releases.length} releases`} size="small" sx={{
              fontWeight: 700, fontSize: '0.75rem', height: 22,
              backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none',
            }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArgusDateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          <IconButton onClick={fetchData} size="small"><RefreshIcon /></IconButton>
        </Box>
      </Box>

      {/* Summary Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
        {[
          { icon: <ReleaseIcon />, color: '#7c4dff', label: 'Releases', value: releases.length },
          { icon: <BugReportIcon />, color: '#f44336', label: 'Total Errors', value: totalErrors },
          { icon: <PeopleIcon />, color: '#ff9800', label: 'Affected Users', value: totalUsers },
          { icon: <CheckIcon />, color: avgCrashFree >= 99 ? '#4caf50' : avgCrashFree >= 95 ? '#ff9800' : '#f44336', label: 'Avg. Crash Free', value: `${avgCrashFree.toFixed(1)}%` },
        ].map((card, idx) => (
          <Paper key={idx} elevation={0} sx={{
            p: 2,
            background: isDark
              ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
              : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
            border: `1px solid ${alpha(card.color, 0.2)}`,
            borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5,
            transition: 'all 0.2s', '&:hover': { transform: 'translateY(-1px)' },
          }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1), color: card.color,
            }}>
              {React.cloneElement(card.icon, { sx: { fontSize: 18 } })}
            </Box>
            <Box>
              {loading ? <Skeleton width={50} height={24} /> : (
                <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2, fontSize: '1.1rem' }}>
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: isDark ? '#888' : '#777', fontWeight: 500, fontSize: '0.65rem' }}>
                {card.label}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      <PageContentLoader loading={loading}>
        {releases.length === 0 ? (
          <Paper elevation={0} sx={{
            py: 8, textAlign: 'center',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}>
            <ReleaseIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">{t('argus.releases.noReleases')}</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {releases.map((r, idx) => {
              const crashFree = Number(r.crash_free_rate);
              const isHotfix = r.release.includes('hotfix');
              const statusColor = crashFree >= 99 ? '#4caf50' : crashFree >= 95 ? '#ff9800' : '#f44336';
              const errorCount = Number(r.error_count);
              const fatalCount = Number(r.fatal_count || 0);
              const unhandledCount = Number(r.unhandled_count || 0);
              const txnCount = Number(r.transaction_count || 0);
              const avgDur = Number(r.avg_duration || 0);
              const p95 = Number(r.p95 || 0);
              const txnErrorRate = Number(r.txn_error_rate || 0);

              return (
                <Paper
                  key={`${r.release}-${idx}`}
                  elevation={0}
                  sx={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 2, overflow: 'hidden',
                    borderLeft: `3px solid ${statusColor}`,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: alpha(statusColor, 0.5), boxShadow: `0 2px 12px ${alpha(statusColor, 0.08)}` },
                  }}
                >
                  {/* Header row */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  }}>
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {r.release}
                      </Typography>
                      {isHotfix && (
                        <Chip label="hotfix" size="small" sx={{ height: 18, fontSize: '0.6rem', backgroundColor: alpha('#ff9800', 0.1), color: '#ff9800', border: 'none' }} />
                      )}
                    </Box>
                    {/* Crash-free rate badge */}
                    <Tooltip title="Crash Free Rate">
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: '14px !important' }} />}
                        label={`${crashFree.toFixed(1)}%`}
                        size="small"
                        sx={{
                          height: 24, fontWeight: 700, fontSize: '0.72rem',
                          backgroundColor: alpha(statusColor, isDark ? 0.15 : 0.08),
                          color: statusColor, border: `1px solid ${alpha(statusColor, 0.3)}`,
                          '& .MuiChip-icon': { color: statusColor },
                        }}
                      />
                    </Tooltip>
                    {/* Sparkline */}
                    {r.error_trend && r.error_trend.length > 1 && (
                      <ArgusSparkline data={r.error_trend} width={60} height={20} color="#f44336" />
                    )}
                    {/* Time */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <ScheduleIcon sx={{ fontSize: 13, color: isDark ? '#555' : '#bbb' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: isDark ? '#666' : '#999' }}>
                        {formatDate(r.first_seen)} → {formatDate(r.last_seen)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Metrics grid */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 0, px: 0 }}>
                    <MetricCell label="Errors" value={errorCount.toLocaleString()} color="#f44336" isDark={isDark} icon={<BugReportIcon />} />
                    <MetricCell label="Fatal" value={fatalCount.toLocaleString()} color={fatalCount > 0 ? '#d50000' : '#4caf50'} isDark={isDark} icon={<WarningIcon />} />
                    <MetricCell label="Unhandled" value={unhandledCount.toLocaleString()} color={unhandledCount > 0 ? '#ff5722' : '#4caf50'} isDark={isDark} icon={<WarningIcon />} />
                    <MetricCell label="Affected Users" value={Number(r.affected_users).toLocaleString()} color="#ff9800" isDark={isDark} icon={<PeopleIcon />} />
                    <MetricCell label="Issues" value={Number(r.issue_count).toLocaleString()} color="#2196f3" isDark={isDark} icon={<BugReportIcon />} />
                    <MetricCell label="Sessions" value={Number(r.total_sessions).toLocaleString()} color="#7c4dff" isDark={isDark} icon={<DevicesIcon />} />
                    <MetricCell label="Transactions" value={txnCount.toLocaleString()} color="#00bcd4" isDark={isDark} icon={<SpeedIcon />} />
                    <MetricCell label="P95 Latency" value={p95 > 0 ? `${Math.round(p95)}ms` : '-'} color={p95 > 3000 ? '#f44336' : p95 > 1000 ? '#ff9800' : '#4caf50'} isDark={isDark} icon={<SpeedIcon />} />
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </PageContentLoader>
    </Box>
  );
};

// --- Sub-components ---

const MetricCell: React.FC<{ label: string; value: string; color: string; isDark: boolean; icon: React.ReactElement }> = ({ label, value, color, isDark, icon }) => (
  <Box sx={{
    py: 1.5, px: 2,
    borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
    display: 'flex', alignItems: 'center', gap: 1,
  }}>
    <Box sx={{ color: alpha(color, 0.5), display: 'flex' }}>
      {React.cloneElement(icon, { sx: { fontSize: 15 } })}
    </Box>
    <Box>
      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem', color, lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.6rem', color: isDark ? '#666' : '#aaa' }}>
        {label}
      </Typography>
    </Box>
  </Box>
);

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return dateStr; }
}

export default ArgusReleasesPage;
