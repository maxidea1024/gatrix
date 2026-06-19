import React, { useState, useCallback, useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/numberFormat';
import EventLabel from '@/components/argus/EventLabel';
import { useInsightsStore } from '@/hooks/useAnalyticsStore';
import { formatBreakdownLabel } from './breakdownUtils';
import { SERIES_COLORS } from './InsightsLeftPanel';

interface InsightsChartSectionProps {
  series: any[];
  compareSeries: any[] | undefined;
  chartDataWithFormula: any[];
  seriesKeys: string[];
  compareKeys: string[];
  validFormulaResults: any[];
  allSeriesKeys: string[];
  handleChartClick: (state: any) => void;
  lexiconMap: Map<string, string>;
  eventMetaMap: Map<string, any>;
  refAreaLeft: string | null;
  refAreaRight: string | null;
  setRefAreaLeft: (v: string | null) => void;
  setRefAreaRight: (v: string | null) => void;
  handleZoom: () => void;
}

const COMPARE_DASH = '6 4';
const FORMULA_COLORS = ['#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#a855f7'];

export const InsightsChartSection: React.FC<InsightsChartSectionProps> = ({
  series,
  compareSeries,
  chartDataWithFormula,
  seriesKeys,
  compareKeys,
  validFormulaResults,
  allSeriesKeys,
  handleChartClick,
  lexiconMap,
  eventMetaMap,
  refAreaLeft,
  refAreaRight,
  setRefAreaLeft,
  setRefAreaRight,
  handleZoom,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  // ── Persisted Store State ──
  const chartType = useInsightsStore((s) => s.chartType);
  const breakdownProperties = useInsightsStore((s) => s.breakdownProperties);

  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Set<string>>(
    new Set()
  );

  // Reset hidden keys when series changes
  React.useEffect(() => {
    setHiddenSeriesKeys(new Set());
  }, [series]);

  const handleLegendClick = useCallback((e: any) => {
    const { dataKey } = e;
    setHiddenSeriesKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  const renderLegendText = useCallback(
    (value: string, entry: any) => {
      const isHidden = hiddenSeriesKeys.has(entry.dataKey || value);
      let label = value;
      if (value.includes(':')) {
        const [eventName, breakdownVal] = value.split(':');
        const display = lexiconMap.get(eventName) || eventName;
        label = `${display}: ${breakdownVal}`;
      } else {
        label = lexiconMap.get(value) || value;
      }
      return (
        <span
          style={{
            color: isHidden ? theme.palette.text.disabled : 'inherit',
            textDecoration: isHidden ? 'line-through' : 'none',
            cursor: 'pointer',
          }}
        >
          {label}
        </span>
      );
    },
    [hiddenSeriesKeys, theme, lexiconMap]
  );

  const tooltipFormatter = useCallback(
    (value: any, name: string) => {
      let label = name;
      if (name.includes(':')) {
        const [eventName, breakdownVal] = name.split(':');
        const display = lexiconMap.get(eventName) || eventName;
        label = `${display}: ${breakdownVal}`;
      } else {
        label = lexiconMap.get(name) || name;
      }
      return [value, label];
    },
    [lexiconMap]
  );

  // ── Data table view ──
  const renderDataTable = (data: Record<string, any>[], keys: string[]) => {
    const sortableKeys = keys.filter((k) => k !== 'bucket');
    return (
      <Box sx={{ overflowX: 'auto', maxHeight: 500 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                  position: 'sticky',
                  top: 0,
                  background: theme.palette.background.paper,
                  zIndex: 1,
                }}
              >
                {t('argus.analytics.time', 'Time')}
              </th>
              {sortableKeys.map((key) => (
                <th
                  key={key}
                  style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    background: theme.palette.background.paper,
                    zIndex: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(() => {
                    const eventName = key.includes(':')
                      ? key.split(':')[0]
                      : key;
                    return lexiconMap.get(eventName) || eventName;
                  })()}
                  {key.includes(':') && (
                    <span style={{ opacity: 0.6 }}>
                      :{key.split(':').slice(1).join(':')}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                }}
              >
                <td
                  style={{
                    padding: '10px 16px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.bucket}
                </td>
                {sortableKeys.map((key) => (
                  <td
                    key={key}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {typeof row[key] === 'number'
                      ? formatCompactNumber(row[key])
                      : (row[key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    );
  };

  // ── Summary table (always shown below chart) ──
  const renderSummaryTable = () => {
    if (series.length === 0) return null;

    return (
      <Box
        sx={{
          overflowX: 'auto',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          mt: 2,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.segment', 'Segment')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.total', 'Total')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.avg', 'Avg')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.min', 'Min')}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: theme.palette.text.secondary,
                  fontWeight: 600,
                }}
              >
                {t('argus.analytics.max', 'Max')}
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((s, idx) => {
              const label = s.breakdown_value
                ? `${s.event} - ${formatBreakdownLabel(s.breakdown_value, breakdownProperties)}`
                : s.event;
              const values = s.data.map((d: any) => d.value);
              const total = values.reduce(
                (acc: number, v: number) => acc + v,
                0
              );
              const avg = values.length > 0 ? total / values.length : 0;
              const min = values.length > 0 ? Math.min(...values) : 0;
              const max = values.length > 0 ? Math.max(...values) : 0;
              const keyForColor = s.breakdown_value
                ? `${s.event}:${formatBreakdownLabel(s.breakdown_value, breakdownProperties)}`
                : s.event;
              const color =
                SERIES_COLORS[
                  seriesKeys.indexOf(keyForColor) % SERIES_COLORS.length
                ];
              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  }}
                >
                  <td
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: color,
                        flexShrink: 0,
                      }}
                    />
                    {(() => {
                      const meta = eventMetaMap.get(s.event);
                      return (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.75,
                            minWidth: 0,
                          }}
                        >
                          <EventLabel
                            eventName={s.event}
                            displayName={meta?.display_name}
                            icon={meta?.icon}
                            iconColor={meta?.icon_color}
                            isReserved={meta?.is_reserved}
                            size="compact"
                            showIcon={false}
                          />
                          {s.breakdown_value && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontSize: '0.75rem' }}
                            >
                              —{' '}
                              {formatBreakdownLabel(
                                s.breakdown_value,
                                breakdownProperties
                              )}
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(total)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(Math.round(avg))}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(min)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(max)}
                  </td>
                </tr>
              );
            })}
            {validFormulaResults.map((r, idx) => {
              const label = r.formula;
              const values = r.result.data.map((d: any) => d.value);
              const total = values.reduce(
                (acc: number, v: number) => acc + v,
                0
              );
              const avg = values.length > 0 ? total / values.length : 0;
              const min = values.length > 0 ? Math.min(...values) : 0;
              const max = values.length > 0 ? Math.max(...values) : 0;
              const color = FORMULA_COLORS[idx % FORMULA_COLORS.length];
              return (
                <tr
                  key={`formula-${idx}`}
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  }}
                >
                  <td
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: color,
                        flexShrink: 0,
                      }}
                    />
                    {label}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(total)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(Math.round(avg))}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(min)}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCompactNumber(max)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    );
  };

  const data = chartDataWithFormula;
  if (data.length === 0) return null;

  const commonTooltipStyle = {
    background: isDark ? '#1e1e2e' : '#fff',
    color: isDark ? '#e4e4e7' : '#1a1a2e',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    fontSize: 12,
  };
  const commonTooltipItemStyle = { color: isDark ? '#e4e4e7' : '#1a1a2e' };
  const commonTooltipLabelStyle = {
    color: isDark ? '#a1a1aa' : '#52525b',
    fontWeight: 600,
  };

  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tickStyle = { fontSize: 11, fill: theme.palette.text.secondary };

  if (chartType === 'table') {
    return renderDataTable(data, allSeriesKeys);
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          minHeight: 360,
          height: { xs: 360, md: '50vh' },
          maxHeight: 600,
          width: '100%',
          pr: 2,
          position: 'relative',
          userSelect: 'none',
          '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
            outline: 'none',
          },
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={1}
          minHeight={1}
          debounce={100}
        >
          {chartType === 'line' ? (
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              onMouseDown={(e) =>
                e &&
                setRefAreaLeft(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseMove={(e) =>
                e &&
                refAreaLeft &&
                setRefAreaRight(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseUp={handleZoom}
              onClick={handleChartClick}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />
              {refAreaLeft && refAreaRight && (
                <ReferenceArea
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill={theme.palette.primary.main}
                  fillOpacity={0.15}
                />
              )}
              <XAxis
                dataKey="bucket"
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={commonTooltipStyle}
                itemStyle={commonTooltipItemStyle}
                labelStyle={commonTooltipLabelStyle}
                formatter={tooltipFormatter}
              />
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              />
              {seriesKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
              {compareKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={1.5}
                  strokeDasharray={COMPARE_DASH}
                  strokeOpacity={0.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              {/* Formulas as special lines */}
              {validFormulaResults.map((r, idx) => (
                <Line
                  key={r.key}
                  type="monotone"
                  dataKey={r.key}
                  name={r.formula}
                  hide={hiddenSeriesKeys.has(r.key)}
                  stroke={FORMULA_COLORS[idx % FORMULA_COLORS.length]}
                  strokeWidth={2.5}
                  strokeDasharray="8 4"
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 0,
                    fill: FORMULA_COLORS[idx % FORMULA_COLORS.length],
                  }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              onMouseDown={(e) =>
                e &&
                setRefAreaLeft(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseMove={(e) =>
                e &&
                refAreaLeft &&
                setRefAreaRight(e.activeLabel ? String(e.activeLabel) : null)
              }
              onMouseUp={handleZoom}
              onClick={handleChartClick}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />
              {refAreaLeft && refAreaRight && (
                <ReferenceArea
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill={theme.palette.primary.main}
                  fillOpacity={0.15}
                />
              )}
              <XAxis
                dataKey="bucket"
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={commonTooltipStyle}
                itemStyle={commonTooltipItemStyle}
                labelStyle={commonTooltipLabelStyle}
                formatter={tooltipFormatter}
              />
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              />
              {seriesKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  stackId={chartType === 'stacked-bar' ? 'stack' : undefined}
                  isAnimationActive={false}
                />
              ))}
              {validFormulaResults.map((r, idx) => (
                <Bar
                  key={r.key}
                  dataKey={r.key}
                  name={r.formula}
                  hide={hiddenSeriesKeys.has(r.key)}
                  fill={FORMULA_COLORS[idx % FORMULA_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  stackId={chartType === 'stacked-bar' ? 'stack' : undefined}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
      {renderSummaryTable()}
    </Box>
  );
};
