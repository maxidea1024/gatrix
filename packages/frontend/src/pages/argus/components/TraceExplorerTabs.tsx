import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Timeline as TraceIcon,
  ArrowDownward as SortDescIcon,
  ArrowUpward as SortAscIcon,
  ViewColumn as ViewIcon,
  Terminal as LogsIcon,
  ExpandMore as LoadMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SafeTooltip from '@/components/common/SafeTooltip';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton } from '@/components/argus/ArgusSkeletons';
import { CopyButton } from '@/components/common/CopyButton';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { formatWith } from '@/utils/dateFormat';
import { getOpColor, formatDuration } from './traceExplorerHelpers';
import {
  TablePaper,
  SortableHeaderCell,
  GroupByToolbar,
  OpDot,
} from './TraceExplorerTabs.styles';

const SPAN_COLUMNS = [
  'timestamp',
  'op',
  'description',
  'duration',
  'status',
  'trace_id',
];

/* ═══════════════════════════════════════════════════
   Load More Footer (shared between tabs)
   ═══════════════════════════════════════════════════ */

const LoadMoreFooter: React.FC<{
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  isDark: boolean;
}> = ({ hasMore, loading, onLoadMore, isDark }) => {
  const { t } = useTranslation();
  if (!hasMore) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        py: 1.5,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      }}
    >
      <Button
        size="small"
        variant="text"
        onClick={onLoadMore}
        disabled={loading}
        startIcon={
          loading ? (
            <CircularProgress size={14} />
          ) : (
            <LoadMoreIcon sx={{ fontSize: 16 }} />
          )
        }
        sx={{
          textTransform: 'none',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderRadius: '6px',
          px: 2,
        }}
      >
        {loading
          ? t('argus.traces.loadingMore', 'Loading...')
          : t('argus.traces.loadMore', 'Load more')}
      </Button>
    </Box>
  );
};

/* ═══════════════════════════════════════════════════
   Mini Waterfall Bar (for Traces tab)
   ═══════════════════════════════════════════════════ */

const MiniWaterfallBar: React.FC<{
  operations: string[];
  totalDuration: number;
}> = ({ operations }) => {
  // Count occurrences of each op
  const opCounts = useMemo(() => {
    const counts = new Map<string, number>();
    operations.forEach((op) => {
      counts.set(op, (counts.get(op) || 0) + 1);
    });
    return counts;
  }, [operations]);

  const total = operations.length || 1;

  return (
    <SafeTooltip
      title={
        <Box sx={{ fontSize: '0.7rem' }}>
          {[...opCounts.entries()].map(([op, count]) => (
            <Box key={op} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '2px',
                  backgroundColor: getOpColor(op),
                  flexShrink: 0,
                }}
              />
              <span>
                {op}: {count}
              </span>
            </Box>
          ))}
        </Box>
      }
    >
      <Box
        sx={{
          display: 'flex',
          height: 14,
          borderRadius: '3px',
          overflow: 'hidden',
          minWidth: 60,
          maxWidth: 200,
          flex: 1,
        }}
      >
        {[...opCounts.entries()].map(([op, count], idx) => (
          <Box
            key={idx}
            sx={{
              width: `${(count / total) * 100}%`,
              minWidth: 2,
              backgroundColor: getOpColor(op),
              opacity: 0.8,
              transition: 'opacity 0.15s',
              '&:hover': { opacity: 1 },
            }}
          />
        ))}
      </Box>
    </SafeTooltip>
  );
};

// ─── Spans Tab ───

