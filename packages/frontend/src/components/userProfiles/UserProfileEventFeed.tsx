import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  useTheme,
  Tooltip,
  Button,
} from '@mui/material';
import {
  ShoppingCart as PurchaseIcon,
  EmojiEvents as TrophyIcon,
  Error as ErrorIcon,
  Login as LoginIcon,
  Event as EventIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { getUserEvents, getUserEventVolume } from '@/services/argus/argusAnalytics';
import type { ArgusUserEvent } from '@/services/argus/argusTypes';
import SimplePagination from '@/components/common/SimplePagination';
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
} from '@/components/argus/ArgusFilterBar';
import { dateRangeToApiParams } from '@/components/common/DateRangeSelector';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import {
  QueryAQLEditor,
  USER_EVENTS_CONFIG,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import {
  SplitContainer,
  SplitterHandle,
  PaginationWrapper,
} from '@/pages/argus/ArgusUserProfilesPage.styles';
import PageContentLoader from '@/components/common/PageContentLoader';
import UserProfileEventDetailPanel from './UserProfileEventDetailPanel';

const CHART_COLLAPSED_KEY = 'argus-user-events-chart-collapsed';
const SPLIT_STORAGE_KEY = 'argus-user-events-detail-split';
const MIN_DETAIL_WIDTH = 280;
const MAX_DETAIL_WIDTH = 600;
const DEFAULT_DETAIL_WIDTH = 360;

interface UserProfileEventFeedProps {
  projectId: string;
  userId: string;
}

export const UserProfileEventFeed: React.FC<UserProfileEventFeedProps> = ({
  projectId,
  userId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [searchParams, setSearchParams] = useSearchParams();
  const dslEditorRef = useRef<QueryAQLEditorHandle>(null);

  // ─── Pagination ───
  const [pageSize, setPageSize] = useGlobalPageSize();
  const [page, setPage] = useState(0);

  // ─── Data ───
  const [events, setEvents] = useState<ArgusUserEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // ─── Volume ───
  const [volumeBuckets, setVolumeBuckets] = useState<string[]>([]);
  const [volumeCounts, setVolumeCounts] = useState<number[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [chartCollapsed, setChartCollapsed] = useState(
    () => localStorage.getItem(CHART_COLLAPSED_KEY) === 'true'
  );

  // ─── Filters ───
  const periodParam = searchParams.get('evtPeriod') || '30d';
  const startParam = searchParams.get('evtStart') || '';
  const endParam = searchParams.get('evtEnd') || '';
  const searchQuery = searchParams.get('evtSearch') || '';

  const [filters, setFilters] = useState<ArgusFilterState>(() =>
    defaultArgusFilterState(periodParam)
  );

  // URL → filters sync
  useEffect(() => {
    setFilters((prev) => {
      if (periodParam === 'custom' && startParam && endParam) {
        return {
          ...prev,
          dateRange: { type: 'custom', start: new Date(startParam), end: new Date(endParam) },
        };
      }
      return { ...prev, dateRange: { type: 'preset', preset: periodParam } };
    });
  }, [periodParam, startParam, endParam]);

  // Safety: custom without start/end → fallback
  useEffect(() => {
    if (periodParam === 'custom' && (!startParam || !endParam)) {
      const params = new URLSearchParams(searchParams);
      params.set('evtPeriod', '30d');
      params.delete('evtStart');
      params.delete('evtEnd');
      setSearchParams(params, { replace: true });
    }
  }, [periodParam, startParam, endParam, searchParams, setSearchParams]);

  useEffect(() => {
    localStorage.setItem(CHART_COLLAPSED_KEY, String(chartCollapsed));
  }, [chartCollapsed]);

  // ─── Selected Event ───
  const [selectedEvent, setSelectedEvent] = useState<ArgusUserEvent | null>(null);

  const {
    splitWidth: detailWidth,
    isDragging: isDetailDragging,
    handleMouseDown: handleDetailSplitterMouseDown,
    panelRef: detailPanelRef,
  } = useResizableSplit({
    storageKey: SPLIT_STORAGE_KEY,
    defaultWidth: DEFAULT_DETAIL_WIDTH,
    minWidth: MIN_DETAIL_WIDTH,
    maxWidth: MAX_DETAIL_WIDTH,
    invertDelta: true,
  });

  // ─── API params ───
  const apiDateParams = useMemo(
    () => dateRangeToApiParams(filters.dateRange),
    [filters.dateRange]
  );

  // ─── Fetch Events ───
  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setSelectedEvent(null);
    try {
      const result = await getUserEvents(projectId, userId, {
        limit: pageSize,
        offset: page * pageSize,
        period: apiDateParams.period,
        start: apiDateParams.start,
        end: apiDateParams.end,
        search: searchQuery || undefined,
      });
      setEvents(result.data);
      setTotal(result.total || 0);
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, page, pageSize, apiDateParams, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Fetch Volume ───
  const fetchVolume = useCallback(async () => {
    if (!userId) return;
    setVolumeLoading(true);
    try {
      const result = await getUserEventVolume(projectId, userId, {
        period: apiDateParams.period,
        start: apiDateParams.start,
        end: apiDateParams.end,
        search: searchQuery || undefined,
      });
      setVolumeBuckets(result.buckets);
      setVolumeCounts(result.counts);
    } catch (err) {
      console.error('Failed to load volume:', err);
    } finally {
      setVolumeLoading(false);
    }
  }, [projectId, userId, apiDateParams, searchQuery]);

  useEffect(() => {
    fetchVolume();
  }, [fetchVolume]);

  // ─── Handlers ───
  const handleFilterChange = useCallback(
    (newFilters: ArgusFilterState) => {
      setFilters(newFilters);
      setPage(0);
      const params = new URLSearchParams(searchParams);
      if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
        params.set('evtPeriod', newFilters.dateRange.preset);
        params.delete('evtStart');
        params.delete('evtEnd');
      } else if (
        newFilters.dateRange.type === 'custom' &&
        newFilters.dateRange.start &&
        newFilters.dateRange.end
      ) {
        params.set('evtPeriod', 'custom');
        params.set('evtStart', newFilters.dateRange.start.toISOString());
        params.set('evtEnd', newFilters.dateRange.end.toISOString());
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSearch = useCallback(
    (query: string) => {
      setPage(0);
      const params = new URLSearchParams(searchParams);
      if (query) {
        params.set('evtSearch', query);
      } else {
        params.delete('evtSearch');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Chart zoom → custom date range
  const handleChartZoom = useCallback(
    (startIdx: number, endIdx: number) => {
      const si = Math.min(startIdx, endIdx);
      const ei = Math.max(startIdx, endIdx);
      if (volumeBuckets[si] && volumeBuckets[ei]) {
        const startDate = new Date(volumeBuckets[si]);
        let endDate = new Date(volumeBuckets[ei]);
        if (volumeBuckets.length > 1) {
          const gap =
            new Date(volumeBuckets[1]).getTime() - new Date(volumeBuckets[0]).getTime();
          endDate = new Date(endDate.getTime() + gap);
        } else {
          endDate = new Date(endDate.getTime() + 3600000);
        }
        setPage(0);
        const params = new URLSearchParams(searchParams);
        params.set('evtPeriod', 'custom');
        params.set('evtStart', startDate.toISOString());
        params.set('evtEnd', endDate.toISOString());
        setSearchParams(params, { replace: true });
      }
    },
    [volumeBuckets, searchParams, setSearchParams]
  );

  // ─── Chart data ───
  const chartDatasets = useMemo(
    () => [
      {
        label: t('argus.userProfiles.events', 'Events'),
        data: volumeCounts,
        backgroundColor: theme.palette.primary.main,
        borderColor: theme.palette.primary.main,
      },
    ],
    [volumeCounts, theme.palette.primary.main, t]
  );

  const chartLabels = useMemo(() => {
    return volumeBuckets.map((b) => {
      const d = new Date(b);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
  }, [volumeBuckets]);

  // ─── Event icon ───
  const getEventIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('purchase') || n.includes('buy') || n.includes('pay')) {
      return <PurchaseIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />;
    }
    if (n.includes('quest') || n.includes('level') || n.includes('achievement')) {
      return <TrophyIcon sx={{ color: '#ffb300', fontSize: 18 }} />;
    }
    if (n.includes('error') || n.includes('crash') || n.includes('fail')) {
      return <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 18 }} />;
    }
    if (n.includes('login') || n.includes('start') || n.includes('session') || n.includes('join')) {
      return <LoginIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />;
    }
    return <EventIcon sx={{ color: 'text.secondary', fontSize: 18 }} />;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter Bar */}
      <Box sx={{ flexShrink: 0, px: 1.5, pt: 1.5 }}>
        <ArgusFilterBar
          projectId={projectId}
          value={filters}
          onChange={handleFilterChange}
          onRefresh={fetchData}
          loading={loading}
          hideEnvironment
          noBorder
          extraControls={
            <>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <QueryAQLEditor
                  ref={dslEditorRef}
                  config={USER_EVENTS_CONFIG}
                  initialQuery={searchQuery}
                  onSearch={handleSearch}
                  onChange={() => {}}
                  placeholder={t(
                    'argus.userProfiles.eventSearchPlaceholder',
                    'Search events… e.g. event_name=purchase'
                  )}
                />
              </Box>
              <Button
                size="small"
                startIcon={chartCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                onClick={() => setChartCollapsed(!chartCollapsed)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {chartCollapsed
                  ? t('argus.userProfiles.showChart', 'Show Chart')
                  : t('argus.userProfiles.hideChart', 'Hide Chart')}
              </Button>
            </>
          }
        />
      </Box>

      <PageContentLoader loading={!hasLoaded} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Volume Chart */}
      {!chartCollapsed && (
        <Box sx={{ flexShrink: 0, mb: 1, px: 1.5 }}>
          <ArgusVolumeChart
            datasets={chartDatasets}
            labels={chartLabels}
            rawPeriods={volumeBuckets}
            loading={volumeLoading}
            onZoom={handleChartZoom}
            storagePrefix="argus_user_events"
            showCompactToggle={false}
            mb={0}
          />
        </Box>
      )}

      {/* ═══════ SPLIT-PANEL: List + Detail (일체형) ═══════ */}
      <SplitContainer isDark={isDark} sx={{ mx: 1.5, mb: 1.5 }}>
        {/* ─── LEFT: Event List ─── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <TableContainer
            sx={{
              flex: 1,
              overflow: 'auto',
              opacity: loading && hasLoaded ? 0.55 : 1,
              transition: 'opacity 0.15s ease',
              pointerEvents: loading && hasLoaded ? 'none' : 'auto',
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50, bgcolor: 'background.paper' }}></TableCell>
                  <TableCell sx={{ minWidth: 160, fontWeight: 600, bgcolor: 'background.paper' }}>
                    {t('argus.userProfiles.eventName', 'Event Name')}
                  </TableCell>
                  <TableCell sx={{ minWidth: 180, fontWeight: 600, bgcolor: 'background.paper' }}>
                    {t('argus.userProfiles.timestamp', 'Time')}
                  </TableCell>
                  <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'background.paper' }}>
                    {t('argus.userProfiles.sessionId', 'Session ID')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
              {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                      {t('argus.userProfiles.noEventsFound', 'No events found.')}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((evt, idx) => {
                    const isActive = selectedEvent?.event_id === evt.event_id && selectedEvent?.timestamp === evt.timestamp;
                    return (
                      <TableRow
                        key={`${evt.event_id}-${idx}`}
                        hover
                        selected={isActive}
                        onClick={() => setSelectedEvent(isActive ? null : evt)}
                        sx={{
                          cursor: 'pointer',
                          ...(isActive && {
                            bgcolor: isDark
                              ? 'rgba(124,77,255,0.08)'
                              : 'rgba(124,77,255,0.06)',
                          }),
                        }}
                      >
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Tooltip title={evt.event_name}>
                              {getEventIcon(evt.event_name)}
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {evt.event_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(evt.timestamp).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                            {evt.session_id || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

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

        {/* ─── Splitter ─── */}
        <SplitterHandle
          isDragging={isDetailDragging}
          onMouseDown={handleDetailSplitterMouseDown}
        />

        {/* ─── RIGHT: Detail Panel (항상 표시) ─── */}
        <Box
          ref={detailPanelRef as React.Ref<HTMLDivElement>}
          sx={{
            width: detailWidth,
            minWidth: MIN_DETAIL_WIDTH,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {selectedEvent ? (
            <UserProfileEventDetailPanel
              event={selectedEvent}
            />
          ) : (
            <EmptyPlaceholder
              message={t(
                'argus.userProfiles.selectEventForDetails',
                'Select an event to view details'
              )}
              sx={{ border: 'none', height: '100%' }}
            />
          )}
        </Box>
      </SplitContainer>
      </PageContentLoader>
    </Box>
  );
};

export default UserProfileEventFeed;
