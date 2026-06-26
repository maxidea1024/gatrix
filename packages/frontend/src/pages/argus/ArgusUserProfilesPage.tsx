import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  TextField,
  InputAdornment,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  IconButton,
  Tooltip,
  Button,
  Skeleton,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Star as StarIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import PageContentLoader from '@/components/common/PageContentLoader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import SimplePagination from '@/components/common/SimplePagination';
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import { useOrgProject } from '@/contexts/OrgProjectContext';

import {
  getUserProfiles,
  getUserProfileFacets,
  getUserCohortMemberships,
} from '@/services/argus/argusAnalytics';
import type { ArgusUserProfile } from '@/services/argus/argusTypes';
import type { CohortMembership } from '@/components/argus/CohortChip';

import {
  QueryAQLEditor,
  USER_PROFILES_CONFIG,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import FacetSidebar, { type FacetGroup } from '@/components/argus/FacetSidebar';
import { useResizableSplit } from '@/hooks/useResizableSplit';

import UserProfileListItem from '@/components/userProfiles/UserProfileListItem';
import UserProfileStatsBar from '@/components/userProfiles/UserProfileStatsBar';

import {
  PageContainer,
  SplitContainer,
  SplitterHandle,
  PaginationWrapper,
  TotalCountChip,
} from './ArgusUserProfilesPage.styles';

const STATS_COLLAPSED_KEY = 'argus_user_profiles_stats_collapsed';
const FACET_COLLAPSED_KEY = 'argus_user_profiles_facet_collapsed';
const FACET_WIDTH_KEY = 'argus_user_profiles_facet_width';

const DEFAULT_FACET_WIDTH = 230;
const MIN_FACET_WIDTH = 180;
const MAX_FACET_WIDTH = 380;

type SortField =
  | 'last_seen'
  | 'first_seen'
  | 'total_events'
  | 'total_sessions'
  | 'net_revenue'
  | 'purchase_count'
  | 'days_inactive';
type SortDir = 'asc' | 'desc';

const ArgusUserProfilesPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');
  const navigate = useNavigate();

  const [users, setUsers] = useState<ArgusUserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('last_seen');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    type: 'preset',
    preset: '30d',
  });

  const [aql, setAql] = useState('');
  const aqlEditorRef = useRef<QueryAQLEditorHandle>(null);

  // Facets state
  const [facets, setFacets] = useState<
    Record<string, { value: string; count: number }[]>
  >({});
  const [facetsLoading, setFacetsLoading] = useState(false);

  const [cohortMap, setCohortMap] = useState<
    Record<string, CohortMembership[]>
  >({});
  const [pageSize, setPageSize] = useGlobalPageSize();
  const initialLoadDone = useRef(false);

  // Stats collapsed
  const [statsCollapsed, setStatsCollapsed] = useState(() => {
    return localStorage.getItem(STATS_COLLAPSED_KEY) === 'true';
  });

  // Starred users
  const starStorageKey = `argus_starred_users_${projectId}`;
  const [starredUsers, setStarredUsers] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`argus_starred_users_${projectId}`);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  // Resizable Facet Sidebar
  const [facetCollapsed, setFacetCollapsed] = useState(() => {
    return localStorage.getItem(FACET_COLLAPSED_KEY) === 'true';
  });

  const {
    splitWidth: facetWidth,
    isDragging: isFacetDragging,
    handleMouseDown: handleFacetSplitterMouseDown,
    panelRef: facetPanelRef,
  } = useResizableSplit({
    storageKey: FACET_WIDTH_KEY,
    defaultWidth: DEFAULT_FACET_WIDTH,
    minWidth: MIN_FACET_WIDTH,
    maxWidth: MAX_FACET_WIDTH,
  });

  const handleToggleFacetCollapse = useCallback(() => {
    setFacetCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(FACET_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const toggleStar = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setStarredUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      try {
        localStorage.setItem(starStorageKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load facets
  const loadFacets = useCallback(async () => {
    if (!projectId) return;
    setFacetsLoading(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const data = await getUserProfileFacets(projectId, apiParams);
      setFacets(data);
    } catch (err) {
      console.error('Failed to load facets:', err);
    } finally {
      setFacetsLoading(false);
    }
  }, [projectId, dateRange]);

  // Load user list
  const loadUsers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const sortStr = sortDir === 'asc' ? `-${sortField}` : sortField;
      const result = await getUserProfiles(projectId, {
        limit: pageSize,
        offset: page * pageSize,
        sort: sortStr,
        search: searchDebounced || undefined,
        aql: aql || undefined,
        ...apiParams,
      });
      setUsers(result.data);
      setTotal(result.total);

      // Fetch cohort memberships
      if (result.data.length > 0) {
        getUserCohortMemberships(
          projectId,
          result.data.map((u) => u.user_id)
        )
          .then((m) => setCohortMap(m))
          .catch(() => setCohortMap({}));
      } else {
        setCohortMap({});
      }
    } catch {
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [
    projectId,
    page,
    pageSize,
    sortField,
    sortDir,
    searchDebounced,
    dateRange,
    aql,
  ]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, String(statsCollapsed));
  }, [statsCollapsed]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const fetchFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      try {
        const data = facets[fieldKey] || [];
        return data.map((d) => d.value);
      } catch {
        return [];
      }
    },
    [facets]
  );

  const facetGroups = useMemo<FacetGroup[]>(() => {
    return [
      {
        key: 'platform',
        label: t('argus.userProfiles.platform', 'Platform'),
        values: facets.platform || [],
      },
      {
        key: 'country',
        label: t('argus.userProfiles.country', 'Country'),
        values: facets.country || [],
      },
      {
        key: 'churn_risk',
        label: t('argus.userProfiles.churnRisk', 'Churn Risk'),
        values: facets.churn_risk || [],
      },
      {
        key: 'browser',
        label: t('argus.userProfiles.browser', 'Browser'),
        values: facets.browser || [],
      },
    ];
  }, [facets, t]);

  const displayedRows = useMemo(() => {
    const base = showStarredOnly
      ? users.filter((u) => starredUsers.has(u.user_id))
      : users;
    const starred = base.filter((u) => starredUsers.has(u.user_id));
    const rest = base.filter((u) => !starredUsers.has(u.user_id));
    const maxEvents = Math.max(...base.map((u) => u.total_events), 1);
    return { starred, rest, maxEvents };
  }, [users, starredUsers, showStarredOnly]);

  // Compute local stats from current page
  const stats = useMemo(() => {
    const totalUsers = total;
    const paidUsers = users.filter((u) => (u.net_revenue ?? 0) > 0).length;
    const avgRevenue =
      users.length > 0
        ? users.reduce((acc, u) => acc + (u.net_revenue ?? 0), 0) / users.length
        : 0;
    const churnRiskCount = users.filter(
      (u) => u.churn_risk === 'high' || u.churn_risk === 'medium'
    ).length;
    return { totalUsers, paidUsers, avgRevenue, churnRiskCount };
  }, [users, total]);

  return (
    <PageContainer>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
                to: '/argus/analytics',
              },
              { label: t('argus.userProfiles', 'User Profiles') },
            ]}
            size="title"
          />
        }
        subtitle={t(
          'argus.userProfiles.subtitle',
          'Explore individual user behavior and properties'
        )}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TotalCountChip label={t('argus.userProfiles.usersCount', '{{count}} users', { count: total })} />
            <DateRangeSelector value={dateRange} onChange={setDateRange} />
          </Box>
        }
      />

      <PageContentLoader
        loading={loading && !initialLoadDone.current}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, px: 2, pb: 2 }}
      >
        {/* AQL filter bar */}
        <Box
          sx={{
            mb: 1.5,
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <QueryAQLEditor
              ref={aqlEditorRef}
              config={USER_PROFILES_CONFIG}
              onSearch={(q) => {
                setAql(q);
                setPage(0);
              }}
              fetchFieldValues={fetchFieldValues}
              initialFacets={facets}
              placeholder={t(
                'argus.userProfiles.searchPlaceholder',
                'Search by user ID or property'
              )}
            />
          </Box>

          {/* Starred filter toggle */}
          <Tooltip
            title={
              showStarredOnly
                ? t('argus.userProfiles.showAll', 'Show all users')
                : t('argus.userProfiles.showStarred', 'Show starred only')
            }
          >
            <IconButton
              size="small"
              onClick={() => setShowStarredOnly((p) => !p)}
              sx={{
                border: '1px solid',
                borderColor: showStarredOnly ? 'warning.main' : 'divider',
                borderRadius: 1.5,
                color: showStarredOnly ? 'warning.main' : 'text.secondary',
                bgcolor: showStarredOnly ? alpha('#ffa726', 0.08) : 'transparent',
                '&:hover': {
                  borderColor: 'warning.main',
                  color: 'warning.main',
                },
                transition: 'all 0.15s ease',
                px: 1,
                gap: 0.5,
                display: 'flex',
                height: 36,
              }}
            >
              <StarIcon sx={{ fontSize: 16 }} />
              {starredUsers.size > 0 && (
                <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
                  {starredUsers.size}
                </Typography>
              )}
            </IconButton>
          </Tooltip>

          {/* Collapse stats button */}
          <Button
            size="small"
            variant="outlined"
            onClick={() => setStatsCollapsed((p) => !p)}
            sx={{
              height: 36,
              textTransform: 'none',
              borderColor: 'divider',
              color: 'text.secondary',
            }}
          >
            {statsCollapsed
              ? t('argus.userProfiles.showStats', 'Show Stats')
              : t('argus.userProfiles.hideStats', 'Hide Stats')}
          </Button>

          {/* Facet toggle button */}
          <Button
            size="small"
            variant="outlined"
            onClick={handleToggleFacetCollapse}
            startIcon={<FilterListIcon />}
            sx={{
              height: 36,
              textTransform: 'none',
              borderColor: facetCollapsed ? 'divider' : 'primary.main',
              color: facetCollapsed ? 'text.secondary' : 'primary.main',
              bgcolor: facetCollapsed ? 'transparent' : alpha(theme.palette.primary.main, 0.05),
            }}
          >
            {t('argus.userProfiles.facets', 'Facets')}
          </Button>
        </Box>

        {/* Folding Stats Card */}
        <UserProfileStatsBar
          statsCollapsed={statsCollapsed}
          totalUsers={stats.totalUsers}
          paidUsers={stats.paidUsers}
          avgRevenue={stats.avgRevenue}
          churnRiskCount={stats.churnRiskCount}
        />

        {/* Split container (FacetSidebar + Table list) */}
        <SplitContainer isDark={isDark}>
          <FacetSidebar
            ref={facetPanelRef as React.Ref<HTMLDivElement>}
            width={facetWidth}
            facets={facetGroups}
            onFilter={(key, value, exclude) => {
              aqlEditorRef.current?.upsertFieldChip(
                key,
                [value],
                exclude ? '!=' : '='
              );
            }}
            collapsed={facetCollapsed}
            onToggleCollapse={handleToggleFacetCollapse}
            loading={facetsLoading}
          />
          {!facetCollapsed && (
            <SplitterHandle
              isDragging={isFacetDragging}
              onMouseDown={handleFacetSplitterMouseDown}
            />
          )}

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                flex: 1,
                overflow: 'auto',
                border: 'none',
                bgcolor: 'transparent',
                opacity: loading && users.length > 0 ? 0.55 : 1,
                transition: 'opacity 0.15s ease',
                pointerEvents: loading ? 'none' : 'auto',
              }}
            >
              <Table
                stickyHeader
                sx={{
                  '& .MuiTableCell-root': { py: 1.2 },
                  '& .MuiTableHead-root .MuiTableCell-root': {
                    zIndex: 2,
                    bgcolor: isDark ? '#1e1e1e' : '#fff',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 36, p: '4px 8px' }} />
                    <TableCell sx={{ fontWeight: 700, width: 200 }}>
                      {t('argus.userProfiles.userId', 'User ID')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={sortField === 'last_seen'}
                        direction={sortField === 'last_seen' ? sortDir : 'desc'}
                        onClick={() => handleSort('last_seen')}
                      >
                        {t('argus.userProfiles.lastSeen', 'Last Seen')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={sortField === 'first_seen'}
                        direction={sortField === 'first_seen' ? sortDir : 'desc'}
                        onClick={() => handleSort('first_seen')}
                      >
                        {t('argus.userProfiles.firstSeen', 'First Seen')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 60, whiteSpace: 'nowrap' }} align="right">
                      <TableSortLabel
                        active={sortField === 'total_events'}
                        direction={sortField === 'total_events' ? sortDir : 'desc'}
                        onClick={() => handleSort('total_events')}
                      >
                        {t('argus.userProfiles.eventCount', 'Events')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 90, whiteSpace: 'nowrap' }} align="right">
                      <TableSortLabel
                        active={sortField === 'net_revenue'}
                        direction={sortField === 'net_revenue' ? sortDir : 'desc'}
                        onClick={() => handleSort('net_revenue')}
                      >
                        {t('argus.userProfiles.revenue', 'Revenue')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 60, whiteSpace: 'nowrap' }} align="right">
                      <TableSortLabel
                        active={sortField === 'purchase_count'}
                        direction={sortField === 'purchase_count' ? sortDir : 'desc'}
                        onClick={() => handleSort('purchase_count')}
                      >
                        {t('argus.userProfiles.purchases', 'Purchases')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 88, whiteSpace: 'nowrap', color: 'text.secondary', fontSize: 12 }}>
                      {t('argus.userProfiles.activityTrend', 'Activity')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      <TableSortLabel
                        active={sortField === 'total_sessions'}
                        direction={sortField === 'total_sessions' ? sortDir : 'desc'}
                        onClick={() => handleSort('total_sessions')}
                      >
                        {t('argus.userProfiles.sessions', 'Sessions')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} align="right">
                      <TableSortLabel
                        active={sortField === 'days_inactive'}
                        direction={sortField === 'days_inactive' ? sortDir : 'desc'}
                        onClick={() => handleSort('days_inactive')}
                      >
                        {t('argus.userProfiles.inactive', 'Inactive')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {t('argus.userProfiles.churnRisk', 'Churn')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('argus.userProfiles.platform', 'Platform')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('argus.userProfiles.browser', 'Browser')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('argus.userProfiles.country', 'Country')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('argus.userProfiles.cohorts', 'Cohorts')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && users.length === 0 ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        {Array.from({ length: 15 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <>
                      {/* Starred section */}
                      {displayedRows.starred.map((u) => (
                        <UserProfileListItem
                          key={u.user_id}
                          user={u}
                          onClick={() =>
                            navigate(`/argus/analytics/users/${encodeURIComponent(u.user_id)}`)
                          }
                          onStar={toggleStar}
                          isStarred={true}
                          isStarredSection={true}
                          cohorts={cohortMap[u.user_id]}
                          maxEvents={displayedRows.maxEvents}
                        />
                      ))}
                      {/* Divider between starred and rest */}
                      {displayedRows.starred.length > 0 &&
                        displayedRows.rest.length > 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={15}
                              sx={{
                                py: 0.5,
                                px: 2,
                                bgcolor: isDark
                                  ? 'rgba(255,255,255,0.03)'
                                  : 'rgba(0,0,0,0.03)',
                                borderBottom: 'none',
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: 'text.disabled',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.8,
                                }}
                              >
                                {t('argus.userProfiles.otherUsers', 'Other users')}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      {/* Rest */}
                      {displayedRows.rest.map((u) => (
                        <UserProfileListItem
                          key={u.user_id}
                          user={u}
                          onClick={() =>
                            navigate(`/argus/analytics/users/${encodeURIComponent(u.user_id)}`)
                          }
                          onStar={toggleStar}
                          isStarred={starredUsers.has(u.user_id)}
                          isStarredSection={false}
                          cohorts={cohortMap[u.user_id]}
                          maxEvents={displayedRows.maxEvents}
                        />
                      ))}
                    </>
                  )}
                  {!loading && users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={15} align="center" sx={{ py: 8 }}>
                        <PersonIcon
                          sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }}
                        />
                        <Typography color="text.secondary">
                          {t('argus.userProfiles.noUsers', 'No user profiles')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <PaginationWrapper isDark={isDark}>
              <SimplePagination
                count={total}
                page={page}
                rowsPerPage={pageSize}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              />
            </PaginationWrapper>
          </Box>
        </SplitContainer>
      </PageContentLoader>
    </PageContainer>
  );
};

export default ArgusUserProfilesPage;
