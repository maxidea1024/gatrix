import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  LinearProgress,
  Tooltip,
  Divider,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
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
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Check as CheckMarkIcon,
} from '@mui/icons-material';
import { ActionChip } from '@/components/common/ActionChip';
import { formatRelativeTime } from '@/utils/dateFormat';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import PageContentLoader from '@/components/common/PageContentLoader';
import SimplePagination from '@/components/common/SimplePagination';
import { formatCompactNumber } from '@/utils/numberFormat';
import argusService, { ArgusRelease } from '@/services/argusService';
import ArgusSparkline from '@/components/argus/ArgusSparkline';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState } from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';

const PAGE_SIZE_STORAGE_KEY = 'argus:releases:pageSize';

const ArgusReleasesPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const URL_PARAMS = useMemo(() => ({
    period: { key: 'period', default: '90d', storageKey: 'argus-releases-period' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  const [releases, setReleases] = useState<ArgusRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ArgusFilterState>(
    () => defaultArgusFilterState(urlState.period)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'crash_free' | 'sessions' | 'errors'>('date');
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);

  const SORT_OPTIONS = useMemo(() => [
    { key: 'date' as const, label: t('argus.releases.sortDate', '최신순') },
    { key: 'crash_free' as const, label: t('argus.releases.sortCrashFree', '크래시 프리 낮은순') },
    { key: 'sessions' as const, label: t('argus.releases.sortSessions', '세션 많은순') },
    { key: 'errors' as const, label: t('argus.releases.sortErrors', '에러 많은순') },
  ], [t]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period }
    }));
  }, [urlState.period]);

  const currentPage = Number(searchParams.get('page') || 1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const saved = Number(stored);
    return !isNaN(saved) && saved > 0 ? saved : 20;
  });

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  const handlePageChange = (_: unknown, page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      // Backend getReleases api might not support environment/browser/os yet,
      // but we pass them anyway or just let it ignore.
      // Wait, getReleases only accepts (projectId, period, start, end)
      const data = await argusService.getReleases(projectId, ap.period, ap.start, ap.end);
      
      // Client-side filtering if applicable, or maybe backend will be updated to accept these.
      // For now, let's filter client-side just in case, or just do nothing with them.
      // Actually, releases don't have os/browser arrays on them. 
      // The issue is just the checkbox not working visually.
      setReleases(data || []);
    } catch (error) {
      console.error('Failed to fetch releases:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
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

  const total = releases.length;

  // --- Adoption Stage ---
  const totalSessionsAll = releases.reduce((s, r) => s + Number(r.total_sessions), 0);
  const getAdoptionStage = (r: ArgusRelease): 'adopted' | 'low' | 'replaced' => {
    if (totalSessionsAll === 0) return 'low';
    const pct = (Number(r.total_sessions) / totalSessionsAll) * 100;
    return pct >= 10 ? 'adopted' : 'low';
  };

  // --- Filter & Sort ---
  const filteredReleases = useMemo(() => {
    let result = [...releases];

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => r.release.toLowerCase().includes(term));
    }

    // Sort
    switch (sortBy) {
      case 'crash_free':
        result.sort((a, b) => Number(a.crash_free_rate) - Number(b.crash_free_rate));
        break;
      case 'sessions':
        result.sort((a, b) => Number(b.total_sessions) - Number(a.total_sessions));
        break;
      case 'errors':
        result.sort((a, b) => Number(b.error_count) - Number(a.error_count));
        break;
      case 'date':
      default:
        // Already sorted by date from backend
        break;
    }

    return result;
  }, [releases, searchTerm, sortBy]);

  const filteredTotal = filteredReleases.length;
  const paginatedReleases = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredReleases.slice(start, start + rowsPerPage);
  }, [filteredReleases, currentPage, rowsPerPage]);

  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<ReleaseIcon />}
        title={
          <ArgusBreadcrumbs size="title" paths={[
            { label: t('argus.releases.title') }
          ]} />
        }
        subtitle={t('argus.releases.subtitle')}
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
      <Paper elevation={0} sx={{
        display: 'flex', alignItems: 'center', mb: 3, py: 1.5,
        borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.015)'
      }}>
        {[
          { icon: <ReleaseIcon />, label: t('argus.releases.releasesLabel'), value: releases.length },
          { icon: <BugReportIcon />, label: t('argus.releases.totalErrors'), value: totalErrors },
          { icon: <PeopleIcon />, label: t('argus.releases.affectedUsers'), value: totalUsers },
          { icon: <CheckIcon />, label: t('argus.releases.avgCrashFree'), value: `${avgCrashFree.toFixed(1)}%` },
        ].map((card, idx, arr) => (
          <React.Fragment key={idx}>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                {React.cloneElement(card.icon as React.ReactElement, { sx: { fontSize: 16, color: 'text.secondary' } })}
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem' }}>
                  {card.label}
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1, fontSize: '1.2rem', color: 'text.primary' }}>
                {typeof card.value === 'number' ? formatCompactNumber(card.value) : card.value}
              </Typography>
            </Box>
            {idx < arr.length - 1 && (
              <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
            )}
          </React.Fragment>
        ))}
      </Paper>

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
            {/* Search & Sort Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <TextField
                size="small"
                placeholder={t('argus.releases.searchPlaceholder', 'Search releases...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flex: 1, maxWidth: 320,
                  '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.8rem' },
                }}
              />
              <ActionChip
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.disabled', fontWeight: 500 }}>
                      {t('argus.releases.sortLabel', '정렬')}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      {SORT_OPTIONS.find(o => o.key === sortBy)?.label}
                    </Typography>
                    <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.secondary', ml: -0.2 }} />
                  </Box>
                }
                onClick={(e) => setSortMenuAnchor(e.currentTarget)}
              />
              <Menu
                anchorEl={sortMenuAnchor}
                open={Boolean(sortMenuAnchor)}
                onClose={() => setSortMenuAnchor(null)}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              >
                {SORT_OPTIONS.map(opt => (
                  <MenuItem
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); setSortMenuAnchor(null); }}
                    selected={sortBy === opt.key}
                  >
                    <ListItemIcon>{sortBy === opt.key && <CheckMarkIcon fontSize="small" />}</ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '0.85rem' }}>
                      {opt.label}
                    </ListItemText>
                  </MenuItem>
                ))}
              </Menu>
              {searchTerm && (
                <Typography variant="caption" color="text.secondary">
                  {filteredTotal} / {total} {t('argus.releases.releasesLabel', 'releases')}
                </Typography>
              )}
            </Box>

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

            {paginatedReleases.map((r, idx) => {
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
                      <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.9rem' }}>
                        {r.release}
                      </Typography>
                      {isHotfix && (
                        <Chip label={t('argus.releases.hotfix', 'HOTFIX')} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, backgroundColor: alpha('#ff9800', 0.15), color: '#ff9800', border: 'none' }} />
                      )}
                      {(() => {
                        const stage = getAdoptionStage(r);
                        const stageColor = stage === 'adopted' ? '#4caf50' : '#ff9800';
                        const stageLabel = stage === 'adopted' ? t('argus.releases.adopted', 'Adopted') : t('argus.releases.lowAdoption', 'Low');
                        return (
                          <Chip label={stageLabel} size="small" sx={{
                            height: 16, fontSize: '0.55rem', fontWeight: 700,
                            backgroundColor: alpha(stageColor, 0.1), color: stageColor, border: 'none',
                          }} />
                        );
                      })()}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ScheduleIcon sx={{ fontSize: 13, color: isDark ? '#555' : '#bbb' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                        {formatRelativeTime(r.first_seen)}
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
                    <Typography variant="body1" fontWeight={700} >
                      {formatCompactNumber(errorCount)}
                    </Typography>
                  </Box>

                  {/* Adoption (Sessions) */}
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      {formatCompactNumber(Number(r.total_sessions))}
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
                      {formatCompactNumber(txnCount)} txns
                    </Typography>
                  </Box>

                </Box>
              );
            })}
          </Box>
        )}

        {filteredTotal > 0 && (
          <Box sx={{ mt: 3 }}>
            <SimplePagination
              count={filteredTotal}
              page={currentPage - 1}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => handlePageChange(_, newPage + 1)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                const params = new URLSearchParams(searchParams);
                params.set('page', '1');
                setSearchParams(params);
              }}
              size="small"
            />
          </Box>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default ArgusReleasesPage;
