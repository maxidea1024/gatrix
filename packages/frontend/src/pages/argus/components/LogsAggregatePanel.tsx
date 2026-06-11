import React from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ToggleButtonGroup,
  ToggleButton,
  alpha,
  useTheme,
  IconButton,
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
  DonutLarge as DonutIcon,
  AlignHorizontalLeft as HBarIcon,
  Close as CloseIcon,
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
import { Pie, Doughnut, Bar as BarChart } from 'react-chartjs-2';
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
  onGroupByChange: (val: string) => void;
  onAddFilter: (key: string, val: string) => void;
  /** Discovered attribute keys from facet sidebar — appear as extra group-by options */
  discoveredFacetKeys?: string[];
  /** Show remove button (when multiple panels exist) */
  showRemove?: boolean;
  /** Called when this panel is removed */
  onRemovePanel?: () => void;
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
  onGroupByChange,
  onAddFilter,
  discoveredFacetKeys = [],
  showRemove = false,
  onRemovePanel,
}) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [tableCollapsed, setTableCollapsed] = React.useState(false);
  const [chartType, setChartType] = useLocalStorage<
    | 'bar'
    | 'line'
    | 'area'
    | 'treemap'
    | 'pie'
    | 'scatter'
    | 'doughnut'
    | 'horizontalBar'
  >('argus_agg_chart_type', 'bar');

  const pieData = React.useMemo(() => {
    if (!aggData?.topValues) return { labels: [], datasets: [] };
    return {
      labels: aggData.topValues.map((v) => v.group_value || '(empty)'),
      datasets: [
        {
          data: aggData.topValues.map((v) => v.count),
          backgroundColor: CHART_COLORS.slice(
            0,
            aggData.topValues.length
          ).concat(
            aggData.topValues
              .slice(CHART_COLORS.length)
              .map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
          ),
          borderWidth: isDark ? 1 : 1,
          borderColor: isDark ? '#1e1e38' : '#ffffff',
        },
      ],
    };
  }, [aggData, isDark]);

  const pieTotal = React.useMemo(() => {
    if (!aggData?.topValues) return 0;
    return aggData.topValues.reduce((s, v) => s + Number(v.count), 0);
  }, [aggData]);

  const pieClickHandler = React.useCallback(
    (event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
        const index = elements[0].index;
        const label = aggData?.topValues[index]?.group_value;
        if (label) {
          onAddFilter(aggGroupBy, label);
        }
      }
    },
    [aggData, aggGroupBy, onAddFilter]
  );

  const pieLegendConfig = React.useMemo(
    () => ({
      display: true,
      position: 'right' as const,
      labels: {
        boxWidth: 8,
        font: { size: 10 },
        color: isDark ? '#c9d1d9' : '#24292f',
        usePointStyle: true,
        pointStyle: 'circle',
      },
    }),
    [isDark]
  );

  const pieTooltipConfig = React.useMemo(
    () => ({
      callbacks: {
        label: (context: any) => {
          const label = context.label || '';
          const value = context.parsed || 0;
          const total = context.dataset.data.reduce(
            (a: number, b: number) => a + b,
            0
          );
          const pct = total > 0 ? (value / total) * 100 : 0;
          return ` ${label}: ${formatCompactNumber(value)} (${pct.toFixed(1)}%)`;
        },
      },
    }),
    []
  );

  const pieOptions = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: pieClickHandler,
      plugins: {
        legend: pieLegendConfig,
        tooltip: pieTooltipConfig,
      },
    }),
    [pieClickHandler, pieLegendConfig, pieTooltipConfig]
  );

  const doughnutOptions = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      onClick: pieClickHandler,
      plugins: {
        legend: pieLegendConfig,
        tooltip: pieTooltipConfig,
      },
    }),
    [pieClickHandler, pieLegendConfig, pieTooltipConfig]
  );

  const hBarData = React.useMemo(() => {
    if (!aggData?.topValues) return { labels: [], datasets: [] };
    return {
      labels: aggData.topValues.map((v) => v.group_value || '(empty)'),
      datasets: [
        {
          data: aggData.topValues.map((v) => Number(v.count)),
          backgroundColor: aggData.topValues.map((_, i) =>
            alpha(CHART_COLORS[i % CHART_COLORS.length], 0.7)
          ),
          borderColor: aggData.topValues.map(
            (_, i) => CHART_COLORS[i % CHART_COLORS.length]
          ),
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: false,
        },
      ],
    };
  }, [aggData, isDark]);

  const hBarOptions = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
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
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              return ` ${formatCompactNumber(context.parsed.x)}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          border: { display: false },
          ticks: { font: { size: 10 }, color: isDark ? '#555' : '#aaa' },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 10 }, color: isDark ? '#ccc' : '#555' },
        },
      },
    }),
    [aggData, aggGroupBy, onAddFilter, isDark]
  );

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
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '8px',
        mb: 1.5,
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
        {(() => {
          const groupByOptions: { value: string; label: string }[] = [
            { value: 'level', label: t('argus.logs.agg.level', 'Severity') },
            { value: 'service', label: t('argus.logs.agg.service', 'Service') },
            {
              value: 'environment',
              label: t('argus.logs.agg.environment', 'Environment'),
            },
            {
              value: 'logger_name',
              label: t('argus.logs.agg.logger', 'Logger'),
            },
            { value: 'release', label: t('argus.logs.agg.release', 'Release') },
          ];
          const selectedLabel =
            groupByOptions.find((o) => o.value === aggGroupBy)?.label ||
            aggGroupBy;
          const [menuAnchor, setMenuAnchor] =
            React.useState<null | HTMLElement>(null);
          return (
            <>
              <Box
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 28,
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: menuAnchor ? 'primary.main' : 'divider',
                  bgcolor: menuAnchor ? 'action.hover' : 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  overflow: 'hidden',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Box
                  sx={{
                    px: 1,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                    borderRight: '1px solid',
                    borderRightColor: 'divider',
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('argus.logs.groupByLabel', 'Group by')}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedLabel}
                  </Typography>
                  <ExpandMoreIcon
                    sx={{
                      fontSize: 14,
                      color: 'text.disabled',
                      transition: 'transform 0.2s',
                      transform: menuAnchor ? 'rotate(180deg)' : 'rotate(0deg)',
                      ml: -0.25,
                    }}
                  />
                </Box>
              </Box>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                  paper: {
                    sx: { mt: 0.5, borderRadius: '8px', minWidth: 140 },
                  },
                }}
              >
                {groupByOptions.map((opt) => (
                  <MenuItem
                    key={opt.value}
                    selected={opt.value === aggGroupBy}
                    onClick={() => {
                      onGroupByChange(opt.value);
                      setMenuAnchor(null);
                    }}
                    sx={{ fontSize: '0.78rem' }}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
                {discoveredFacetKeys.length > 0 && <Divider sx={{ my: 0.5 }} />}
                {discoveredFacetKeys.length > 0 && (
                  <MenuItem
                    disabled
                    sx={{
                      fontSize: '0.65rem',
                      opacity: 0.5,
                      minHeight: 24,
                      py: 0.25,
                    }}
                  >
                    Attributes
                  </MenuItem>
                )}
                {discoveredFacetKeys.map((key) => (
                  <MenuItem
                    key={`attr.${key}`}
                    selected={key === aggGroupBy}
                    onClick={() => {
                      onGroupByChange(key);
                      setMenuAnchor(null);
                    }}
                    sx={{ fontSize: '0.75rem', pl: 2.5 }}
                  >
                    {key}
                  </MenuItem>
                ))}
              </Menu>
            </>
          );
        })()}
        <Box sx={{ flex: 1 }} />
        {aggData && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
            {aggData.topValues.length} {t('argus.logs.agg.groups', 'groups')}
          </Typography>
        )}
        {showRemove && onRemovePanel && (
          <IconButton
            size="small"
            onClick={onRemovePanel}
            sx={{
              p: 0.3,
              ml: 0.5,
              color: 'text.disabled',
              '&:hover': { color: 'error.main' },
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
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
                  type:
                    chartType === 'line' ||
                    chartType === 'area' ||
                    chartType === 'scatter'
                      ? chartType
                      : 'bar',
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
                      flex: '0 0 auto',
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
                        <ToggleButton value="scatter">
                          <SafeTooltip
                            title={t('argus.chart.scatter', 'Scatter')}
                          >
                            <ScatterPlotIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="pie">
                          <SafeTooltip title={t('argus.chart.pie', 'Pie')}>
                            <PieChartIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="doughnut">
                          <SafeTooltip
                            title={t('argus.chart.doughnut', 'Doughnut')}
                          >
                            <DonutIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="treemap">
                          <SafeTooltip
                            title={t('argus.chart.treemap', 'Treemap')}
                          >
                            <TreemapIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                        <ToggleButton value="horizontalBar">
                          <SafeTooltip
                            title={t(
                              'argus.chart.horizontalBar',
                              'Horizontal Bar'
                            )}
                          >
                            <HBarIcon sx={{ fontSize: 16 }} />
                          </SafeTooltip>
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                    <Box
                      sx={{
                        flex: 'none',
                        height:
                          chartType === 'treemap' ||
                          chartType === 'pie' ||
                          chartType === 'doughnut' ||
                          chartType === 'horizontalBar'
                            ? 180
                            : 150,
                        minHeight: 150,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {chartType === 'treemap' ? (
                        <LogsTreemapChart
                          data={aggData.topValues}
                          onClick={(val) => onAddFilter(aggGroupBy, val)}
                        />
                      ) : chartType === 'pie' ? (
                        <Pie data={pieData} options={pieOptions} />
                      ) : chartType === 'doughnut' ? (
                        <Box
                          sx={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                          }}
                        >
                          <Doughnut data={pieData} options={doughnutOptions} />
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: `calc(50% - ${aggData.topValues.length > 0 ? 40 : 0}px)`,
                              transform: 'translate(-50%, -50%)',
                              textAlign: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: 'text.primary',
                                lineHeight: 1.2,
                              }}
                            >
                              {formatCompactNumber(pieTotal)}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: '0.6rem',
                                color: 'text.disabled',
                                lineHeight: 1,
                              }}
                            >
                              {t('argus.logs.agg.count', 'Count')}
                            </Typography>
                          </Box>
                        </Box>
                      ) : chartType === 'horizontalBar' ? (
                        <BarChart
                          data={hBarData}
                          options={hBarOptions as any}
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
                borderBottom: !tableCollapsed
                  ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                  : 'none',
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
                {t('argus.logs.agg.topValues', 'Top Values')} (
                {aggData.topValues.length})
              </Typography>
              {tableCollapsed ? (
                <ExpandMoreIcon
                  sx={{ fontSize: 16, color: 'text.secondary' }}
                />
              ) : (
                <ExpandLessIcon
                  sx={{ fontSize: 16, color: 'text.secondary' }}
                />
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
