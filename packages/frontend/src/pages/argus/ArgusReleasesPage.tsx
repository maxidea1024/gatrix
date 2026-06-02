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
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusRelease } from '@/services/argusService';
import ArgusSparkline from '@/components/argus/ArgusSparkline';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState } from '@/components/argus/ArgusFilterBar';
import { argusDateRangeToApiParams } from '@/components/argus/ArgusDateRangePicker';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';


const ArgusReleasesPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const URL_PARAMS = useMemo(() => ({
    period: { key: 'period', default: '30d', storageKey: 'argus-releases-period' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const [releases, setReleases] = useState<ArgusRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const filters = useMemo<ArgusFilterState>(
    () => defaultArgusFilterState(urlState.period),
    [urlState.period],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const data = await argusService.getReleases(projectId, ap.period, ap.start, ap.end);
      setReleases(data || []);
    } catch (error) {
      console.error('Failed to fetch releases:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset });
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
      <PageHeader
        icon={<ReleaseIcon />}
        title={t('argus.releases.title')}
        subtitle={t('argus.releases.subtitle')}
        enableAutoBack
        actions={
          !loading && releases.length > 0 && (
            <Chip label={`${releases.length} ${t('argus.releases.releasesLabel')}`} size="small" sx={{
              fontWeight: 700, fontSize: '0.75rem', height: 22,
              backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none',
            }} />
          )
        }
      />

      {/* Filter Bar */}
      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={fetchData}
        loading={loading}
      />

      {/* Summary Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
        {[
          { icon: <ReleaseIcon />, color: '#7c4dff', label: t('argus.releases.releasesLabel'), value: releases.length },
          { icon: <BugReportIcon />, color: '#f44336', label: t('argus.releases.totalErrors'), value: totalErrors },
          { icon: <PeopleIcon />, color: '#ff9800', label: t('argus.releases.affectedUsers'), value: totalUsers },
          { icon: <CheckIcon />, color: avgCrashFree >= 99 ? '#4caf50' : avgCrashFree >= 95 ? '#ff9800' : '#f44336', label: t('argus.releases.avgCrashFree'), value: `${avgCrashFree.toFixed(1)}%` },
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
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Table Header */}
            <Box sx={{
              display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1.5fr 1.5fr 1.5fr 1fr 1fr 1fr', gap: 2,
              px: 3, py: 1.5, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderTopLeftRadius: 8, borderTopRightRadius: 8,
            }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t('argus.releases.version', 'VERSION')}</Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t('argus.releases.crashFreeSessions', 'CRASH FREE SESSIONS')}</Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t('argus.releases.crashFreeUsers', 'CRASH FREE USERS')}</Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t('argus.releases.newIssues', 'NEW ISSUES')}</Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t('argus.releases.totalErrors', 'TOTAL ERRORS')}</Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t('argus.releases.sessions', 'ADOPTION (SESSIONS)')}</Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t('argus.releases.perf', 'PERFORMANCE')}</Typography>
            </Box>

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
              const prevRelease = releases[idx + 1];
              const crashFreeDelta = prevRelease ? crashFree - Number(prevRelease.crash_free_rate) : 0;
              const crashFreeUsers = Number(r.crash_free_users);
              const crashFreeUsersDelta = prevRelease ? crashFreeUsers - Number(prevRelease.crash_free_users) : 0;
              const newIssues = Number(r.new_issues);

              return (
                <Box
                  key={`${r.release}-${idx}`}
                  sx={{
                    display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1.5fr 1.5fr 1.5fr 1fr 1fr 1fr', gap: 2, alignItems: 'center',
                    px: 3, py: 2,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    borderLeft: `3px solid ${statusColor}`,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' },
                  }}
                  onClick={() => navigate(`/argus/releases/${projectId}/${encodeURIComponent(r.release)}`)}
                >
                  {/* Version */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {r.release}
                      </Typography>
                      {isHotfix && (
                        <Chip label={t('argus.releases.hotfix', 'HOTFIX')} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, backgroundColor: alpha('#ff9800', 0.15), color: '#ff9800', border: 'none' }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ScheduleIcon sx={{ fontSize: 13, color: isDark ? '#555' : '#bbb' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                        {formatDate(r.first_seen)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Crash-Free Sessions */}
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: statusColor, lineHeight: 1.2 }}>
                      {crashFree.toFixed(1)}%
                    </Typography>
                    {prevRelease && (
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: crashFreeDelta >= 0 ? '#4caf50' : '#f44336', display: 'flex', alignItems: 'center', gap: 0.2 }}>
                        {crashFreeDelta > 0 ? '▲' : crashFreeDelta < 0 ? '▼' : '-'} {Math.abs(crashFreeDelta).toFixed(1)}%
                      </Typography>
                    )}
                  </Box>

                  {/* Crash-Free Users */}
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: crashFreeUsers >= 99 ? '#4caf50' : crashFreeUsers >= 95 ? '#ff9800' : '#f44336', lineHeight: 1.2 }}>
                      {crashFreeUsers.toFixed(1)}%
                    </Typography>
                    {prevRelease && (
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: crashFreeUsersDelta >= 0 ? '#4caf50' : '#f44336', display: 'flex', alignItems: 'center', gap: 0.2 }}>
                        {crashFreeUsersDelta > 0 ? '▲' : crashFreeUsersDelta < 0 ? '▼' : '-'} {Math.abs(crashFreeUsersDelta).toFixed(1)}%
                      </Typography>
                    )}
                  </Box>

                  {/* New Issues */}
                  <Box>
                    {newIssues > 0 ? (
                      <Chip
                        icon={<BugReportIcon sx={{ fontSize: '14px !important' }} />}
                        label={`${newIssues} ${t('argus.releases.new', 'New')}`}
                        size="small"
                        sx={{
                          height: 26, fontWeight: 700, fontSize: '0.75rem',
                          backgroundColor: alpha('#f44336', 0.1), color: '#f44336', border: 'none',
                          '& .MuiChip-icon': { color: '#f44336' },
                        }}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 600, fontSize: '0.8rem' }}>
                        {t('argus.releases.noNewIssues', 'No new issues')}
                      </Typography>
                    )}
                  </Box>

                  {/* Total Errors */}
                  <Box>
                    <Typography variant="body1" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                      {errorCount.toLocaleString()}
                    </Typography>
                  </Box>

                  {/* Adoption (Sessions) */}
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      {Number(r.total_sessions).toLocaleString()}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {r.error_trend && r.error_trend.length > 1 && (
                        <ArgusSparkline data={r.error_trend} width={70} height={20} color={isDark ? '#555' : '#ccc'} />
                      )}
                    </Box>
                  </Box>

                  {/* Performance */}
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                      <SpeedIcon sx={{ fontSize: 14 }} /> {p95 > 0 ? `${Math.round(p95)}ms` : '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                      {txnCount.toLocaleString()} txns
                    </Typography>
                  </Box>

                </Box>
              );
            })}
          </Box>
        )}
      </PageContentLoader>
    </Box>
  );
};

// --- Sub-components ---

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return dateStr; }
}

export default ArgusReleasesPage;
