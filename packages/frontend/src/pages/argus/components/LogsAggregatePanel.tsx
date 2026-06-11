import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ToggleButtonGroup,
  ToggleButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ViewColumn as ViewIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  StackedLineChart as AreaChartIcon,
  ViewQuilt as TreemapIcon,
  PieChart as PieChartIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ScatterPlot as ScatterPlotIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import SafeTooltip from '@/components/common/SafeTooltip';
import { formatCompactNumber } from '@/utils/numberFormat';
import InteractiveTimeSeriesChart, {
  ChartDataset,
} from '@/components/argus/InteractiveTimeSeriesChart';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Chart as ChartJS, ArcElement } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import LogsTreemapChart from './LogsTreemapChart';

ChartJS.register(ArcElement);

interface AggData {
  groupBy: string;
  topValues: { group_value: string; count: number }[];
  timeSeries: { bucket: string; group_value: string; count: number }[];
}

export interface LogsAggregatePanelProps {
  aggData: AggData | null;
  aggGroupBy: string;
  aggLoading: boolean;
  isDark: boolean;
  tableCollapsed: boolean;
  setTableCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  onGroupByChange: (val: string) => void;
  onAddFilter: (key: string, val: string) => void;
}

const CHART_COLORS = [
  '#7c4dff',
  '#448aff',
  '#00bcd4',
  '#ff9800',
  '#f44336',
  '#4caf50',
  '#9c27b0',
];

