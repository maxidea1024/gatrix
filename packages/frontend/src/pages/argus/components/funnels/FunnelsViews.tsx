import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import { ArrowDownward as ArrowDownIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts';

import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import { useFunnelsStore } from '@/hooks/useAnalyticsStore';
import { useSharedEventCatalog } from '../../hooks/useSharedEventCatalog';
import { formatCompactNumber } from '@/utils/numberFormat';
import { splitBreakdownValue } from '../analytics/breakdownUtils';
import EventLabel from '@/components/argus/EventLabel';

import { FUNNEL_COLORS, SEGMENT_COLORS } from './FunnelsLeftPanel';
import type { AnalyticsEventNameEntry } from '@/services/argusService';

interface FunnelsViewsProps {
  result: any;
  chartSubType: 'funnel' | 'metric';
  handleBarClick: (eventName: string) => void;
}

export const FunnelsViews: React.FC<FunnelsViewsProps> = ({
  result,
  chartSubType,
  handleBarClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Persisted Store State ──
  const viewMode = useFunnelsStore((s) => s.viewMode);
  const chartLayout = useFunnelsStore((s) => s.chartLayout);
  const breakdownProperties = useFunnelsStore((s) => s.breakdownProperties);
  const setDateRange = useFunnelsStore((s) => s.setDateRange);

  // ── Shared Event Catalog ──
  const { availableEvents } = useSharedEventCatalog(projectId);

  // ── Local Visualization State ──
  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Set<string>>(
    new Set()
  );
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);

  const handleZoom = useCallback(() => {
    if (refAreaLeft === refAreaRight || !refAreaLeft || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    const parseLocalDate = (dateStr: string) => {
      const cleanStr = dateStr.replace(' ', 'T');
      if (cleanStr.includes('T')) {
        return new Date(cleanStr);
      }
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return new Date(dateStr);
    };

    const leftDate = parseLocalDate(refAreaLeft);
    const rightDate = parseLocalDate(refAreaRight);

    if (isNaN(leftDate.getTime()) || isNaN(rightDate.getTime())) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    const start = leftDate <= rightDate ? leftDate : rightDate;
    const end = leftDate <= rightDate ? rightDate : leftDate;

    // Set end to the end of that day (23:59:59.999) if it was just a date string (no time part)
    if (!refAreaRight.includes(':') && !refAreaLeft.includes(':')) {
      end.setHours(23, 59, 59, 999);
    }

    setDateRange({ type: 'custom', start, end });
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, setDateRange]);

  // Reset hidden keys when result changes
  React.useEffect(() => {
    setHiddenSeriesKeys(new Set());
  }, [result]);

  const { localizeEventName: lfn } = useLocalizedLexicon();

  // Lexicon Map for translating event keys → localized display name
  const lexiconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of availableEvents) {
      const localized = lfn(e.name, e.display_name, e.is_reserved);
      if (localized && localized !== e.name) map.set(e.name, localized);
    }
    return map;
  }, [availableEvents, lfn]);

  // Event metadata map for EventLabel
  const eventMetaMap = useMemo(() => {
    const map = new Map<string, AnalyticsEventNameEntry>();
    for (const e of availableEvents) {
      map.set(e.name, e);
    }
    return map;
  }, [availableEvents]);

  // ── Chart Data ──
  const chartData = useMemo(() => {
    if (!result?.steps) return [];
    return result.steps.map((s: any, i: number) => ({
      name: lexiconMap.get(s.name) || s.name,
      count: s.count,
      rate: s.conversion_rate,
      fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    }));
  }, [result, lexiconMap]);

  const trendingData = useMemo(() => {
    if (!result?.trending) return [];

    const dataMap = new Map<string, Record<string, any>>();
    for (const t of result.trending) {
      dataMap.set(t.date, {
        date: t.date,
        conversion_rate: t.conversion_rate,
      });
    }

    if (result.breakdowns) {
      for (const [bdKey, bdVal] of Object.entries(result.breakdowns)) {
        const bdTrending = (bdVal as any).trending || [];
        const displayName =
          splitBreakdownValue(bdKey).join(' · ') || bdKey || '(empty)';
        for (const t of bdTrending) {
          const entry = dataMap.get(t.date) || { date: t.date };
          entry[displayName] = t.conversion_rate;
          dataMap.set(t.date, entry);
        }
      }
    }

    if (result.segments) {
      const segKeys = result.segments.map((s: any, idx: number) => {
        let label = s.name || `Segment ${idx + 1}`;
        if (label === 'Overall') label = `${label} (${idx + 1})`;
        return label;
      });
      const seen = new Set<string>();
      const uniqueKeys = segKeys.map((k: string, idx: number) => {
        if (seen.has(k)) return `${k} (${idx + 1})`;
        seen.add(k);
        return k;
      });

      result.segments.forEach((seg: any, idx: number) => {
        const segTrending = seg.trending || [];
        const key = uniqueKeys[idx];
        for (const t of segTrending) {
          const entry = dataMap.get(t.date) || { date: t.date };
          entry[key] = t.conversion_rate;
          dataMap.set(t.date, entry);
        }
      });
    }

    return Array.from(dataMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [result]);

  const timeToConvertData = useMemo(() => {
    if (!result?.time_to_convert) return [];
    return result.time_to_convert.distribution || [];
  }, [result]);

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

  /* ─── Render: Breakdown Comparison Table ─── */
  const renderBreakdownComparison = () => {
    const breakdowns = result?.breakdowns;
    if (!breakdowns || Object.keys(breakdowns).length === 0) return null;

    const BD_COLORS = [
      '#6366f1',
      '#f59e0b',
      '#10b981',
      '#ef4444',
      '#8b5cf6',
      '#06b6d4',
      '#f97316',
      '#ec4899',
      '#14b8a6',
      '#84cc16',
    ];

    const stepNames = (result.steps as any[]).map((s: any) => ({
      raw: s.name,
      display: lexiconMap.get(s.name) || s.name,
    }));

    const overallRow = {
      label: t('argus.analytics.overallConversion', 'Overall'),
      color: '#94a3b8',
      conversion: result.overall_conversion ?? 0,
      steps: (result.steps as any[]).map((s: any) => s.count),
      isOverall: true,
    };

    const bdRows = Object.keys(breakdowns)
      .map((bv, idx) => ({
        label: bv,
        parts: splitBreakdownValue(bv),
        color: BD_COLORS[idx % BD_COLORS.length],
        conversion: breakdowns[bv].overall_conversion ?? 0,
        steps: (breakdowns[bv].steps || []).map((s: any) => s.count ?? 0),
        isOverall: false,
      }))
      .sort((a, b) => b.conversion - a.conversion);

    const allRows = [overallRow, ...bdRows];
    const maxConversion = Math.max(...allRows.map((r) => r.conversion), 1);

    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
    const thStyle: React.CSSProperties = {
      padding: '10px 12px',
      borderBottom: `1px solid ${borderColor}`,
      color: theme.palette.text.secondary,
      fontWeight: 600,
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
    };

    return (
      <Box sx={{ mt: 4 }}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mb: 1.5, px: 1, color: 'text.secondary' }}
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
              fontSize: '0.8rem',
            }}
          >
            <thead>
              <tr>
                {breakdownProperties.length > 1 ? (
                  breakdownProperties.map((prop) => (
                    <th
                      key={prop}
                      style={{ ...thStyle, textAlign: 'left', minWidth: 100 }}
                    >
                      {prop}
                    </th>
                  ))
                ) : (
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>
                    {t('argus.analytics.breakdownValue', 'Breakdown Value')}
                  </th>
                )}
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 200 }}>
                  {t('argus.analytics.totalConversion', 'Overall Conversion')}
                </th>
                {stepNames.map((sn, i) => (
                  <th
                    key={i}
                    style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}
                  >
                    <Tooltip title={sn.raw} placement="top" arrow>
                      <span>
                        {(() => {
                          const meta = eventMetaMap.get(sn.raw);
                          return (
                            <EventLabel
                              eventName={sn.raw}
                              displayName={meta?.display_name}
                              icon={meta?.icon}
                              iconColor={meta?.icon_color}
                              isReserved={meta?.is_reserved}
                              size="compact"
                            />
                          );
                        })()}
                      </span>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    opacity: row.isOverall ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'transparent';
                  }}
                >
                  {breakdownProperties.length > 1 ? (
                    (row as any).parts ? (
                      (row as any).parts.map((part: string, pIdx: number) => (
                        <td
                          key={pIdx}
                          style={{
                            padding: '10px 12px',
                            fontWeight: row.isOverall ? 700 : 500,
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
                                maxWidth: 160,
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
                          padding: '10px 12px',
                          fontWeight: row.isOverall ? 700 : 500,
                        }}
                        colSpan={breakdownProperties.length}
                      >
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
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
                          <span>{row.label}</span>
                        </Box>
                      </td>
                    )
                  ) : (
                    <td
                      style={{
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: row.isOverall ? 700 : 500,
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
                          maxWidth: 160,
                        }}
                      >
                        {row.label}
                      </span>
                    </td>
                  )}

                  <td style={{ padding: '10px 12px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          flex: 1,
                          height: 16,
                          bgcolor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.04)',
                          borderRadius: 0.5,
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${(row.conversion / maxConversion) * 100}%`,
                            bgcolor: alpha(row.color, 0.6),
                            borderRadius: 0.5,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          minWidth: 44,
                          textAlign: 'right',
                          fontSize: '0.78rem',
                        }}
                      >
                        {row.conversion}%
                      </Typography>
                    </Box>
                  </td>

                  {row.steps.map((count: number, sIdx: number) => (
                    <td
                      key={sIdx}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatCompactNumber(count)}
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

  /* ─── Render: Breakdown Funnel Chart ─── */
  const renderBreakdownFunnelChart = () => {
    const breakdowns = result.breakdowns;
    const bdKeys = Object.keys(breakdowns).slice(0, 10);
    const stepDefs = result.steps as any[];
    const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const BDC = [
      '#6366f1',
      '#f59e0b',
      '#10b981',
      '#ec4899',
      '#3b82f6',
      '#ef4444',
      '#8b5cf6',
      '#14b8a6',
      '#f97316',
      '#84cc16',
    ];
    const globalMax = Math.max(
      ...bdKeys.flatMap((bk) =>
        ((breakdowns[bk].steps || []) as any[]).map((s: any) => s.count ?? 0)
      ),
      1
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, px: 1 }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: '#6366f1' }}>
            {result.overall_conversion ?? 0}%
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
          >
            {t(
              'argus.analytics.overallConversionRate',
              'Overall Conversion Rate'
            )}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', px: 1 }}>
          {bdKeys.map((key, idx) => (
            <Box
              key={key}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: BDC[idx % BDC.length],
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{ fontSize: '0.72rem', color: 'text.secondary' }}
              >
                {splitBreakdownValue(key).join(' · ') || key || '(empty)'}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
            <Box
              sx={{
                width: 40,
                flexShrink: 0,
                position: 'relative',
                height: 280,
                alignSelf: 'flex-end',
              }}
            >
              {[0, 25, 50, 75, 100].map((tick) => (
                <Typography
                  key={tick}
                  sx={{
                    position: 'absolute',
                    bottom: `${tick}%`,
                    right: 12,
                    fontSize: '0.6rem',
                    color: 'text.disabled',
                    lineHeight: 1,
                    transform: 'translateY(50%)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tick}%
                </Typography>
              ))}
            </Box>

            <Box sx={{ flex: 1, position: 'relative' }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              >
                {[0, 25, 50, 75, 100].map((tick) => (
                  <Box
                    key={tick}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: `${tick}%`,
                      borderTop: `1px solid ${gridStroke}`,
                    }}
                  />
                ))}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  height: 280,
                  gap: '8px',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {stepDefs.map((step, stepIdx) => (
                  <Box
                    key={stepIdx}
                    sx={{
                      flex: 1,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '2px',
                      minWidth: 0,
                      position: 'relative',
                    }}
                  >
                    {bdKeys.map((bdKey, bdIdx) => {
                      const bdSteps = (breakdowns[bdKey].steps || []) as any[];
                      const bdStep = bdSteps[stepIdx];
                      const prevBdStep =
                        stepIdx > 0 ? bdSteps[stepIdx - 1] : null;
                      const count = bdStep?.count ?? 0;
                      const rate = bdStep?.conversion_rate ?? 0;
                      const prevCount = prevBdStep?.count ?? 0;
                      const color = BDC[bdIdx % BDC.length];
                      const filledPct =
                        globalMax > 0 ? (count / globalMax) * 100 : 0;
                      const ghostPct =
                        stepIdx > 0 && globalMax > 0
                          ? (prevCount / globalMax) * 100
                          : 0;
                      const dropCount =
                        prevBdStep && prevCount > count ? prevCount - count : 0;

                      return (
                        <Box
                          key={bdKey}
                          sx={{
                            flex: 1,
                            height: '100%',
                            position: 'relative',
                            minWidth: 0,
                          }}
                        >
                          {stepIdx > 0 && ghostPct > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: `${ghostPct}%`,
                                bgcolor: 'background.paper',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.5s ease',
                                zIndex: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  bgcolor: `${color}1c`,
                                  borderRadius: 'inherit',
                                }}
                              />
                              {dropCount > 0 &&
                                ghostPct - filledPct > 12 &&
                                (() => {
                                  const pct =
                                    ((ghostPct - filledPct) / 2 / ghostPct) *
                                    100;
                                  return (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: `${pct}%`,
                                        transform: 'translateY(-50%)',
                                        left: 0,
                                        right: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      <Typography
                                        sx={{
                                          fontSize: '0.5rem',
                                          color: '#ef4444',
                                          opacity: 0.7,
                                          fontWeight: 700,
                                        }}
                                      >
                                        −{formatCompactNumber(dropCount)}
                                      </Typography>
                                    </Box>
                                  );
                                })()}
                            </Box>
                          )}
                          {stepIdx > 0 &&
                            ghostPct > filledPct &&
                            filledPct > 1 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: `${filledPct}%`,
                                  left: 0,
                                  right: 0,
                                  borderTop: '1px dashed rgba(239,68,68,0.25)',
                                  pointerEvents: 'none',
                                  zIndex: 2,
                                }}
                              />
                            )}
                          <Tooltip
                            title={`${splitBreakdownValue(bdKey).join(' · ') || bdKey}: ${formatCompactNumber(count)} (${rate}%)`}
                            placement="top"
                            arrow
                          >
                            <Box
                              onClick={() => handleBarClick(step.name)}
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height:
                                  count > 0
                                    ? `${Math.max(filledPct, 0.5)}%`
                                    : 0,
                                minHeight: count > 0 ? 3 : 0,
                                bgcolor: color,
                                borderRadius: '4px 4px 0 0',
                                cursor: 'pointer',
                                transition:
                                  'height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease',
                                '&:hover': {
                                  filter: 'brightness(1.1)',
                                  zIndex: 3,
                                },
                                zIndex: 2,
                              }}
                            />
                          </Tooltip>
                          {count > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: `${Math.max(filledPct, 0.5)}%`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                mb: '2px',
                                bgcolor: isDark
                                  ? 'rgba(18,18,30,0.92)'
                                  : 'rgba(255,255,255,0.97)',
                                borderRadius: '3px',
                                px: '3px',
                                py: '1px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                zIndex: 10,
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  color: 'text.primary',
                                  lineHeight: 1.2,
                                }}
                              >
                                {rate}%
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: '0.55rem',
                                  color: 'text.secondary',
                                  lineHeight: 1,
                                }}
                              >
                                {formatCompactNumber(count)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: '8px',
              mt: 0.25,
              height: 44,
              pl: '40px',
            }}
          >
            {stepDefs.map((step, stepIdx) => (
              <Tooltip key={stepIdx} title={step.name} placement="bottom" arrow>
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 0.25,
                    pt: 0.5,
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '4px',
                      bgcolor: FUNNEL_COLORS[stepIdx % FUNNEL_COLORS.length],
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {stepIdx + 1}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: 500,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'text.secondary',
                      textAlign: 'center',
                      display: 'block',
                    }}
                  >
                    {lexiconMap.get(step.name) || step.name}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>

        {renderBreakdownComparison()}
      </Box>
    );
  };

  /* ─── Render: Metric-Only View ─── */
  const renderMetricOnlyView = () => {
    if (chartData.length === 0) return null;
    const bdLine = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const thStyle: React.CSSProperties = {
      textAlign: 'right',
      padding: '12px 16px',
      borderBottom: `1px solid ${bdLine}`,
      color: theme.palette.text.secondary,
      fontWeight: 600,
    };
    const maxCount = Math.max(...chartData.map((d: any) => d.count), 1);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, px: 1 }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: '#6366f1' }}>
            {result?.overall_conversion ?? 0}%
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
          >
            {t(
              'argus.analytics.overallConversionRate',
              'Overall Conversion Rate'
            )}
          </Typography>
        </Box>
        <Box
          sx={{
            overflowX: 'auto',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
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
                    borderBottom: `1px solid ${bdLine}`,
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                  }}
                >
                  {t('argus.analytics.step', 'Step')}
                </th>
                <th style={thStyle}>{t('argus.analytics.users', 'Users')}</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 180 }}>
                  {t('argus.analytics.conversion', 'Conversion')}
                </th>
                <th style={thStyle}>
                  {t('argus.analytics.dropOff', 'Drop-off')}
                </th>
                <th style={thStyle}>
                  {t('argus.analytics.stepToStep', 'Step-to-Step')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result?.steps.map((s: any, idx: number) => {
                const prevCount =
                  idx > 0 ? result.steps[idx - 1].count : s.count;
                const dropOff = idx > 0 ? prevCount - s.count : 0;
                const dropPct =
                  idx > 0 && prevCount > 0
                    ? Math.round((1 - s.count / prevCount) * 1000) / 10
                    : 0;
                const stepToStep =
                  idx === 0
                    ? 100
                    : prevCount > 0
                      ? Math.round((s.count / prevCount) * 1000) / 10
                      : 0;
                const convBarWidth =
                  maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                    }}
                    onClick={() => handleBarClick(s.name)}
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
                          width: 20,
                          height: 20,
                          borderRadius: '4px',
                          bgcolor: FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: 800,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      {(() => {
                        const meta = eventMetaMap.get(s.name);
                        return (
                          <EventLabel
                            eventName={s.name}
                            displayName={meta?.display_name}
                            icon={meta?.icon}
                            iconColor={meta?.icon_color}
                            isReserved={meta?.is_reserved}
                            size="compact"
                          />
                        );
                      })()}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {formatCompactNumber(s.count)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.06)',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 0,
                              height: '100%',
                              width: `${convBarWidth}%`,
                              bgcolor:
                                FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                              borderRadius: 3,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </Box>
                        <span
                          style={{
                            minWidth: 44,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {s.conversion_rate}%
                        </span>
                      </Box>
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        color: dropOff > 0 ? '#ef4444' : 'inherit',
                      }}
                    >
                      {idx > 0 ? (
                        <>
                          <span>-{formatCompactNumber(dropOff)}</span>
                          <span
                            style={{
                              opacity: 0.7,
                              marginLeft: 4,
                              fontSize: '0.75rem',
                            }}
                          >
                            ({dropPct}%)
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 500,
                      }}
                    >
                      {idx > 0 ? `${stepToStep}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
        {renderBreakdownComparison()}
        {renderSegmentComparison()}
      </Box>
    );
  };

  /* ─── Render: Breakdown Horizontal Chart ─── */
  const renderBreakdownHorizontalChart = () => {
    const breakdowns = result.breakdowns;
    const bdKeys = Object.keys(breakdowns).slice(0, 10);
    const stepDefs = result.steps as any[];
    const BDC = [
      '#6366f1',
      '#f59e0b',
      '#10b981',
      '#ec4899',
      '#3b82f6',
      '#ef4444',
      '#8b5cf6',
      '#14b8a6',
      '#f97316',
      '#84cc16',
    ];
    const globalMax = Math.max(
      ...bdKeys.flatMap((bk) =>
        ((breakdowns[bk].steps || []) as any[]).map((s: any) => s.count ?? 0)
      ),
      1
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, px: 1 }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: '#6366f1' }}>
            {result.overall_conversion ?? 0}%
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
          >
            {t(
              'argus.analytics.overallConversionRate',
              'Overall Conversion Rate'
            )}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', px: 1 }}>
          {bdKeys.map((key, idx) => (
            <Box
              key={key}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: BDC[idx % BDC.length],
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{ fontSize: '0.72rem', color: 'text.secondary' }}
              >
                {splitBreakdownValue(key).join(' · ') || key || '(empty)'}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ px: 1, py: 1 }}>
          {stepDefs.map((step, stepIdx) => {
            const stepColor = FUNNEL_COLORS[stepIdx % FUNNEL_COLORS.length];

            return (
              <React.Fragment key={stepIdx}>
                {stepIdx > 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      pl: '142px',
                      py: 0.25,
                      minHeight: 16,
                      opacity: 0.6,
                    }}
                  >
                    <ArrowDownIcon
                      sx={{ fontSize: 12, color: 'text.disabled' }}
                    />
                  </Box>
                )}
                <Box sx={{ mb: 0.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 0.5,
                      px: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: '5px',
                        bgcolor: stepColor,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {stepIdx + 1}
                    </Box>
                    <Tooltip title={step.name} placement="top" arrow>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {lexiconMap.get(step.name) || step.name}
                      </Typography>
                    </Tooltip>
                  </Box>
                  {bdKeys.map((bdKey, bdIdx) => {
                    const bdSteps = (breakdowns[bdKey].steps || []) as any[];
                    const bdStep = bdSteps[stepIdx];
                    const count = bdStep?.count ?? 0;
                    const rate = bdStep?.conversion_rate ?? 0;
                    const color = BDC[bdIdx % BDC.length];
                    const barWidth =
                      globalMax > 0 ? (count / globalMax) * 100 : 0;

                    return (
                      <Box
                        key={bdKey}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1,
                          py: '2px',
                        }}
                      >
                        <Box
                          sx={{
                            width: 120,
                            flexShrink: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.68rem',
                              color: 'text.secondary',
                            }}
                          >
                            {splitBreakdownValue(bdKey).join(' · ') ||
                              bdKey ||
                              '(empty)'}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, position: 'relative', height: 22 }}>
                          <Box
                            onClick={() => handleBarClick(step.name)}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              bottom: 0,
                              width:
                                count > 0 ? `${Math.max(barWidth, 0.5)}%` : 0,
                              bgcolor: color,
                              borderRadius: 1,
                              transition: 'width 0.6s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              pr: barWidth > 15 ? 0.75 : 0,
                              cursor: 'pointer',
                              '&:hover': { filter: 'brightness(1.15)' },
                            }}
                          >
                            {barWidth > 15 && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '0.65rem',
                                  lineHeight: 1,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                }}
                              >
                                {rate}%
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            minWidth: 40,
                            textAlign: 'right',
                            flexShrink: 0,
                          }}
                        >
                          {formatCompactNumber(count)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.65rem',
                            color:
                              rate >= 70
                                ? '#10b981'
                                : rate >= 30
                                  ? '#f59e0b'
                                  : '#ef4444',
                            minWidth: 32,
                            textAlign: 'right',
                            flexShrink: 0,
                          }}
                        >
                          {rate}%
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </React.Fragment>
            );
          })}
        </Box>

        {renderBreakdownComparison()}
      </Box>
    );
  };

  /* ─── Render: Steps View ─── */
  const renderStepsView = () => {
    if (chartData.length === 0) return null;

    const hasBreakdown =
      breakdownProperties.length > 0 &&
      result?.breakdowns &&
      Object.keys(result.breakdowns).length > 0;
    if (hasBreakdown) {
      return chartLayout === 'vertical'
        ? renderBreakdownFunnelChart()
        : renderBreakdownHorizontalChart();
    }

    const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const maxCount = Math.max(...chartData.map((d: any) => d.count), 1);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 1.5,
            mb: 1,
            px: 1,
          }}
        >
          <Typography variant="h3" fontWeight={800} sx={{ color: '#6366f1' }}>
            {result?.overall_conversion ?? 0}%
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
          >
            {t(
              'argus.analytics.overallConversionRate',
              'Overall Conversion Rate'
            )}
          </Typography>
        </Box>

        {chartLayout === 'vertical' ? (
          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
            <Box
              sx={{
                width: 40,
                flexShrink: 0,
                position: 'relative',
                height: 280,
                alignSelf: 'flex-end',
              }}
            >
              {[0, 25, 50, 75, 100].map((tick) => (
                <Typography
                  key={tick}
                  sx={{
                    position: 'absolute',
                    bottom: `${tick}%`,
                    right: 12,
                    fontSize: '0.6rem',
                    color: 'text.disabled',
                    lineHeight: 1,
                    transform: 'translateY(50%)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tick}%
                </Typography>
              ))}
            </Box>

            <Box sx={{ flex: 1, position: 'relative' }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              >
                {[0, 25, 50, 75, 100].map((tick) => (
                  <Box
                    key={tick}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: `${tick}%`,
                      borderTop: `1px solid ${gridStroke}`,
                    }}
                  />
                ))}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  height: 280,
                  alignItems: 'flex-end',
                  gap: '3px',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {chartData.map((entry: any, idx: number) => {
                  const prevEntry = idx > 0 ? chartData[idx - 1] : null;
                  const prevCount = prevEntry ? prevEntry.count : entry.count;
                  const filledPct =
                    maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
                  const ghostPct =
                    prevEntry && maxCount > 0
                      ? (prevCount / maxCount) * 100
                      : 0;
                  const dropCount = prevEntry
                    ? prevEntry.count - entry.count
                    : 0;
                  const dropPct =
                    prevEntry && prevEntry.count > 0
                      ? Math.round((dropCount / prevEntry.count) * 1000) / 10
                      : 0;

                  return (
                    <Box
                      key={idx}
                      sx={{
                        flex: 1,
                        height: '100%',
                        position: 'relative',
                        minWidth: 0,
                      }}
                    >
                      {idx > 0 && ghostPct > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${ghostPct}%`,
                            bgcolor: 'background.paper',
                            borderRadius: '6px 6px 0 0',
                            transition: 'height 0.5s ease',
                            zIndex: 1,
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: 0,
                              right: 0,
                              bgcolor: `${entry.fill}1c`,
                              borderRadius: 'inherit',
                            }}
                          />
                          {dropCount > 0 &&
                            ghostPct - filledPct > 5 &&
                            (() => {
                              const dropZoneTopPct =
                                ((ghostPct - filledPct) / 2 / ghostPct) * 100;
                              return (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: `${dropZoneTopPct}%`,
                                    transform: 'translateY(-50%)',
                                    left: 0,
                                    right: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    pointerEvents: 'none',
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: '0.6rem',
                                      color: '#ef4444',
                                      opacity: 0.8,
                                      fontWeight: 700,
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    −{formatCompactNumber(dropCount)}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontSize: '0.55rem',
                                      color: '#ef4444',
                                      opacity: 0.55,
                                      lineHeight: 1,
                                    }}
                                  >
                                    −{dropPct}%
                                  </Typography>
                                </Box>
                              );
                            })()}
                        </Box>
                      )}

                      {idx > 0 && ghostPct > filledPct && filledPct > 1 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: `${filledPct}%`,
                            left: 0,
                            right: 0,
                            borderTop: '1.5px dashed rgba(239,68,68,0.3)',
                            pointerEvents: 'none',
                            zIndex: 2,
                          }}
                        />
                      )}

                      <Tooltip
                        title={`${lexiconMap.get(entry.name) || entry.name}: ${formatCompactNumber(entry.count)} (${entry.rate}%)`}
                        placement="top"
                        arrow
                      >
                        <Box
                          onClick={() => handleBarClick(entry.name)}
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height:
                              entry.count > 0
                                ? `${Math.max(filledPct, 1)}%`
                                : 0,
                            minHeight: entry.count > 0 ? 4 : 0,
                            bgcolor: entry.fill,
                            borderRadius: '6px 6px 0 0',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pt: filledPct > 8 ? 1 : 0,
                            transition:
                              'height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease',
                            '&:hover': { filter: 'brightness(1.1)', zIndex: 3 },
                            zIndex: 2,
                          }}
                        >
                          {filledPct > 8 && (
                            <>
                              <Typography
                                sx={{
                                  color: 'rgba(255,255,255,0.95)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  lineHeight: 1.3,
                                }}
                              >
                                {entry.rate}%
                              </Typography>
                              {filledPct > 18 && (
                                <Typography
                                  sx={{
                                    color: 'rgba(255,255,255,0.75)',
                                    fontSize: '0.65rem',
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {formatCompactNumber(entry.count)}
                                </Typography>
                              )}
                            </>
                          )}
                        </Box>
                      </Tooltip>

                      {filledPct <= 8 && entry.count > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: `${Math.max(filledPct, 1) + 1}%`,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pointerEvents: 'none',
                            zIndex: 3,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              color: 'text.primary',
                              lineHeight: 1.2,
                            }}
                          >
                            {entry.rate}%
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.6rem',
                              color: 'text.secondary',
                              lineHeight: 1,
                            }}
                          >
                            {formatCompactNumber(entry.count)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ display: 'flex', gap: '3px', mt: 1, height: 44 }}>
                {chartData.map((entry: any, idx: number) => (
                  <Tooltip
                    key={idx}
                    title={entry.name}
                    placement="bottom"
                    arrow
                  >
                    <Box
                      sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 0.25,
                        pt: 0.5,
                        minWidth: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: '4px',
                          bgcolor: entry.fill,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'text.secondary',
                          textAlign: 'center',
                          display: 'block',
                        }}
                      >
                        {lexiconMap.get(entry.name) || entry.name}
                      </Typography>
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ px: 1, py: 1 }}>
            {chartData.map((entry: any, idx: number) => {
              const barWidth = (entry.count / maxCount) * 100;
              const prevCount =
                idx > 0 ? chartData[idx - 1].count : entry.count;
              const ghostWidth =
                idx > 0 && maxCount > 0 ? (prevCount / maxCount) * 100 : 0;
              const convRate =
                idx === 0
                  ? 100
                  : prevCount > 0
                    ? Math.round((entry.count / prevCount) * 1000) / 10
                    : 0;
              const dropCount = idx > 0 ? prevCount - entry.count : 0;
              const dropPct =
                idx > 0 && prevCount > 0
                  ? Math.round((dropCount / prevCount) * 1000) / 10
                  : 0;
              const convColor =
                convRate >= 70
                  ? '#10b981'
                  : convRate >= 30
                    ? '#f59e0b'
                    : '#ef4444';

              return (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        pl: '142px',
                        py: 0.25,
                        minHeight: 20,
                        opacity: 0.75,
                      }}
                    >
                      <ArrowDownIcon
                        sx={{ fontSize: 12, color: 'text.disabled' }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: convColor,
                        }}
                      >
                        {convRate}%
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled' }}
                      >
                        ·
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.65rem', color: '#ef4444' }}
                      >
                        −{formatCompactNumber(dropCount)} (−{dropPct}%)
                      </Typography>
                    </Box>
                  )}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1,
                      py: 0.5,
                    }}
                  >
                    <Tooltip title={entry.name} placement="left" arrow>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          minWidth: 130,
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: 22,
                            height: 22,
                            borderRadius: '5px',
                            bgcolor: entry.fill,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            maxWidth: 100,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {lexiconMap.get(entry.name) || entry.name}
                        </Typography>
                      </Box>
                    </Tooltip>
                    <Box sx={{ flex: 1, position: 'relative', height: 38 }}>
                      {idx > 0 && ghostWidth > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: `${ghostWidth}%`,
                            bgcolor: `${entry.fill}1c`,
                            borderRadius: 1.5,
                            transition: 'width 0.6s ease',
                          }}
                        />
                      )}
                      <Box
                        onClick={() => handleBarClick(entry.name)}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: entry.count > 0 ? `${barWidth}%` : 0,
                          bgcolor: entry.fill,
                          borderRadius: 1.5,
                          transition: 'width 0.6s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          pr: 1,
                          cursor: 'pointer',
                          '&:hover': { filter: 'brightness(1.15)' },
                        }}
                      >
                        {barWidth > 20 && (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                lineHeight: 1.2,
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              }}
                            >
                              {entry.rate}%
                            </Typography>
                            {barWidth > 28 && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'rgba(255,255,255,0.75)',
                                  fontSize: '0.65rem',
                                  lineHeight: 1,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                }}
                              >
                                {formatCompactNumber(entry.count)}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexShrink: 0,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          minWidth: 50,
                          textAlign: 'right',
                        }}
                      >
                        {formatCompactNumber(entry.count)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          color:
                            entry.rate >= 70
                              ? '#10b981'
                              : entry.rate >= 30
                                ? '#f59e0b'
                                : '#ef4444',
                          minWidth: 35,
                          textAlign: 'right',
                        }}
                      >
                        {entry.rate}%
                      </Typography>
                    </Box>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        )}

        <Box sx={{ overflowX: 'auto', borderTop: `1px solid ${gridStroke}` }}>
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
                  {t('argus.analytics.step', 'Step')}
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
                  {t('argus.analytics.users', 'Users')}
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
                  {t('argus.analytics.conversion', 'Conversion')}
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
                  {t('argus.analytics.dropOff', 'Drop-off')}
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
                  {t('argus.analytics.stepToStep', 'Step-to-Step')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result?.steps.map((s: any, idx: number) => {
                const prevCount =
                  idx > 0 ? result.steps[idx - 1].count : s.count;
                const dropOff = idx > 0 ? prevCount - s.count : 0;
                const dropPct =
                  idx > 0 && prevCount > 0
                    ? Math.round((1 - s.count / prevCount) * 1000) / 10
                    : 0;
                const stepToStep =
                  idx === 0
                    ? 100
                    : prevCount > 0
                      ? Math.round((s.count / prevCount) * 1000) / 10
                      : 0;
                const convBarWidth =
                  maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                    }}
                    onClick={() => handleBarClick(s.name)}
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
                          width: 20,
                          height: 20,
                          borderRadius: '4px',
                          bgcolor: FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: 800,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      <Tooltip title={s.name} placement="top" arrow>
                        <span>
                          {(() => {
                            const meta = eventMetaMap.get(s.name);
                            return (
                              <EventLabel
                                eventName={s.name}
                                displayName={meta?.display_name}
                                icon={meta?.icon}
                                iconColor={meta?.icon_color}
                                isReserved={meta?.is_reserved}
                                size="compact"
                              />
                            );
                          })()}
                        </span>
                      </Tooltip>
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {formatCompactNumber(s.count)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 1,
                        }}
                      >
                        <Box
                          sx={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.06)',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 0,
                              height: '100%',
                              width: `${convBarWidth}%`,
                              bgcolor:
                                FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                              borderRadius: 3,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </Box>
                        <span style={{ minWidth: 36, textAlign: 'right' }}>
                          {s.conversion_rate}%
                        </span>
                      </Box>
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        color: dropOff > 0 ? '#ef4444' : 'inherit',
                      }}
                    >
                      {idx > 0 ? (
                        <>
                          -{formatCompactNumber(dropOff)}
                          <span
                            style={{
                              opacity: 0.7,
                              marginLeft: 4,
                              fontSize: '0.75rem',
                            }}
                          >
                            ({dropPct}%)
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 500,
                      }}
                    >
                      {idx > 0 ? `${stepToStep}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  };

  /* ─── Render: Segment Comparison Chart ─── */
  const renderSegmentComparison = () => {
    const segs = result?.segments;
    if (!segs || segs.length === 0) return null;

    const segKeys = segs.map((s, idx) => {
      let label = s.name || `Segment ${idx + 1}`;
      if (label === 'Overall') label = `${label} (${idx + 1})`;
      return label;
    });
    const seen = new Set<string>();
    const uniqueKeys = segKeys.map((k, idx) => {
      if (seen.has(k)) return `${k} (${idx + 1})`;
      seen.add(k);
      return k;
    });

    const segChartData = result.steps.map((step, idx) => {
      const point: Record<string, any> = {
        name: lexiconMap.get(step.name) || step.name,
      };
      point['Overall'] = step.conversion_rate;
      for (let sIdx = 0; sIdx < segs.length; sIdx++) {
        point[uniqueKeys[sIdx]] = segs[sIdx].steps[idx]?.conversion_rate ?? 0;
      }
      return point;
    });

    const allKeys = ['Overall', ...uniqueKeys];
    const allColors = ['#94a3b8', ...segs.map((s) => s.color)];

    return (
      <Box sx={{ mt: 4 }}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mb: 2, px: 1, color: 'text.secondary' }}
        >
          {t('argus.analytics.segmentComparison', 'Segment Comparison')}
        </Typography>
        <Box
          sx={{
            minWidth: 0,
            height: { xs: 320, md: '45vh' },
            minHeight: 320,
            maxHeight: 550,
            width: '100%',
            pr: 2,
            userSelect: 'none',
            '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
              outline: 'none',
            },
          }}
        >
          <ResponsiveContainer
            width="99%"
            height="100%"
            minWidth={1}
            minHeight={1}
          >
            <BarChart
              data={segChartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              />
              <XAxis
                dataKey="name"
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
                unit="%"
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
              {allKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  hide={hiddenSeriesKeys.has(key)}
                  fill={allColors[idx % allColors.length]}
                  radius={[4, 4, 0, 0]}
                  opacity={key === 'Overall' ? 0.4 : 1}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };

  /* ─── Render: Trending View ─── */
  const renderTrendingView = () => {
    if (trendingData.length === 0) return null;

    let lines: {
      dataKey: string;
      stroke: string;
      strokeDasharray?: string;
      name: string;
    }[] = [];

    const hasBreakdown =
      breakdownProperties.length > 0 &&
      result?.breakdowns &&
      Object.keys(result.breakdowns).length > 0;

    const hasSegments = result?.segments && result.segments.length > 0;

    if (hasBreakdown) {
      const BDC = [
        '#6366f1',
        '#f59e0b',
        '#10b981',
        '#ef4444',
        '#8b5cf6',
        '#06b6d4',
        '#f97316',
        '#ec4899',
        '#14b8a6',
        '#84cc16',
      ];
      const bdKeys = Object.keys(result.breakdowns || {});
      lines = bdKeys.map((bk, idx) => {
        const displayName =
          splitBreakdownValue(bk).join(' · ') || bk || '(empty)';
        return {
          dataKey: displayName,
          stroke: BDC[idx % BDC.length],
          name: displayName,
        };
      });
    } else if (hasSegments) {
      const segs = result.segments || [];
      const segKeys = segs.map((s: any, idx: number) => {
        let label = s.name || `Segment ${idx + 1}`;
        if (label === 'Overall') label = `${label} (${idx + 1})`;
        return label;
      });
      const seen = new Set<string>();
      const uniqueKeys = segKeys.map((k: string, idx: number) => {
        if (seen.has(k)) return `${k} (${idx + 1})`;
        seen.add(k);
        return k;
      });

      // Segment lines
      lines = segs.map((s: any, idx: number) => {
        const key = uniqueKeys[idx];
        return {
          dataKey: key,
          stroke: s.color || SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
          name: key,
        };
      });

      // Plus "Overall" dashed line
      lines.unshift({
        dataKey: 'conversion_rate',
        stroke: '#94a3b8',
        strokeDasharray: '5 5',
        name: t('argus.analytics.overallConversion', 'Overall'),
      });
    } else {
      // Just single overall line
      lines = [
        {
          dataKey: 'conversion_rate',
          stroke: '#6366f1',
          name: t('argus.analytics.conversionRatePercent', 'Conversion %'),
        },
      ];
    }

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
          width="99%"
          height="100%"
          minWidth={1}
          minHeight={1}
        >
          <LineChart
            data={trendingData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            onMouseDown={(e) =>
              e && setRefAreaLeft(e.activeLabel ? String(e.activeLabel) : null)
            }
            onMouseMove={(e) =>
              e &&
              refAreaLeft &&
              setRefAreaRight(e.activeLabel ? String(e.activeLabel) : null)
            }
            onMouseUp={handleZoom}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
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
              dataKey="date"
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
              unit="%"
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
            {(hasBreakdown || hasSegments) && (
              <Legend
                onClick={handleLegendClick}
                formatter={renderLegendText}
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
            )}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.stroke}
                strokeDasharray={line.strokeDasharray}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                name={line.name}
                hide={hiddenSeriesKeys.has(line.dataKey)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  /* ─── Render: Time to Convert View ─── */
  const renderTimeToConvertView = () => {
    const ttcData = result?.time_to_convert;
    if (!ttcData) return null;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[
            {
              label: t('argus.analytics.median', 'Median'),
              value: formatDuration(ttcData.median_seconds),
            },
            {
              label: t('argus.analytics.average', 'Average'),
              value: formatDuration(ttcData.avg_seconds),
            },
            {
              label: t('argus.analytics.p25', 'P25'),
              value: formatDuration(ttcData.p25_seconds),
            },
            {
              label: t('argus.analytics.p75', 'P75'),
              value: formatDuration(ttcData.p75_seconds),
            },
          ].map((card) => (
            <Box
              key={card.label}
              sx={{
                flex: 1,
                minWidth: 120,
                p: 2,
                borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                {card.label}
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ mt: 0.5, color: '#6366f1' }}
              >
                {card.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            minWidth: 0,
            height: { xs: 280, md: '40vh' },
            minHeight: 280,
            maxHeight: 450,
            width: '100%',
            pr: 2,
            userSelect: 'none',
            '& .recharts-wrapper, & .recharts-surface, & svg, & svg *': {
              outline: 'none',
            },
          }}
        >
          <ResponsiveContainer
            width="99%"
            height="100%"
            minWidth={1}
            minHeight={1}
          >
            <BarChart
              data={ttcData.distribution}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              />
              <XAxis
                dataKey="bucket"
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
              />
              <RechartsTooltip
                wrapperStyle={{ zIndex: 1000 }}
                cursor={{
                  fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                }}
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
                dataKey="count"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                name={t('argus.common.count', 'Count')}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };

  // ── Dispatch / Render views ──
  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {viewMode === 'steps' && chartSubType === 'funnel' && renderStepsView()}
      {/* renderSegmentComparison only when no breakdown active */}
      {viewMode === 'steps' &&
        chartSubType === 'funnel' &&
        !result?.breakdowns &&
        renderSegmentComparison()}
      {viewMode === 'steps' &&
        chartSubType === 'metric' &&
        renderMetricOnlyView()}
      {viewMode === 'trending' && renderTrendingView()}
      {viewMode === 'time_to_convert' && renderTimeToConvertView()}
    </Box>
  );
};

/* ─── Helpers ─── */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}