interface SpansTabProps {
  spans: any[];
  loading: boolean;
  orderCol: string;
  orderDir: 'asc' | 'desc';
  onColumnSort: (col: string) => void;
  onSelectSpan?: (span: any, index: number) => void;
  selectedSpanIndex?: number | null;
  onFilterTag?: (key: string, value: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export const SpansTab: React.FC<SpansTabProps> = React.memo(
  ({
    spans,
    loading,
    orderCol,
    orderDir,
    onColumnSort,
    onSelectSpan,
    selectedSpanIndex,
    onFilterTag,
    hasMore = false,
    loadingMore = false,
    onLoadMore,
  }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';
    const navigate = useNavigate();

    return (
      <TablePaper elevation={0} isDark={isDark}>
        <PageContentLoader loading={loading} skeleton={<TableSkeleton />}>
          {spans.length > 0 ? (
            <>
              <Table
                size="small"
                sx={{
                  '& td, & th': {
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    {SPAN_COLUMNS.map((col) => (
                      <SortableHeaderCell
                        key={col}
                        onClick={() =>
                          ['duration', 'timestamp'].includes(col)
                            ? onColumnSort(col)
                            : undefined
                        }
                        isActive={orderCol === col}
                        isSortable={['duration', 'timestamp'].includes(col)}
                      >
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}
                        >
                          {col === 'trace_id' ? 'TRACE' : col.toUpperCase()}
                          {orderCol === col &&
                            (orderDir === 'desc' ? (
                              <SortDescIcon sx={{ fontSize: 13 }} />
                            ) : (
                              <SortAscIcon sx={{ fontSize: 13 }} />
                            ))}
                        </Box>
                      </SortableHeaderCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {spans.map((span, idx) => (
                    <TableRow
                      key={idx}
                      hover
                      onClick={() => onSelectSpan?.(span, idx)}
                      sx={{
                        cursor: onSelectSpan ? 'pointer' : 'default',
                        backgroundColor:
                          selectedSpanIndex === idx
                            ? alpha(theme.palette.primary.main, 0.06)
                            : 'transparent',
                        '&:hover': {
                          backgroundColor: alpha(
                            theme.palette.primary.main,
                            selectedSpanIndex === idx ? 0.08 : 0.02
                          ),
                        },
                      }}
                    >
                      <TableCell sx={{ py: 0.8 }}>
                        <Typography
                          sx={{
                            fontSize: '0.73rem',
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatWith(span.timestamp, 'MMM D, HH:mm:ss')}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.8 }}>
                        <Chip
                          label={span.op || '—'}
                          size="small"
                          onClick={
                            onFilterTag
                              ? (e) => {
                                  e.stopPropagation();
                                  onFilterTag('op', span.op);
                                }
                              : undefined
                          }
                          sx={{
                            height: 20,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            backgroundColor: alpha(getOpColor(span.op), 0.12),
                            color: getOpColor(span.op),
                            borderRadius: '4px',
                            cursor: onFilterTag ? 'pointer' : 'default',
                            '&:hover': onFilterTag
                              ? {
                                  backgroundColor: alpha(
                                    getOpColor(span.op),
                                    0.25
                                  ),
                                }
                              : {},
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.8, maxWidth: 400 }}>
                        <SafeTooltip
                          title={
                            span.description && span.description.length >= 50
                              ? span.description
                              : ''
                          }
                        >
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {span.description || '—'}
                          </Typography>
                        </SafeTooltip>
                      </TableCell>
                      <TableCell sx={{ py: 0.8 }}>
                        <Typography
                          sx={{
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            color:
                              Number(span.duration) > 1000
                                ? theme.palette.error.main
                                : 'text.primary',
                          }}
                        >
                          {formatDuration(Number(span.duration))}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.8 }}>
                        <Typography
                          onClick={
                            onFilterTag && span.status
                              ? (e) => {
                                  e.stopPropagation();
                                  onFilterTag('status', span.status);
                                }
                              : undefined
                          }
                          sx={{
                            fontSize: '0.72rem',
                            cursor:
                              onFilterTag && span.status ? 'pointer' : 'default',
                            color:
                              span.status === 'ok'
                                ? theme.palette.success.main
                                : span.status && span.status !== ''
                                  ? theme.palette.error.main
                                  : 'text.disabled',
                            '&:hover':
                              onFilterTag && span.status
                                ? { textDecoration: 'underline' }
                                : {},
                          }}
                        >
                          {span.status || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.8 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Typography
                            onClick={(e) => {
                              e.stopPropagation();
                              if (span.trace_id) {
                                navigate(
                                  `/argus/performance?trace=${span.trace_id}`,
                                  { state: { allowBack: true } }
                                );
                              }
                            }}
                            sx={{
                              fontSize: '0.72rem',
                              color: theme.palette.primary.main,
                              cursor: 'pointer',
                              '&:hover': { textDecoration: 'underline' },
                            }}
                          >
                            {span.trace_id
                              ? String(span.trace_id).slice(0, 12) + '…'
                              : '—'}
                          </Typography>
                          {span.trace_id && (
                            <>
                              <SafeTooltip
                                title={t(
                                  'argus.traces.viewLogs',
                                  'View Logs'
                                )}
                              >
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/argus/explore/logs?q=trace_id:"${span.trace_id}"`
                                    );
                                  }}
                                  sx={{ p: 0.2 }}
                                >
                                  <LogsIcon
                                    sx={{
                                      fontSize: 12,
                                      color: 'text.disabled',
                                    }}
                                  />
                                </IconButton>
                              </SafeTooltip>
                              <CopyButton
                                text={span.trace_id}
                                size={12}
                                sx={{ p: 0.2 }}
                              />
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <LoadMoreFooter
                hasMore={hasMore}
                loading={loadingMore}
                onLoadMore={onLoadMore || (() => {})}
                isDark={isDark}
              />
            </>
          ) : !loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <TraceIcon
                sx={{
                  fontSize: 48,
                  color: alpha(theme.palette.primary.main, 0.15),
                  mb: 1,
                }}
              />
              <Typography
                sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}
              >
                {t('argus.traces.noSpans', 'No spans found')}
              </Typography>
              <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                {t(
                  'argus.traces.noSpansDesc',
                  'Try adjusting your filters or time range.'
                )}
              </Typography>
            </Box>
          ) : null}
        </PageContentLoader>
      </TablePaper>
    );
  }
);
SpansTab.displayName = 'SpansTab';

// ─── Traces Tab ───

interface TracesTabProps {
  traceSamples: any[];
  loading: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export const TracesTab: React.FC<TracesTabProps> = React.memo(
  ({ traceSamples, loading, hasMore = false, loadingMore = false, onLoadMore }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';
    const navigate = useNavigate();

    return (
      <TablePaper elevation={0} isDark={isDark}>
        <PageContentLoader loading={loading} skeleton={<TableSkeleton />}>
          {traceSamples.length > 0 ? (
            <>
              <Table
                size="small"
                sx={{
                  '& td, & th': {
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    {[
                      'TRACE ID',
                      t('argus.traces.startTime', 'START TIME'),
                      t('argus.traces.spanCount', 'SPANS'),
                      t('argus.traces.totalDuration', 'TOTAL DURATION'),
                      t('argus.traces.operations', 'OPERATIONS'),
                      t('argus.traces.errors', 'ERRORS'),
                      '',
                    ].map((header, idx) => (
                      <SortableHeaderCell
                        key={idx}
                        sx={idx === 6 ? { width: 40 } : {}}
                      >
                        {header}
                      </SortableHeaderCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {traceSamples.map((trace, idx) => {
                    const ops: string[] = Array.isArray(trace.operations)
                      ? trace.operations
                      : [];
                    return (
                      <TableRow
                        key={idx}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: alpha(
                              theme.palette.primary.main,
                              0.02
                            ),
                          },
                        }}
                        onClick={() =>
                          navigate(
                            `/argus/performance?trace=${trace.trace_id}`,
                            {
                              state: { allowBack: true },
                            }
                          )
                        }
                      >
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              color: theme.palette.primary.main,
                              fontWeight: 600,
                            }}
                          >
                            {String(trace.trace_id).slice(0, 16)}…
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              color: 'text.secondary',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {new Date(trace.start_time).toLocaleString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                              }
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                          >
                            {Number(trace.span_count).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                          >
                            {formatDuration(Number(trace.total_duration))}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <MiniWaterfallBar
                            operations={ops}
                            totalDuration={Number(trace.total_duration)}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              color:
                                Number(trace.error_count) > 0
                                  ? theme.palette.error.main
                                  : 'text.disabled',
                            }}
                          >
                            {Number(trace.error_count)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <SafeTooltip
                            title={t('argus.traces.viewLogs', 'View Logs')}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/argus/explore/logs?q=trace_id:"${trace.trace_id}"`
                                );
                              }}
                              sx={{ p: 0.3 }}
                            >
                              <LogsIcon
                                sx={{ fontSize: 14, color: 'text.disabled' }}
                              />
                            </IconButton>
                          </SafeTooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <LoadMoreFooter
                hasMore={hasMore}
                loading={loadingMore}
                onLoadMore={onLoadMore || (() => {})}
                isDark={isDark}
              />
            </>
          ) : !loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <TraceIcon
                sx={{
                  fontSize: 48,
                  color: alpha(theme.palette.primary.main, 0.15),
                  mb: 1,
                }}
              />
              <Typography
                sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}
              >
                {t('argus.traces.noTraces', 'No traces found')}
              </Typography>
              <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                {t(
                  'argus.traces.noTracesDesc',
                  'Try adjusting your search or time range.'
                )}
              </Typography>
            </Box>
          ) : null}
        </PageContentLoader>
      </TablePaper>
    );
  }
);
TracesTab.displayName = 'TracesTab';

// ─── Aggregates Tab ───

interface AggregatesTabProps {
  aggData: {
    groupBy: string;
    topValues: {
      group_value: string;
      count: number;
      avg_duration?: number;
      p95_duration?: number;
    }[];
    timeSeries: { bucket: string; group_value: string; count: number }[];
  } | null;
  aggLoading: boolean;
  aggGroupBy: string;
  onGroupByChange: (val: string) => void;
  onRunAgg: () => void;
}

export const AggregatesTab: React.FC<AggregatesTabProps> = React.memo(
  ({ aggData, aggLoading, aggGroupBy, onGroupByChange, onRunAgg }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';

    // Build time series chart data from aggData.timeSeries
    const timeSeriesChart = useMemo(() => {
      if (!aggData?.timeSeries || aggData.timeSeries.length === 0) return null;

      const bucketSet = new Set<string>();
      const groupSet = new Set<string>();
      aggData.timeSeries.forEach((row) => {
        bucketSet.add(row.bucket);
        groupSet.add(row.group_value);
      });
      const sortedBuckets = [...bucketSet].sort();
      // Only show top 8 groups
      const topGroups = [...groupSet].slice(0, 8);

      const lookup = new Map<string, number>();
      aggData.timeSeries.forEach((row) => {
        lookup.set(`${row.bucket}::${row.group_value}`, Number(row.count) || 0);
      });

      const labels = sortedBuckets.map((b) => {
        const d = new Date(b);
        return d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      });

      const datasets = topGroups.map((group) => ({
        label: group || '(empty)',
        data: sortedBuckets.map((b) => lookup.get(`${b}::${group}`) || 0),
        type: 'bar' as const,
        color: aggGroupBy === 'op' ? getOpColor(group) : undefined,
      }));

      return { labels, datasets };
    }, [aggData?.timeSeries, aggGroupBy]);

    return (
      <TablePaper elevation={0} isDark={isDark}>
        <GroupByToolbar isDark={isDark}>
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.secondary',
            }}
          >
            {t('argus.traces.groupBy', 'Group by')}:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={aggGroupBy}
              onChange={(e) => onGroupByChange(e.target.value as string)}
              sx={{ height: 28, fontSize: '0.75rem', fontWeight: 700 }}
            >
              <MenuItem value="op" sx={{ fontSize: '0.75rem' }}>
                Operation (op)
              </MenuItem>
              <MenuItem value="status" sx={{ fontSize: '0.75rem' }}>
                Status
              </MenuItem>
              <MenuItem value="domain" sx={{ fontSize: '0.75rem' }}>
                Domain
              </MenuItem>
              <MenuItem value="action" sx={{ fontSize: '0.75rem' }}>
                Action
              </MenuItem>
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            onClick={onRunAgg}
            disabled={aggLoading}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              ml: 'auto',
              borderRadius: '6px',
            }}
          >
            {aggLoading ? (
              <CircularProgress size={14} />
            ) : (
              t('argus.traces.runAgg', 'Run')
            )}
          </Button>
        </GroupByToolbar>

        {/* Time Series Chart */}
        {timeSeriesChart && (
          <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
            <ArgusVolumeChart
              datasets={timeSeriesChart.datasets}
              labels={timeSeriesChart.labels}
              title={`count(spans) by ${aggGroupBy}`}
              emptyMessage=""
              storagePrefix="argus_span_agg_chart"
              showLegend
              showChartTypeToggle={false}
              showCompactToggle={false}
              mb={0}
            />
          </Box>
        )}

        <PageContentLoader loading={aggLoading} skeleton={<TableSkeleton />}>
          {aggData && aggData.topValues.length > 0 ? (
            <Table
              size="small"
              sx={{
                '& td, & th': {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {[
                    aggGroupBy.toUpperCase(),
                    t('argus.traces.count', 'COUNT'),
                    t('argus.traces.avgDuration', 'AVG DURATION'),
                    'P95',
                  ].map((header) => (
                    <SortableHeaderCell key={header}>
                      {header}
                    </SortableHeaderCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {aggData.topValues.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ py: 0.8 }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        {aggGroupBy === 'op' && (
                          <OpDot dotColor={getOpColor(row.group_value)} />
                        )}
                        <Typography
                          sx={{ fontSize: '0.78rem', fontWeight: 600 }}
                        >
                          {row.group_value || '(empty)'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 0.8 }}>
                      <Typography sx={{ fontSize: '0.73rem' }}>
                        {Number(row.count).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.8 }}>
                      <Typography sx={{ fontSize: '0.73rem' }}>
                        {formatDuration(Number(row.avg_duration || 0))}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.8 }}>
                      <Typography
                        sx={{
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          color:
                            Number(row.p95_duration) > 1000
                              ? theme.palette.error.main
                              : 'text.primary',
                        }}
                      >
                        {formatDuration(Number(row.p95_duration || 0))}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : !aggLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <ViewIcon
                sx={{
                  fontSize: 48,
                  color: alpha(theme.palette.primary.main, 0.15),
                  mb: 1,
                }}
              />
              <Typography
                sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}
              >
                {t('argus.traces.aggregatesTitle', 'Span Aggregates')}
              </Typography>
              <Typography color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                {t(
                  'argus.traces.aggregatesDesc',
                  'Group spans by operation, status, or domain to find patterns.'
                )}
              </Typography>
            </Box>
          ) : null}
        </PageContentLoader>
      </TablePaper>
    );
  }
);
AggregatesTab.displayName = 'AggregatesTab';
