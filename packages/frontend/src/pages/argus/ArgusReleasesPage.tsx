import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
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
} from '@mui/icons-material';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import { formatRelativeTime } from '@/utils/dateFormat';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useArgusReleaseStore } from '@/hooks/useArgusReleaseStore';
import PageContentLoader from '@/components/common/PageContentLoader';
import SimplePagination from '@/components/common/SimplePagination';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { formatCompactNumber } from '@/utils/numberFormat';
import argusService, { ArgusRelease } from '@/services/argusService';
import ArgusSparkline from '@/components/argus/ArgusSparkline';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams as argusDateRangeToApiParams } from '@/components/common/DateRangeSelector';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import {
  QueryDSLEditor,
  parse,
  RELEASES_CONFIG,
  type QueryDSLEditorHandle,
} from '@/components/argus/query-dsl';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';
import { evaluateAST } from './components/releasesHelpers';

const PAGE_SIZE_STORAGE_KEY = 'argus:releases:pageSize';
const DEEP_LINK_KEYS = ['page', 'search', 'sort'];

const ArgusReleasesPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const URL_PARAMS = useMemo(
    () => ({
      period: {
        key: 'period',
        default: '90d',
        storageKey: 'argus-releases-period',
      },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  // ─── Zustand Store ──────────────────────────────────────────────
  const currentPage = useArgusReleaseStore((s) => s.currentPage);
  const searchTerm = useArgusReleaseStore((s) => s.searchTerm);
  const sortBy = useArgusReleaseStore((s) => s.sortBy);

  const setCurrentPage = useArgusReleaseStore((s) => s.setCurrentPage);
  const setSearchTerm = useArgusReleaseStore((s) => s.setSearchTerm);
  const setSortBy = useArgusReleaseStore((s) => s.setSortBy);
  const hydrateFromParams = useArgusReleaseStore((s) => s.hydrateFromParams);
  const resetStore = useArgusReleaseStore((s) => s.resetStore);

  // ─── Mount Initialization ──────────────────────────────────────
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // 1. GNB/Sidebar reset: MainLayout passes { fromSidebar: true }
    if ((location.state as any)?.fromSidebar) {
      resetStore();
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    // 2. Deep-link hydration
    const hasDeepLinkParams = DEEP_LINK_KEYS.some((k) => searchParams.has(k));
    if (hasDeepLinkParams) {
      resetStore();
      const hydration: Record<string, unknown> = {};
      const urlPage = searchParams.get('page');
      const urlSearch = searchParams.get('search');
      const urlSort = searchParams.get('sort');

      if (urlPage) hydration.currentPage = parseInt(urlPage, 10);
      if (urlSearch) hydration.searchTerm = urlSearch;
      if (urlSort) hydration.sortBy = urlSort;

      hydrateFromParams(hydration);
      navigate(location.pathname, { replace: true });
    }
    // 3. Breadcrumb return: Zustand retains previous state automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Local-only UI State ────────────────────────────────────────
  const [releases, setReleases] = useState<ArgusRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ArgusFilterState>(() =>
    defaultArgusFilterState(urlState.period)
  );
  const [sortAnchor, setSortAnchor] = useState<null | HTMLElement>(null);
  const dslEditorRef = useRef<QueryDSLEditorHandle>(null);

  const sortOptions = useMemo(
    () => [
      { value: 'date' as const, label: t('argus.releases.sortDate', '최신순') },
      {
        value: 'crash_free' as const,
        label: t('argus.releases.sortCrashFree', '크래시 프리 낮은순'),
      },
      {
        value: 'sessions' as const,
        label: t('argus.releases.sortSessions', '세션 많은순'),
      },
      {
        value: 'errors' as const,
        label: t('argus.releases.sortErrors', '에러 많은순'),
      },
    ],
    [t]
  );

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { type: 'preset', preset: urlState.period },
    }));
  }, [urlState.period]);

  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const saved = Number(stored);
    return !isNaN(saved) && saved > 0 ? saved : 20;
  });

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  const handlePageChange = (_: unknown, page: number) => {
    setCurrentPage(page);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      // Backend getReleases api might not support environment/browser/os yet,
      // but we pass them anyway or just let it ignore.
      // Wait, getReleases only accepts (projectId, period, start, end)
      const data = await argusService.getReleases(
        projectId,
        ap.period,
        ap.start,
        ap.end
      );

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset });
    }
  };

  // Summary stats across all releases
  const totalErrors = releases.reduce((s, r) => s + Number(r.error_count), 0);
  const totalUsers = releases.reduce((s, r) => s + Number(r.affected_users), 0);
  const avgCrashFree =
    releases.length > 0
      ? releases.reduce((s, r) => s + Number(r.crash_free_rate), 0) /
        releases.length
      : 100;

  const total = releases.length;

  // --- Adoption Stage ---
  const totalSessionsAll = releases.reduce(
    (s, r) => s + Number(r.total_sessions),
    0
  );

  const maxErrorCount = useMemo(() => {
    return Math.max(...releases.map((r) => Number(r.error_count)), 1);
  }, [releases]);
  const getAdoptionStage = (
    r: ArgusRelease
  ): 'adopted' | 'low' | 'replaced' => {
    if (totalSessionsAll === 0) return 'low';
    const pct = (Number(r.total_sessions) / totalSessionsAll) * 100;
    return pct >= 10 ? 'adopted' : 'low';
  };

  const fetchFieldValues = useCallback(
    async (fieldKey: string) => {
      if (fieldKey === 'release' || fieldKey === 'version') {
        return Array.from(new Set(releases.map((r) => r.release)));
      }
      return [];
    },
    [releases]
  );

  // --- Filter & Sort ---
  const filteredReleases = useMemo(() => {
    let result = [...releases];

    // Search using DSL Query Parser
    if (searchTerm.trim()) {
      try {
        const { ast } = parse(searchTerm);
        if (ast) {
          result = result.filter((r) => evaluateAST(ast, r, totalSessionsAll));
        } else {
          const term = searchTerm.toLowerCase();
          result = result.filter((r) => r.release.toLowerCase().includes(term));
        }
      } catch (err) {
        const term = searchTerm.toLowerCase();
        result = result.filter((r) => r.release.toLowerCase().includes(term));
      }
    }

    // Sort
    switch (sortBy) {
      case 'crash_free':
        result.sort(
          (a, b) => Number(a.crash_free_rate) - Number(b.crash_free_rate)
        );
        break;
      case 'sessions':
        result.sort(
          (a, b) => Number(b.total_sessions) - Number(a.total_sessions)
        );
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
  }, [releases, searchTerm, sortBy, totalSessionsAll]);

  const filteredTotal = filteredReleases.length;
  const paginatedReleases = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredReleases.slice(start, start + rowsPerPage);
  }, [filteredReleases, currentPage, rowsPerPage]);

  // ─── Stable callback handlers (for React.memo) ─────────────────
  const handleSortOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget),
    []
  );
  const handleSortClose = useCallback(() => setSortAnchor(null), []);
  const handleSortSelect = useCallback(
    (v: string) => setSortBy(v as typeof sortBy),
    [setSortBy]
  );

  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<ReleaseIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('argus.releases.title') }]}
          />
        }
        subtitle={t('argus.releases.subtitle')}
        actions={
          !loading &&
          releases.length > 0 && (
            <Chip
              label={`${releases.length} ${t('argus.releases.releasesLabel')}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 22,
                backgroundColor: alpha('#7c4dff', 0.1),
                color: '#7c4dff',
                border: 'none',
              }}
            />
          )
        }
      />

      {/* Filter Bar */}
      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={(newFilters) => {
          const prevEnvs = filters.environments;
          const newEnvs = newFilters.environments;
          if (
            prevEnvs.length !== newEnvs.length ||
            prevEnvs.some((e, i) => e !== newEnvs[i])
          ) {
            dslEditorRef.current?.upsertFieldChip('environment', newEnvs);
          }
          handleFilterChange(newFilters);
        }}
        loading={loading}
      />

      {/* Summary Stats */}
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 2,
          py: 0.75,
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.01)',
        }}
      >
        {[
          {
            icon: <ReleaseIcon />,
            label: t('argus.releases.releasesLabel'),
            value: releases.length,
            color: '#7c4dff',
          },
          {
            icon: <BugReportIcon />,
            label: t('argus.releases.totalErrors'),
            value: totalErrors,
            color: '#f44336',
          },
          {
            icon: <PeopleIcon />,
            label: t('argus.releases.affectedUsers'),
            value: totalUsers,
            color: '#2196f3',
          },
          {
            icon: <CheckIcon />,
            label: t('argus.releases.avgCrashFree'),
            value: `${avgCrashFree.toFixed(1)}%`,
            color: '#4caf50',
          },
        ].map((card, idx, arr) => (
          <React.Fragment key={idx}>
            <Box sx={{ flex: 1, textAlign: 'center', py: 0.5 }}>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  lineHeight: 1.1,
                  fontSize: '1.35rem',
                  color: card.color,
                  fontFamily: 'monospace',
                  mb: 0.25,
                }}
              >
                {typeof card.value === 'number'
                  ? formatCompactNumber(card.value)
                  : card.value}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}
              >
                {React.cloneElement(card.icon as React.ReactElement, {
                  sx: { fontSize: 13, color: 'text.secondary' },
                })}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {card.label}
                </Typography>
              </Box>
            </Box>
            {idx < arr.length - 1 && (
              <Divider
                orientation="vertical"
                flexItem
                sx={{
                  mx: 1,
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </Paper>

      <PageContentLoader loading={loading}>
        {releases.length === 0 ? (
          <EmptyPlaceholder
            icon={<ReleaseIcon sx={{ fontSize: 48 }} />}
            message={t('argus.releases.noReleases')}
            minHeight={200}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Search & Sort Bar */}
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <QueryDSLEditor
                  ref={dslEditorRef}
                  config={RELEASES_CONFIG}
                  initialQuery={searchTerm}
                  placeholder={t(
                    'argus.releases.searchPlaceholder',
                    'Search releases... e.g. errors > 10 status:adopted'
                  )}
                  onSearch={(val) => {
                    setSearchTerm(val);
                    setCurrentPage(1);
                  }}
                  onChange={(val) => {
                    setSearchTerm(val);
                    setCurrentPage(1);
                  }}
                  fetchFieldValues={fetchFieldValues}
                />
              </Box>
              <FilterChipSelect
                label={t('argus.releases.sortLabel', '정렬')}
                value={sortBy}
                options={sortOptions}
                anchorEl={sortAnchor}
                onOpen={handleSortOpen}
                onClose={handleSortClose}
                onSelect={handleSortSelect}
                sx={{ height: 32 }}
              />
              {searchTerm && (
                <Typography variant="caption" color="text.secondary">
                  {filteredTotal} / {total}{' '}
                  {t('argus.releases.releasesLabel', 'releases')}
                </Typography>
              )}
            </Box>

            {filteredReleases.length === 0 ? (
              <Box sx={{ mt: 1 }}>
                <EmptyPlaceholder
                  icon={<SearchIcon sx={{ fontSize: 36 }} />}
                  message={t(
                    'argus.releases.noFilteredReleases',
                    'No releases match your search.'
                  )}
                  description={t(
                    'argus.releases.checkSearchConditions',
                    'Please check your search conditions or clear filters.'
                  )}
                  minHeight={160}
                />
              </Box>
            ) : (
              <>
                {/* Table Header */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(200px, 2fr) 1.5fr 1.5fr 1.3fr 1.2fr 1.5fr 1fr',
                    gap: 2.5,
                    px: 3,
                    py: 1,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(0,0,0,0.02)',
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t('argus.releases.version', 'VERSION')}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t(
                      'argus.releases.crashFreeSessions',
                      'CRASH FREE SESSIONS'
                    )}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t('argus.releases.crashFreeUsers', 'CRASH FREE USERS')}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t('argus.releases.newIssues', 'NEW ISSUES')}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t('argus.releases.totalErrors', 'TOTAL ERRORS')}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t('argus.releases.sessions', 'ADOPTION (SESSIONS)')}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t('argus.releases.perf', 'PERFORMANCE')}
                  </Typography>
                </Box>

                {paginatedReleases.map((r, idx) => {
                  const crashFree = Number(r.crash_free_rate);
                  const isHotfix = r.release.includes('hotfix');
                  const statusColor =
                    crashFree >= 99
                      ? '#4caf50'
                      : crashFree >= 95
                        ? '#ff9800'
                        : '#f44336';
                  const errorCount = Number(r.error_count);
                  const fatalCount = Number(r.fatal_count || 0);
                  const unhandledCount = Number(r.unhandled_count || 0);
                  const txnCount = Number(r.transaction_count || 0);
                  const avgDur = Number(r.avg_duration || 0);
                  const p95 = Number(r.p95 || 0);
                  const prevRelease = releases[idx + 1];
                  const crashFreeDelta = prevRelease
                    ? crashFree - Number(prevRelease.crash_free_rate)
                    : 0;
                  const crashFreeUsers = Number(r.crash_free_users);
                  const crashFreeUsersDelta = prevRelease
                    ? crashFreeUsers - Number(prevRelease.crash_free_users)
                    : 0;
                  const newIssues = Number(r.new_issues);

                  return (
                    <Box
                      key={`${r.release}-${idx}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns:
                          'minmax(200px, 2fr) 1.5fr 1.5fr 1.3fr 1.2fr 1.5fr 1fr',
                        gap: 2.5,
                        alignItems: 'center',
                        px: 3,
                        py: 1.25,
                        mb: 0.75,
                        borderRadius: '6px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        borderLeft: `4px solid ${statusColor}`,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.015)'
                          : '#fff',
                        transition: 'all 0.2s ease-in-out',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: isDark
                            ? '0 4px 12px rgba(0,0,0,0.4)'
                            : '0 4px 12px rgba(0,0,0,0.05)',
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.005)',
                        },
                        '@keyframes pulse': {
                          '0%': { opacity: 0.6 },
                          '50%': { opacity: 1 },
                          '100%': { opacity: 0.6 },
                        },
                      }}
                      onClick={() =>
                        navigate(
                          `/argus/releases/${projectId}/${encodeURIComponent(r.release)}`
                        )
                      }
                    >
                      {/* Version */}
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            fontWeight={800}
                            sx={{
                              fontSize: '0.85rem',
                              fontFamily: 'monospace',
                              color: 'text.primary',
                            }}
                          >
                            {r.release}
                          </Typography>
                          {isHotfix && (
                            <Chip
                              label={t('argus.releases.hotfix', 'HOTFIX')}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                backgroundColor: alpha('#ff9800', 0.15),
                                color: '#ff9800',
                                border: 'none',
                              }}
                            />
                          )}
                          {(() => {
                            const stage = getAdoptionStage(r);
                            const stageColor =
                              stage === 'adopted' ? '#4caf50' : '#ff9800';
                            const stageLabel =
                              stage === 'adopted'
                                ? t('argus.releases.adopted', 'Adopted')
                                : t('argus.releases.lowAdoption', 'Low');
                            return (
                              <Chip
                                label={stageLabel}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.55rem',
                                  fontWeight: 700,
                                  backgroundColor: alpha(stageColor, 0.1),
                                  color: stageColor,
                                  border: 'none',
                                }}
                              />
                            );
                          })()}
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <ScheduleIcon
                            sx={{
                              fontSize: 13,
                              color: isDark ? '#666' : '#bbb',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ fontSize: '0.7rem', color: 'text.disabled' }}
                          >
                            {formatRelativeTime(r.first_seen)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Crash-Free Sessions */}
                      <Box>
                        <Typography
                          variant="subtitle2"
                          fontWeight={800}
                          sx={{
                            color: statusColor,
                            lineHeight: 1.2,
                            fontSize: '0.85rem',
                          }}
                        >
                          {crashFree.toFixed(2)}%
                        </Typography>
                        <Box sx={{ width: '100%', mt: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={crashFree}
                            sx={{
                              height: 3,
                              borderRadius: 1,
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.08)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: statusColor,
                              },
                            }}
                          />
                        </Box>
                        {prevRelease && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mt: 0.5,
                            }}
                          >
                            <Chip
                              label={`${crashFreeDelta > 0 ? '+' : ''}${crashFreeDelta.toFixed(2)}%`}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                backgroundColor: alpha(
                                  crashFreeDelta >= 0 ? '#4caf50' : '#f44336',
                                  0.1
                                ),
                                color:
                                  crashFreeDelta >= 0 ? '#4caf50' : '#f44336',
                                border: 'none',
                                '& .MuiChip-label': { px: 0.5 },
                              }}
                            />
                          </Box>
                        )}
                      </Box>

                      {/* Crash-Free Users */}
                      <Box>
                        <Typography
                          variant="subtitle2"
                          fontWeight={800}
                          sx={{
                            color:
                              crashFreeUsers >= 99
                                ? '#4caf50'
                                : crashFreeUsers >= 95
                                  ? '#ff9800'
                                  : '#f44336',
                            lineHeight: 1.2,
                            fontSize: '0.85rem',
                          }}
                        >
                          {crashFreeUsers.toFixed(2)}%
                        </Typography>
                        {(() => {
                          const userStatusColor =
                            crashFreeUsers >= 99
                              ? '#4caf50'
                              : crashFreeUsers >= 95
                                ? '#ff9800'
                                : '#f44336';
                          return (
                            <Box sx={{ width: '100%', mt: 0.5 }}>
                              <LinearProgress
                                variant="determinate"
                                value={crashFreeUsers}
                                sx={{
                                  height: 3,
                                  borderRadius: 1,
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'rgba(0,0,0,0.08)',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: userStatusColor,
                                  },
                                }}
                              />
                            </Box>
                          );
                        })()}
                        {prevRelease && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mt: 0.5,
                            }}
                          >
                            <Chip
                              label={`${crashFreeUsersDelta > 0 ? '+' : ''}${crashFreeUsersDelta.toFixed(2)}%`}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                backgroundColor: alpha(
                                  crashFreeUsersDelta >= 0
                                    ? '#4caf50'
                                    : '#f44336',
                                  0.1
                                ),
                                color:
                                  crashFreeUsersDelta >= 0
                                    ? '#4caf50'
                                    : '#f44336',
                                border: 'none',
                                '& .MuiChip-label': { px: 0.5 },
                              }}
                            />
                          </Box>
                        )}
                      </Box>

                      {/* New Issues */}
                      <Box>
                        {newIssues > 0 ? (
                          <Chip
                            icon={
                              <BugReportIcon
                                sx={{
                                  fontSize: '13px !important',
                                  animation: 'pulse 2s infinite ease-in-out',
                                }}
                              />
                            }
                            label={`${newIssues} ${t('argus.releases.new', 'New')}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              backgroundColor: alpha('#f44336', 0.1),
                              color: '#f44336',
                              border: 'none',
                              '& .MuiChip-icon': { color: '#f44336' },
                            }}
                          />
                        ) : (
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.disabled',
                              fontWeight: 500,
                              fontSize: '0.75rem',
                            }}
                          >
                            {t('argus.releases.noNewIssues', 'No new issues')}
                          </Typography>
                        )}
                      </Box>

                      {/* Total Errors */}
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          {errorCount > 100 && (
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: '#f44336',
                                display: 'inline-block',
                              }}
                            />
                          )}
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ fontSize: '0.85rem' }}
                          >
                            {formatCompactNumber(errorCount)}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: '100%',
                            mt: 0.5,
                            height: 4,
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.04)',
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: `${(errorCount / maxErrorCount) * 100}%`,
                              backgroundColor: alpha('#f44336', 0.6),
                              borderRadius: 1,
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Adoption (Sessions) */}
                      {(() => {
                        const adoptionPct =
                          totalSessionsAll > 0
                            ? (Number(r.total_sessions) / totalSessionsAll) *
                              100
                            : 0;
                        return (
                          <Box>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{ fontSize: '0.85rem' }}
                            >
                              {formatCompactNumber(Number(r.total_sessions))}
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: isDark ? '#aaa' : '#666',
                                  fontWeight: 500,
                                  marginLeft: 4,
                                }}
                              >
                                ({adoptionPct.toFixed(1)}%)
                              </span>
                            </Typography>
                            <Box
                              sx={{
                                width: '100%',
                                mt: 0.5,
                                height: 4,
                                bgcolor: isDark
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.04)',
                                borderRadius: 1,
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  width: `${adoptionPct}%`,
                                  backgroundColor: alpha('#7c4dff', 0.6),
                                  borderRadius: 1,
                                }}
                              />
                            </Box>
                            <Box
                              sx={{
                                mt: 0.75,
                                display: 'flex',
                                justifyContent: 'flex-start',
                              }}
                            >
                              {r.error_trend && r.error_trend.length > 1 && (
                                <ArgusSparkline
                                  data={r.error_trend}
                                  width={100}
                                  height={16}
                                  color={statusColor}
                                />
                              )}
                            </Box>
                          </Box>
                        );
                      })()}

                      {/* Performance */}
                      <Box>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            color: 'text.secondary',
                            fontSize: '0.8rem',
                          }}
                        >
                          <SpeedIcon
                            sx={{
                              fontSize: 14,
                              color: isDark ? '#aaa' : '#666',
                            }}
                          />{' '}
                          {p95 > 0 ? `${Math.round(p95)}ms` : '-'}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.disabled',
                            fontSize: '0.65rem',
                            display: 'block',
                            mt: 0.25,
                          }}
                        >
                          {formatCompactNumber(txnCount)}{' '}
                          {t('argus.releases.txns', 'txns')}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}
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
                setCurrentPage(1);
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