const LogsAggregatePanel: React.FC<LogsAggregatePanelProps> = ({
  aggData,
  aggGroupBy,
  aggLoading,
  isDark,
  tableCollapsed,
  setTableCollapsed,
  onGroupByChange,
  onAddFilter,
}) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [chartType, setChartType] = useLocalStorage<'bar' | 'line' | 'area' | 'treemap' | 'pie' | 'scatter'>(
    'argus_agg_chart_type',
    'bar'
  );

  const pieData = React.useMemo(() => {
    if (!aggData?.topValues) return { labels: [], datasets: [] };
    return {
      labels: aggData.topValues.map((v) => v.group_value || '(empty)'),
      datasets: [
        {
          data: aggData.topValues.map((v) => v.count),
          backgroundColor: CHART_COLORS.slice(0, aggData.topValues.length).concat(
            aggData.topValues.slice(CHART_COLORS.length).map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
          ),
          borderWidth: isDark ? 1 : 1,
          borderColor: isDark ? '#1e1e38' : '#ffffff',
        },
      ],
    };
  }, [aggData, isDark]);

  const pieOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
        const index = elements[0].index;
        const label = aggData?.topValues[index]?.group_value;
        if (label) {
          onAddFilter(aggGroupBy, label);
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          boxWidth: 8,
          font: { size: 10 },
          color: isDark ? '#c9d1d9' : '#24292f',
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const pct = total > 0 ? (value / total) * 100 : 0;
            return ` ${label}: ${formatCompactNumber(value)} (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  }), [aggData, aggGroupBy, onAddFilter, isDark]);

  if (!aggLoading && (!aggData || aggData.topValues.length === 0)) {
    return (
      <EmptyPlaceholder
        variant="text"
        icon={<ViewIcon sx={{ fontSize: 48 }} />}
        message={t('argus.logs.aggregatesTitle', 'Log Aggregates')}
        description={t(
          'argus.logs.aggregatesDesc',
          'Group and count logs by attributes to identify patterns.'
        )}
        sx={{ flex: 1, height: '100%' }}
      />
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.015)'
            : 'rgba(0,0,0,0.01)',
        }}
      >
        <Typography
          sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}
        >
          {t('argus.logs.groupByLabel', 'Group by')}
        </Typography>
        <FormControl size="small" variant="outlined" sx={{ minWidth: 130 }}>
          <Select
            value={aggGroupBy}
            onChange={(e) => onGroupByChange(e.target.value)}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              height: 28,
              '& .MuiSelect-select': { py: 0.5 },
            }}
          >
            <MenuItem value="level" sx={{ fontSize: '0.75rem' }}>
              {t('argus.logs.agg.level', 'Severity')}
            </MenuItem>
            <MenuItem value="service" sx={{ fontSize: '0.75rem' }}>
              {t('argus.logs.agg.service', 'Service')}
            </MenuItem>
            <MenuItem value="environment" sx={{ fontSize: '0.75rem' }}>
              {t('argus.logs.agg.environment', 'Environment')}
            </MenuItem>
            <MenuItem value="logger_name" sx={{ fontSize: '0.75rem' }}>
              {t('argus.logs.agg.logger', 'Logger')}
            </MenuItem>
            <MenuItem value="release" sx={{ fontSize: '0.75rem' }}>
              {t('argus.logs.agg.release', 'Release')}
            </MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        {aggData && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
            {aggData.topValues.length} {t('argus.logs.agg.groups', 'groups')}
          </Typography>
        )}
      </Box>

      <PageContentLoader
        loading={aggLoading}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {aggData && aggData.topValues.length > 0 && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Stacked time series chart */}
            {aggData.timeSeries.length > 0 &&
              (() => {
                const groups = [
                  ...new Set(aggData.timeSeries.map((d) => d.group_value)),
                ];
                const buckets = [
                  ...new Set(aggData.timeSeries.map((d) => d.bucket)),
                ].sort();
                const labels = buckets.map((b) => {
                  const d = new Date(b);
                  return d.toLocaleString(i18n.language || 'ko', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                });
                const datasets: ChartDataset[] = groups.map((g, gi) => ({
                  label: g || '(empty)',
                  data: buckets.map((b) => {
                    const found = aggData.timeSeries.find(
                      (d) => d.bucket === b && d.group_value === g
                    );
                    return found ? Number(found.count) : 0;
                  }),
                  type: (chartType === 'line' || chartType === 'area' || chartType === 'scatter') ? chartType : 'bar',
                  color: CHART_COLORS[gi % CHART_COLORS.length],
                }));
                return (
                  <Box
                    sx={{
                      p: 2,
                      pb: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      ...(tableCollapsed
                        ? { flex: 1 }
                        : { flex: '0 0 auto' }),
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                        }}
                      >
                        {t('argus.logs.agg.countOverTime', 'Count over time')}
                      </Typography>
                      <ToggleButtonGroup
                        value={chartType}
                        exclusive
                        onChange={(_, v) => {
                          if (v) setChartType(v);
                        }}
                        size="small"
                        sx={{
                          height: 24,
                          '& .MuiToggleButton-root': {
                            px: 0.75,
                            py: 0,
                            border: `1px solid`,
                            borderColor: 'divider',
                            '&.Mui-selected': {
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              borderColor: alpha(
                                theme.palette.primary.main,
                                0.3
                              ),
                            },
                          },
                        }}
                      >
                        <ToggleButton value="bar">
                          <SafeTooltip title={t('argus.chart.bar', 'Bar')}>
                            <BarChartIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="line">
                          <SafeTooltip title={t('argus.chart.line', 'Line')}>
                            <LineChartIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="area">
                          <SafeTooltip title={t('argus.chart.area', 'Area')}>
                            <AreaChartIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="treemap">
                          <SafeTooltip title={t('argus.chart.treemap', 'Treemap')}>
                            <TreemapIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="pie">
                          <SafeTooltip title={t('argus.chart.pie', 'Pie')}>
                            <PieChartIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="scatter">
                          <SafeTooltip title={t('argus.chart.scatter', 'Scatter')}>
                            <ScatterPlotIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                    <Box
                      sx={{
                        flex: 1,
                        minHeight: 150,
                        position: 'relative',
                        overflow: 'hidden',
                        ...(!tableCollapsed
                          ? { height: chartType === 'treemap' || chartType === 'pie' ? 180 : 150 }
                          : { height: '100%' }),
                      }}
                    >
                      {chartType === 'treemap' ? (
                        <LogsTreemapChart
                          data={aggData.topValues}
                          onClick={(val) => onAddFilter(aggGroupBy, val)}
                        />
                      ) : chartType === 'pie' ? (
                        <Pie
                          data={pieData}
                          options={pieOptions}
                        />
                      ) : (
                        <InteractiveTimeSeriesChart
                          labels={labels}
                          datasets={datasets}
                          height={tableCollapsed ? '100%' : 150}
                          showLegend
                        />
                      )}
                    </Box>
                  </Box>
                );
              })()}

            {/* Top values collapsible header */}
            <Box
              onClick={() => setTableCollapsed((prev) => !prev)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1,
                cursor: 'pointer',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                borderBottom: !tableCollapsed ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.015)'
                  : 'rgba(0,0,0,0.01)',
                '&:hover': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,0,0,0.018)',
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'text.secondary',
                }}
              >
                {t('argus.logs.agg.groupList', 'Group List')} ({aggData.topValues.length})
              </Typography>
              {tableCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              )}
            </Box>

            {/* Top values table */}
            {!tableCollapsed && (
              <Box sx={{ overflowX: 'auto', flex: 1, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      }}
                    >
                      {aggGroupBy}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      }}
                    >
                      {t('argus.logs.agg.count', 'Count')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        width: '40%',
                      }}
                    >
                      {t('argus.logs.agg.percentage', '%')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const total = aggData.topValues.reduce(
                      (s, v) => s + Number(v.count),
                      0
                    );
                    return aggData.topValues.map((row, idx) => {
                      const pct =
                        total > 0 ? (Number(row.count) / total) * 100 : 0;
                      return (
                        <TableRow
                          key={idx}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.015)'
                                : 'rgba(0,0,0,0.008)',
                            },
                          }}
                          onClick={() =>
                            onAddFilter(aggGroupBy, row.group_value)
                          }
                        >
                          <TableCell
                            sx={{
                              fontSize: '0.78rem',
                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor:
                                    CHART_COLORS[idx % CHART_COLORS.length],
                                  flexShrink: 0,
                                }}
                              />
                              {row.group_value || '(empty)'}
                            </Box>
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                            }}
                          >
                            {formatCompactNumber(Number(row.count))}
                          </TableCell>
                          <TableCell
                            sx={{
                              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.04)'
                                    : 'rgba(0,0,0,0.04)',
                                  overflow: 'hidden',
                                }}
                              >
                                <Box
                                  sx={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    borderRadius: 3,
                                    backgroundColor:
                                      CHART_COLORS[idx % CHART_COLORS.length],
                                    transition: 'width 0.3s',
                                  }}
                                />
                              </Box>
                              <Typography
                                sx={{
                                  fontSize: '0.68rem',
                                  color: 'text.disabled',
                                  minWidth: 35,
                                  textAlign: 'right',
                                }}
                              >
                                {pct.toFixed(1)}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </Box>
          )}
          </Box>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default LogsAggregatePanel;
