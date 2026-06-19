import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/numberFormat';
import {
  splitBreakdownValue,
  formatBreakdownLabel,
} from '../analytics/breakdownUtils';

const SERIES_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
];

interface RetentionViewsProps {
  cohorts: any[];
  breakdownCohorts: Record<string, any[]> | undefined;
  retentionType: 'day' | 'week' | 'month';
  measurement:
    | 'retention_rate'
    | 'unique_users'
    | 'property_sum'
    | 'property_avg';
  viewMode: 'curve' | 'line' | 'bar' | 'table' | 'metric';
  breakdownProperties: string[];
  handleCellClick: (cohortDateStr: string, periodIndex: number) => void;
  handleBreakdownCellClick: (
    breakdownValue: string,
    periodIndex: number
  ) => void;
}

export const RetentionViews: React.FC<RetentionViewsProps> = ({
  cohorts,
  breakdownCohorts,
  retentionType,
  measurement,
  viewMode,
  breakdownProperties,
  handleCellClick,
  handleBreakdownCellClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const periodPrefix =
    retentionType === 'day' ? 'D' : retentionType === 'week' ? 'W' : 'M';

  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Set<string>>(
    new Set()
  );

  // Reset hidden keys when cohorts change
  useEffect(() => {
    setHiddenSeriesKeys(new Set());
  }, [cohorts]);

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
      return (
        <span
          style={{
            color: isHidden ? theme.palette.text.disabled : 'inherit',
            textDecoration: isHidden ? 'line-through' : 'none',
            cursor: 'pointer',
          }}
        >
          {value}
        </span>
      );
    },
    [hiddenSeriesKeys, theme]
  );

  // ── Curve data ──
  const curveData = useMemo(() => {
    if (cohorts.length === 0) return [];
    const maxPeriods = Math.max(
      ...cohorts.map((c) => c.retention?.length || 0)
    );
    const avgRetention: number[] = Array(maxPeriods).fill(0);
    const counts: number[] = Array(maxPeriods).fill(0);

    cohorts.forEach((c) => {
      c.retention?.forEach((pct: number, i: number) => {
        if (pct > 0) {
          avgRetention[i] += pct;
          counts[i]++;
        }
      });
    });

    const isPercentage = measurement === 'retention_rate';
    return Array.from({ length: maxPeriods }, (_, i) => ({
      period: `${retentionType === 'day' ? 'Day' : retentionType === 'week' ? 'Wk' : 'Mo'} ${i}`,
      average:
        counts[i] > 0
          ? isPercentage
            ? Math.min(Math.round((avgRetention[i] / counts[i]) * 10) / 10, 100)
            : Math.round((avgRetention[i] / counts[i]) * 10) / 10
          : 0,
      ...Object.fromEntries(
        cohorts.map((c) => [
          String(c.cohort_date).substring(0, 10),
          isPercentage
            ? Math.min(c.retention?.[i] ?? 0, 100)
            : (c.retention?.[i] ?? 0),
        ])
      ),
    }));
  }, [cohorts, retentionType, measurement]);

  // ── Breakdown curve data ──
  const breakdownCurveData = useMemo(() => {
    if (!breakdownCohorts || Object.keys(breakdownCohorts).length === 0)
      return null;

    let maxPeriods = 0;
    for (const bvCohorts of Object.values(breakdownCohorts)) {
      for (const c of bvCohorts) {
        maxPeriods = Math.max(maxPeriods, c.retention?.length || 0);
      }
    }
    if (maxPeriods === 0) return null;

    let breakdownKeys = Object.keys(breakdownCohorts);

    const BREAKDOWN_LIMIT = 10;
    if (breakdownKeys.length > BREAKDOWN_LIMIT) {
      breakdownKeys.sort((a, b) => {
        const sumA = breakdownCohorts[a].reduce(
          (s: number, c: any) => s + (c.cohort_size || 0),
          0
        );
        const sumB = breakdownCohorts[b].reduce(
          (s: number, c: any) => s + (c.cohort_size || 0),
          0
        );
        return sumB - sumA;
      });
      breakdownKeys = breakdownKeys.slice(0, BREAKDOWN_LIMIT);
    }

    return Array.from({ length: maxPeriods }, (_, i) => {
      const point: Record<string, any> = {
        period: `${retentionType === 'day' ? 'Day' : retentionType === 'week' ? 'Wk' : 'Mo'} ${i}`,
      };
      for (const bv of breakdownKeys) {
        const bvArr = breakdownCohorts[bv];
        let sum = 0,
          count = 0;
        for (const c of bvArr) {
          const val = c.retention?.[i] ?? 0;
          if (val > 0) {
            sum += val;
            count++;
          }
        }
        const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
        point[bv] = measurement === 'retention_rate' ? Math.min(avg, 100) : avg;
      }
      return point;
    });
  }, [breakdownCohorts, retentionType, measurement]);

  const maxPeriods = cohorts[0]?.retention?.length || 0;

  // ── Render: Retention Curve ──
  const renderCurveView = () => {
    if (
      breakdownCurveData &&
      breakdownCurveData.length > 0 &&
      breakdownCohorts
    ) {
      const breakdownKeys = Object.keys(breakdownCohorts);
      return (
        <Box
          sx={{
            minWidth: 0,
            height: { xs: 360, md: '50vh' },
            minHeight: 360,
            maxHeight: 600,
            width: '100%',
            pr: 2,
            userSelect: 'none',
            '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
              outline: 'none',
            },
          }}
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            debounce={50}
          >
            <LineChart
              data={breakdownCurveData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                width={40}
                unit={measurement === 'retention_rate' ? '%' : ''}
                domain={measurement === 'retention_rate' ? [0, 100] : undefined}
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={{
                  background: isDark ? '#1e1e2e' : '#fff',
                  color: isDark ? '#e4e4e7' : '#1a1a2e',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
                labelStyle={{
                  color: isDark ? '#a1a1aa' : '#52525b',
                  fontWeight: 600,
                }}
              />
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              {breakdownKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  name={key}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      );
    }

    if (curveData.length === 0) return null;
    const cohortKeys = cohorts.map((c) =>
      String(c.cohort_date).substring(0, 10)
    );

    return (
      <Box
        sx={{
          minWidth: 0,
          height: { xs: 360, md: '50vh' },
          minHeight: 360,
          maxHeight: 600,
          width: '100%',
          pr: 2,
          userSelect: 'none',
          '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
            outline: 'none',
          },
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          debounce={50}
        >
          <LineChart
            data={curveData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              tickMargin={16}
            />
            <YAxis
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              width={40}
              unit={measurement === 'retention_rate' ? '%' : ''}
              domain={measurement === 'retention_rate' ? [0, 100] : undefined}
            />
            <RechartsTooltip
              wrapperStyle={{ zIndex: 1000 }}
              contentStyle={{
                background: isDark ? '#1e1e2e' : '#fff',
                color: isDark ? '#e4e4e7' : '#1a1a2e',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
              labelStyle={{
                color: isDark ? '#a1a1aa' : '#52525b',
                fontWeight: 600,
              }}
            />
            <Legend
              onClick={handleLegendClick}
              formatter={renderLegendText}
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            />
            <Line
              type="monotone"
              dataKey="average"
              hide={hiddenSeriesKeys.has('average')}
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 3 }}
              name={t('argus.analytics.average', 'Average')}
            />
            {cohortKeys.slice(0, 10).map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                hide={hiddenSeriesKeys.has(key)}
                stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                strokeWidth={1}
                strokeOpacity={0.4}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  // ── Render: Bar Chart ──
  const renderBarView = () => {
    if (
      breakdownCurveData &&
      breakdownCurveData.length > 0 &&
      breakdownCohorts
    ) {
      const breakdownKeys = Object.keys(breakdownCohorts).slice(0, 10);
      return (
        <Box
          sx={{
            minWidth: 0,
            height: { xs: 360, md: '50vh' },
            minHeight: 360,
            maxHeight: 600,
            width: '100%',
            pr: 2,
            userSelect: 'none',
            '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
              outline: 'none',
            },
          }}
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            debounce={50}
          >
            <BarChart
              data={breakdownCurveData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                tickMargin={16}
              />
              <YAxis
                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
                width={40}
                unit={measurement === 'retention_rate' ? '%' : ''}
                domain={measurement === 'retention_rate' ? [0, 100] : undefined}
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={{
                  background: isDark ? '#1e1e2e' : '#fff',
                  color: isDark ? '#e4e4e7' : '#1a1a2e',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
                labelStyle={{
                  color: isDark ? '#a1a1aa' : '#52525b',
                  fontWeight: 600,
                }}
              />
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              {breakdownKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  name={key}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      );
    }

    if (curveData.length === 0) return null;
    return (
      <Box
        sx={{
          minWidth: 0,
          height: { xs: 360, md: '50vh' },
          minHeight: 360,
          maxHeight: 600,
          width: '100%',
          pr: 2,
          userSelect: 'none',
          '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
            outline: 'none',
          },
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          debounce={50}
        >
          <BarChart
            data={curveData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              tickMargin={16}
            />
            <YAxis
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={false}
              width={40}
              unit={measurement === 'retention_rate' ? '%' : ''}
              domain={measurement === 'retention_rate' ? [0, 100] : undefined}
            />
            <RechartsTooltip
              wrapperStyle={{ zIndex: 1000 }}
              contentStyle={{
                background: isDark ? '#1e1e2e' : '#fff',
                color: isDark ? '#e4e4e7' : '#1a1a2e',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              itemStyle={{ color: isDark ? '#e4e4e7' : '#1a1a2e' }}
              labelStyle={{
                color: isDark ? '#a1a1aa' : '#52525b',
                fontWeight: 600,
              }}
            />
            <Bar
              dataKey="average"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              name={t('argus.analytics.average', 'Average')}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  // ── Render: Metric view ──
  const renderMetricView = () => {
    if (cohorts.length === 0) return null;
    const avgRetention =
      cohorts.reduce((sum, c) => sum + (c.retention?.[1] ?? 0), 0) /
      cohorts.length;

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h2" fontWeight={800} sx={{ color: '#6366f1' }}>
            {Math.round(avgRetention * 10) / 10}%
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
            {t(
              'argus.analytics.avgRetentionLabel',
              'Average {{period}} Retention',
              {
                period:
                  retentionType === 'day'
                    ? t('argus.analytics.day1', 'Day 1')
                    : retentionType === 'week'
                      ? t('argus.analytics.week1', 'Week 1')
                      : t('argus.analytics.month1', 'Month 1'),
              }
            )}
          </Typography>
        </Box>
      </Box>
    );
  };

  // ── Render: Table (heatmap) ──
  const renderHeatmapTable = () => {
    if (cohorts.length === 0) return null;

    const hasBreakdown =
      breakdownCohorts && Object.keys(breakdownCohorts).length > 0;

    const renderBreakdownSummary = () => {
      if (!hasBreakdown || maxPeriods === 0) return null;

      const bdKeys = Object.keys(breakdownCohorts!);

      const summaryRows = bdKeys.map((bv, idx) => {
        const bvCohorts = breakdownCohorts![bv];
        const totalSize = bvCohorts.reduce(
          (s: number, c: any) => s + (c.cohort_size || 0),
          0
        );

        const avgRetention: number[] = [];
        for (let p = 0; p < maxPeriods; p++) {
          let weightedSum = 0,
            totalWeight = 0;
          for (const c of bvCohorts) {
            const pct = c.retention?.[p] ?? 0;
            const size = c.cohort_size || 0;
            if (pct > 0 && size > 0) {
              weightedSum += pct * size;
              totalWeight += size;
            }
          }
          avgRetention.push(
            totalWeight > 0
              ? Math.round((weightedSum / totalWeight) * 10) / 10
              : 0
          );
        }

        return {
          label: bv,
          parts: splitBreakdownValue(bv),
          color: SERIES_COLORS[idx % SERIES_COLORS.length],
          size: totalSize,
          retention: avgRetention,
        };
      });

      summaryRows.sort(
        (a, b) =>
          (b.retention[1] ?? b.retention[0] ?? 0) -
          (a.retention[1] ?? a.retention[0] ?? 0)
      );

      return (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{
              mb: 1,
              px: 0.5,
              color: 'text.secondary',
              fontSize: '0.78rem',
            }}
          >
            {t('argus.analytics.breakdownComparison', 'Breakdown Comparison')}
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 1, opacity: 0.6 }}
            >
              ({breakdownProperties.join(' · ')})
            </Typography>
          </Typography>
          <Box
            sx={{
              overflowX: 'auto',
              border: `1px solid ${borderColor}`,
              borderRadius: 1,
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.78rem',
              }}
            >
              <thead>
                <tr>
                  {breakdownProperties.length > 1 ? (
                    breakdownProperties.map((prop) => (
                      <th
                        key={prop}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderBottom: `1px solid ${borderColor}`,
                          color: theme.palette.text.secondary,
                          fontWeight: 600,
                          position: 'sticky',
                          left: 0,
                          background: theme.palette.background.paper,
                          zIndex: 2,
                          minWidth: 90,
                        }}
                      >
                        {prop}
                      </th>
                    ))
                  ) : (
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderBottom: `1px solid ${borderColor}`,
                        color: theme.palette.text.secondary,
                        fontWeight: 600,
                        position: 'sticky',
                        left: 0,
                        background: theme.palette.background.paper,
                        zIndex: 2,
                        minWidth: 120,
                      }}
                    >
                      {t('argus.analytics.breakdownValue', 'Segment')}
                    </th>
                  )}
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '10px 12px',
                      borderBottom: `1px solid ${borderColor}`,
                      color: theme.palette.text.secondary,
                      fontWeight: 600,
                      minWidth: 60,
                    }}
                  >
                    {t('argus.analytics.cohortSize', 'Size')}
                  </th>
                  {Array.from({ length: maxPeriods }, (_, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '8px 6px',
                        textAlign: 'center',
                        borderBottom: `1px solid ${borderColor}`,
                        color: theme.palette.text.secondary,
                        fontWeight: 600,
                        minWidth: 50,
                      }}
                    >
                      {`${periodPrefix}${i}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                    }}
                  >
                    {breakdownProperties.length > 1 ? (
                      row.parts.map((part: string, pIdx: number) => (
                        <td
                          key={pIdx}
                          style={{
                            padding: '8px 12px',
                            fontWeight: 600,
                            ...(pIdx === 0
                              ? {
                                  position: 'sticky' as const,
                                  left: 0,
                                  background: theme.palette.background.paper,
                                  zIndex: 1,
                                }
                              : {}),
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            {pIdx === 0 && (
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: row.color,
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 140,
                              }}
                            >
                              {part || '(empty)'}
                            </span>
                          </Box>
                        </td>
                      ))
                    ) : (
                      <td
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 600,
                          position: 'sticky',
                          left: 0,
                          background: theme.palette.background.paper,
                          zIndex: 1,
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: row.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 140,
                          }}
                        >
                          {row.label}
                        </span>
                      </td>
                    )}
                    <td
                      style={{
                        padding: '8px 12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatCompactNumber(row.size)}
                    </td>
                    {row.retention.map((pct, colIdx) => (
                      <td key={colIdx} style={{ padding: '6px 4px' }}>
                        <Box
                          onClick={() =>
                            pct > 0 &&
                            handleBreakdownCellClick(row.label, colIdx)
                          }
                          sx={{
                            width: '100%',
                            height: 26,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 0.5,
                            background:
                              pct > 0
                                ? alpha(
                                    row.color,
                                    Math.min(0.15 + (pct / 100) * 0.55, 0.7)
                                  )
                                : 'transparent',
                            color:
                              pct > 60
                                ? '#fff'
                                : pct > 0
                                  ? theme.palette.text.primary
                                  : theme.palette.text.disabled,
                            fontWeight: pct > 0 ? 600 : 400,
                            fontSize: '0.72rem',
                            cursor: pct > 0 ? 'pointer' : 'default',
                            '&:hover':
                              pct > 0
                                ? {
                                    filter: 'brightness(1.15)',
                                    transform: 'scale(1.02)',
                                  }
                                : {},
                            transition: 'all 0.1s ease',
                          }}
                        >
                          {pct > 0 ? `${pct}%` : '—'}
                        </Box>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      );
    };

    return (
      <Box sx={{ mt: viewMode === 'table' ? 0 : 2 }}>
        {renderBreakdownSummary()}

        <Box
          sx={{
            overflowX: 'auto',
            ...(viewMode !== 'table' && {
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }),
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
                    borderBottom: `1px solid ${borderColor}`,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                    position: 'sticky',
                    left: 0,
                    background: theme.palette.background.paper,
                    zIndex: 2,
                  }}
                >
                  {t('argus.analytics.cohortDate', 'Cohort Date')}
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    borderBottom: `1px solid ${borderColor}`,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                  }}
                >
                  {t('argus.analytics.cohortSize', 'Size')}
                </th>
                {cohorts[0]?.retention?.map((_: any, i: number) => (
                  <th
                    key={i}
                    style={{
                      padding: '8px 8px',
                      textAlign: 'center',
                      borderBottom: `1px solid ${borderColor}`,
                      color: theme.palette.text.secondary,
                      fontWeight: 600,
                      minWidth: 42,
                    }}
                  >
                    {`${periodPrefix}${i}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort, rowIdx) => (
                <tr key={rowIdx}>
                  <td
                    style={{
                      padding: '6px 12px',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                      position: 'sticky',
                      left: 0,
                      background: theme.palette.background.paper,
                      zIndex: 1,
                    }}
                  >
                    {String(cohort.cohort_date).substring(0, 10)}
                  </td>
                  <td
                    style={{
                      padding: '6px 12px',
                      textAlign: 'right',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      fontWeight: 700,
                    }}
                  >
                    {formatCompactNumber(cohort.cohort_size)}
                  </td>
                  {cohort.retention?.map((pct: number, colIdx: number) => (
                    <td
                      key={colIdx}
                      style={{
                        padding: '6px 4px',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      }}
                    >
                      <Box
                        onClick={() =>
                          pct > 0 &&
                          handleCellClick(String(cohort.cohort_date), colIdx)
                        }
                        sx={{
                          width: '100%',
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 1,
                          background:
                            pct > 0
                              ? alpha(getHeatColor(pct), isDark ? 0.6 : 0.85)
                              : 'transparent',
                          color:
                            pct > 50
                              ? '#fff'
                              : pct > 0
                                ? theme.palette.text.primary
                                : theme.palette.text.disabled,
                          fontWeight: pct > 0 ? 600 : 400,
                          cursor: pct > 0 ? 'pointer' : 'default',
                          '&:hover':
                            pct > 0
                              ? {
                                  filter: 'brightness(1.15)',
                                  transform: 'scale(1.02)',
                                }
                              : {},
                          transition: 'all 0.1s ease',
                        }}
                      >
                        {pct > 0 ? `${pct}%` : '—'}
                      </Box>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {viewMode === 'line' && renderCurveView()}
      {viewMode === 'bar' && renderBarView()}
      {viewMode === 'metric' && renderMetricView()}
      {viewMode === 'table' && renderHeatmapTable()}
      {(viewMode === 'line' || viewMode === 'bar') && renderHeatmapTable()}
    </Box>
  );
};

/* ─── Helpers ─── */

function getHeatColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#10b981';
  if (pct >= 40) return '#34d399';
  if (pct >= 20) return '#6ee7b7';
  if (pct >= 10) return '#a7f3d0';
  return '#d1fae5';
}
