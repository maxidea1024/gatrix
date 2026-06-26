import React, { useState } from 'react';
import {
  Box,
  Typography,
  alpha,
  Paper,
  Chip,
  LinearProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Collapse,
  useTheme,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  ArrowDropUp,
  ArrowDropDown,
  ExpandMore,
  ExpandLess,
  OpenInNew as DrillIcon,
  Insights as InsightsIcon,
  CreditCard as PaymentIcon,
  Tv as AdIcon,
  HealthAndSafety as HealthIcon,
  CardGiftcard as GiftIcon,
  GridView as SegmentIcon,
  ShoppingCart as CartIcon,
  Storefront as StoreIcon,
} from '@mui/icons-material';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { formatWith } from '@/utils/dateFormat';
import {
  pctChange,
  fmt,
  fmtNum,
  CHART_COLORS,
  BalanceGauge,
  KpiCard,
  type SectionId,
} from './MonetizationHelpers';
import {
  generateInsights,
  buildSegmentMatrix,
  type SegmentVerdict,
} from '../../monetizationInsights';
import {
  ARGUS_SEMANTIC,
  ARGUS_SERIES,
  SECTION_LABEL_SX,
  argusBorder,
} from '../../argusThemeTokens';
import {
  SectionLabel,
  ChangeIndicator,
  MetricStrip,
  BreakdownBar,
  DrilldownLink,
} from '../argusSharedComponents';
import SegmentDrilldownPanel from '../SegmentDrilldownPanel';

interface ArgusMonetizationOverviewProps {
  data: any;
  products: any[];
  spenders: any;
  loading: boolean;
  isDark: boolean;
  t: any;
  showAllInsights: boolean;
  setShowAllInsights: (show: boolean) => void;
  funnelOpen: boolean;
  setFunnelOpen: (open: boolean) => void;
  cohortOpen: boolean;
  setCohortOpen: (open: boolean) => void;
  funnel: any;
  cohort: any;
  setTxQuery: (q: string) => void;
  setTxOffset: (o: number) => void;
  setTxGroupBy: (g: any) => void;
  setSection: (s: SectionId) => void;
  handleChartZoom: (
    rawPeriods: string[]
  ) => (startIdx: number, endIdx: number) => void;
  economy: any;
  ltv: any;
}

export const ArgusMonetizationOverview: React.FC<
  ArgusMonetizationOverviewProps
> = ({
  data,
  products,
  spenders,
  loading,
  isDark,
  t,
  showAllInsights,
  setShowAllInsights,
  funnelOpen,
  setFunnelOpen,
  cohortOpen,
  setCohortOpen,
  funnel,
  cohort,
  setTxQuery,
  setTxOffset,
  setTxGroupBy,
  setSection,
  handleChartZoom,
  economy,
  ltv,
}) => {
  const theme = useTheme();

  if (!data)
    return (
      <EmptyPagePlaceholder
        icon={<MoneyIcon sx={{ fontSize: 48 }} />}
        message={t('argus.monetization.noData', 'No data')}
        subtitle={t(
          'argus.monetization.noDataDesc',
          'No purchase events found'
        )}
      />
    );

  const insights = generateInsights(data, products, spenders, t as any);
  const sparkRevenue = data.revenue_over_time
    .slice(-14)
    .map((d: any) => d.revenue);
  const hasAdRevenue = data.total_ad_revenue > 0;

  // Segment drilldown state
  const [drillSegment, setDrillSegment] = useState<{
    segment: SegmentVerdict;
    type: 'country' | 'platform';
  } | null>(null);

  const severityColors: Record<string, string> = {
    positive: ARGUS_SEMANTIC.positive,
    warning: ARGUS_SEMANTIC.warning,
    critical: ARGUS_SEMANTIC.negative,
    info: ARGUS_SEMANTIC.info,
  };

  // Alias: existing references use sectionHeaderSx → delegates to shared token
  const sectionHeaderSx = SECTION_LABEL_SX;

  return (
    <>
      {/* ════════ 1. HERO REVENUE PANEL ════════ */}
      <Box
        sx={{
          py: 2,
          px: 0,
          mb: 3,
          borderBottom: `1px solid ${argusBorder(isDark)}`,
        }}
      >
        {/* Row 1: Blended Revenue (hero number) */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Box>
            <Typography sx={{ ...sectionHeaderSx, mb: 0.3 }}>
              {hasAdRevenue
                ? t('argus.monetization.blendedRevenue', 'Blended Revenue')
                : t('argus.monetization.totalRevenue', 'Total Revenue')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
              <Typography
                sx={{
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: -1,
                  lineHeight: 1.1,
                }}
              >
                {fmt(hasAdRevenue ? data.blended_revenue : data.total_revenue)}
              </Typography>
              <ChangeIndicator
                value={pctChange(
                  hasAdRevenue ? data.blended_revenue : data.total_revenue,
                  hasAdRevenue
                    ? data.prev_blended_revenue
                    : data.prev_total_revenue
                )}
                variant="chip"
              />
            </Box>
          </Box>
          {/* Mini sparkline area */}
          {sparkRevenue.length > 3 && (
            <Box
              sx={{
                width: 120,
                height: 40,
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                opacity: 0.6,
              }}
            >
              {sparkRevenue.map((v: any, i: number) => {
                const max = Math.max(...sparkRevenue);
                return (
                  <Box
                    key={i}
                    sx={{
                      flex: 1,
                      bgcolor: ARGUS_SEMANTIC.positive,
                      borderRadius: '2px 2px 0 0',
                      height: `${max > 0 ? (v / max) * 100 : 0}%`,
                      minHeight: 2,
                    }}
                  />
                );
              })}
            </Box>
          )}
        </Box>

        {/* Row 2: IAP/Ad split (only if ad revenue exists) */}
        {hasAdRevenue && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}
          >
            <Box
              sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box
                sx={{
                  height: 6,
                  flex: data.iap_share,
                  bgcolor: ARGUS_SEMANTIC.positive,
                  borderRadius: '3px 0 0 3px',
                }}
              />
              <Box
                sx={{
                  height: 6,
                  flex: data.ad_share,
                  bgcolor: ARGUS_SEMANTIC.info,
                  borderRadius: '0 3px 3px 0',
                }}
              />
            </Box>
            <Typography
              fontSize={11}
              color="text.secondary"
              sx={{ whiteSpace: 'nowrap' }}
            >
              <Box
                component="span"
                sx={{ color: ARGUS_SEMANTIC.positive, fontWeight: 700 }}
              >
                IAP {fmt(data.total_revenue)} (
                {data.iap_share < 1 && data.iap_share > 0
                  ? '< 1'
                  : data.iap_share.toFixed(0)}
                %)
              </Box>
              {' · '}
              <Box
                component="span"
                sx={{ color: ARGUS_SEMANTIC.info, fontWeight: 700 }}
              >
                Ad {fmt(data.total_ad_revenue)} (
                {data.ad_share < 1 && data.ad_share > 0
                  ? '< 1'
                  : data.ad_share.toFixed(0)}
                %)
              </Box>
            </Typography>
          </Box>
        )}

        {/* Row 3: Gross → Refund → Net flow (includes Ad if available) */}
        {(data.total_refunds > 0 || hasAdRevenue) && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              mt: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography fontSize={12} color="text.secondary">
              {t('argus.monetization.grossRevenue', 'Gross')}{' '}
              <Box component="span" fontWeight={700}>
                {fmt(
                  data.total_revenue +
                    (hasAdRevenue ? data.total_ad_revenue : 0)
                )}
              </Box>
            </Typography>
            {data.total_refunds > 0 && (
              <>
                <Typography fontSize={12} color="text.secondary">
                  →
                </Typography>
                <Typography
                  fontSize={12}
                  sx={{ color: ARGUS_SEMANTIC.negative }}
                >
                  {t('argus.monetization.totalRefunds', 'Refunds')}{' '}
                  <Box component="span" fontWeight={700}>
                    -{fmt(data.total_refunds)}
                  </Box>{' '}
                  ({data.refund_rate.toFixed(1)}%)
                </Typography>
              </>
            )}
            <Typography fontSize={12} color="text.secondary">
              →
            </Typography>
            <Typography fontSize={12} color="text.primary" fontWeight={700}>
              {t('argus.monetization.netRevenue', 'Net')}{' '}
              <Box component="span" fontWeight={700}>
                {fmt(
                  data.total_revenue +
                    (hasAdRevenue ? data.total_ad_revenue : 0) -
                    data.total_refunds
                )}
              </Box>
            </Typography>
          </Box>
        )}

        {/* Row 4: Key metrics grid — 2col mobile / 4col desktop */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 0.75,
            mt: 2,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          }}
        >
          {[
            {
              label: t('argus.monetization.purchaseCount', 'Purchases'),
              value: data.total_transactions.toLocaleString(),
              prev: data.prev_total_transactions,
            },
            {
              label: t('argus.monetization.payingUsers', 'Payers'),
              value: data.total_paying_users.toLocaleString(),
              prev: data.prev_total_paying_users,
            },
            {
              label: t('argus.monetization.conversionRate', 'Conversion'),
              value: `${data.conversion_rate.toFixed(2)}%`,
              prev: data.prev_conversion_rate,
              isPercent: true,
            },
            {
              label: t('argus.monetization.aov', 'AOV'),
              value: `$${data.avg_order_value.toFixed(2)}`,
              prev: data.prev_avg_order_value,
            },
            {
              label: t('argus.monetization.arpu', 'ARPU'),
              value: `$${data.arpu.toFixed(2)}`,
              prev: data.prev_arpu,
            },
            {
              label: t('argus.monetization.arppu', 'ARPPU'),
              value: `$${data.arppu.toFixed(2)}`,
              prev: data.prev_arppu,
            },
          ].map((m) => {
            const chg = m.isPercent
              ? Number(m.value.replace('%', '')) - (m.prev || 0)
              : pctChange(
                  parseFloat(m.value.replace(/[$,%]/g, '')) || 0,
                  m.prev || 0
                );
            return (
              <Box
                key={m.label}
                sx={{
                  px: 1,
                  py: 0.8,
                  borderRadius: 1.5,
                  bgcolor: isDark
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,0,0,0.02)',
                  border: '1px solid',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.05)',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <Typography
                  fontSize={10}
                  color="text.secondary"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    mb: 0.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.label}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 0.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography
                    fontSize={14}
                    fontWeight={800}
                    lineHeight={1}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {m.value}
                  </Typography>
                  <ChangeIndicator
                    value={chg}
                    suffix={m.isPercent ? '%p' : '%'}
                  />
                </Box>
              </Box>
            );
          })}
          {/* New vs Repeat — spans 2 cols on 4-col grid (fills row 2 right side) */}
          <Box
            sx={{
              gridColumn: 'span 2',
              px: 1,
              py: 0.8,
              borderRadius: 1.5,
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: '1px solid',
              borderColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.05)',
              minWidth: 0,
            }}
          >
            <Typography
              fontSize={10}
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}
            >
              {t('argus.monetization.newVsRepeat', 'New vs Repeat')}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: ARGUS_SEMANTIC.positive,
                    flexShrink: 0,
                  }}
                />
                <Typography fontSize={13} fontWeight={700}>
                  {data.first_purchasers.toLocaleString()}
                </Typography>
                <Typography fontSize={10} color="text.secondary">
                  {t('argus.monetization.newLabel', 'New')}
                </Typography>
              </Box>
              <Typography fontSize={10} color="text.secondary">
                ·
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: ARGUS_SEMANTIC.warning,
                    flexShrink: 0,
                  }}
                />
                <Typography fontSize={13} fontWeight={700}>
                  {data.repeat_purchasers.toLocaleString()}
                </Typography>
                <Typography fontSize={10} color="text.secondary">
                  {t('argus.monetization.repeatLabel', 'Repeat')}
                </Typography>
              </Box>
              {data.first_purchasers + data.repeat_purchasers > 0 && (
                <Box
                  sx={{
                    ml: 'auto',
                    display: 'flex',
                    gap: 0.3,
                    alignItems: 'center',
                    bgcolor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                    borderRadius: 1,
                    px: 0.8,
                    py: 0.3,
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    fontSize={10}
                    fontWeight={700}
                    sx={{ color: ARGUS_SEMANTIC.positive }}
                  >
                    {(
                      (data.first_purchasers /
                        (data.first_purchasers + data.repeat_purchasers)) *
                      100
                    ).toFixed(0)}
                    %
                  </Typography>
                  <Typography fontSize={10} color="text.secondary">
                    /
                  </Typography>
                  <Typography
                    fontSize={10}
                    fontWeight={700}
                    sx={{ color: ARGUS_SEMANTIC.warning }}
                  >
                    {(
                      (data.repeat_purchasers /
                        (data.first_purchasers + data.repeat_purchasers)) *
                      100
                    ).toFixed(0)}
                    %
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ════════ 2. INSIGHTS ════════ */}
      {insights.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {/* Header row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={sectionHeaderSx}>
                {t('argus.monetization.insightsTitle', 'Revenue Insights')}
              </Typography>
              <Box
                sx={{
                  px: 1,
                  py: 0.1,
                  borderRadius: 999,
                  bgcolor: isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.06)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'text.secondary',
                }}
              >
                {insights.length}
              </Box>
            </Box>
            {insights.length > 4 && (
              <Typography
                onClick={() => setShowAllInsights(!showAllInsights)}
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'primary.main',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {showAllInsights
                  ? t('common.showLess', 'Show less')
                  : t('common.showMore', '+{{count}} more', {
                      count: insights.length - 4,
                    })}
              </Typography>
            )}
          </Box>

          {/* 2-col grid (1-col on small screens) */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 1,
            }}
          >
            {(showAllInsights ? insights : insights.slice(0, 4)).map(
              (insight, idx) => {
                const color =
                  severityColors[insight.severity] ?? severityColors.info;
                const severityLabel: Record<string, string> = {
                  positive: t('argus.monetization.insightGood', 'Good'),
                  info: t('argus.monetization.insightInfo', 'Info'),
                  warning: t('argus.monetization.insightWarning', 'Warning'),
                  critical: t('argus.monetization.insightCritical', 'Critical'),
                };
                return (
                  <Box
                    key={idx}
                    onClick={() => {
                      if (!insight.drilldown) return;
                      if (
                        insight.drilldown.type === 'scroll' &&
                        insight.drilldown.target
                      ) {
                        document
                          .getElementById(insight.drilldown.target)
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                      } else if (insight.drilldown.type === 'ledger') {
                        const filterType =
                          insight.drilldown.ledgerFilter?.type || 'all';
                        if (filterType === 'refund')
                          setTxQuery('event_name:refund');
                        else if (filterType === 'grant')
                          setTxQuery('event_name:grant');
                        else setTxQuery('');
                        setTxOffset(0);
                        setTxGroupBy('none');
                        setSection('ledger');
                      }
                    }}
                    sx={{
                      display: 'flex',
                      gap: 0,
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: isDark
                        ? 'rgba(255,255,255,0.07)'
                        : 'rgba(0,0,0,0.07)',
                      bgcolor: isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.7)',
                      ...(insight.drilldown
                        ? {
                            cursor: 'pointer',
                            '&:hover': {
                              borderColor: alpha(color, 0.4),
                              bgcolor: isDark
                                ? alpha(color, 0.05)
                                : alpha(color, 0.04),
                            },
                            transition: 'all 0.15s ease',
                          }
                        : {}),
                    }}
                  >
                    {/* Left accent bar */}
                    <Box
                      sx={{
                        width: 4,
                        flexShrink: 0,
                        bgcolor: color,
                        opacity: 0.8,
                      }}
                    />

                    {/* Content */}
                    <Box sx={{ flex: 1, px: 1.5, py: 1.2, minWidth: 0 }}>
                      {/* Top: icon + severity badge */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: 0.5,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.8,
                          }}
                        >
                          <Typography sx={{ fontSize: 16, lineHeight: 1 }}>
                            {insight.icon}
                          </Typography>
                          <Box
                            sx={{
                              px: 0.7,
                              py: 0.1,
                              borderRadius: 0.8,
                              bgcolor: alpha(color, isDark ? 0.15 : 0.1),
                              border: `1px solid ${alpha(color, 0.25)}`,
                              fontSize: 9,
                              fontWeight: 700,
                              color,
                              letterSpacing: 0.3,
                              textTransform: 'uppercase',
                            }}
                          >
                            {severityLabel[insight.severity] ??
                              insight.severity}
                          </Box>
                        </Box>
                        {insight.drilldown && (
                          <Typography
                            sx={{
                              fontSize: 10,
                              color: 'primary.main',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {insight.drilldown.type === 'ledger'
                              ? '→ 원장'
                              : '→ 이동'}
                          </Typography>
                        )}
                      </Box>

                      {/* Title */}
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 700,
                          color,
                          lineHeight: 1.3,
                          mb: 0.3,
                        }}
                      >
                        {insight.title}
                      </Typography>

                      {/* Detail */}
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: 'text.secondary',
                          lineHeight: 1.4,
                        }}
                      >
                        {insight.detail}
                      </Typography>

                      {/* Action hint */}
                      {insight.action && (
                        <Typography
                          sx={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: alpha(color, 0.85),
                            mt: 0.5,
                            fontStyle: 'italic',
                          }}
                        >
                          💡 {insight.action}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              }
            )}
          </Box>
        </Box>
      )}

      {/* ════════ 3. REVENUE TREND + COMPOSITION (70:30) ════════ */}
      <Box
        id="revenue-trend"
        sx={{
          display: 'flex',
          gap: 2,
          mb: 1.5,
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        {/* Left: Trend Chart (70%) */}
        <Box sx={{ flex: 7, minWidth: 0 }}>
          <ArgusVolumeChart
            title={t('argus.monetization.dailyTrend', 'Daily Revenue Trend')}
            rawPeriods={data.revenue_over_time.map((d: any) => d.period)}
            labels={[]}
            datasets={[
              {
                label: t('argus.monetization.iapRevenue', 'IAP Revenue'),
                data: data.revenue_over_time.map((d: any) => d.revenue),
                color: ARGUS_SEMANTIC.positive,
              },
              ...(hasAdRevenue
                ? [
                    {
                      label: t('argus.monetization.adRevenue', 'Ad Revenue'),
                      data: data.revenue_over_time.map((d: any) => {
                        const match = data.ad_revenue_over_time.find(
                          (a: any) => a.period === d.period
                        );
                        return match ? match.ad_revenue : 0;
                      }),
                      color: ARGUS_SEMANTIC.info,
                    },
                  ]
                : []),
              {
                label: t('argus.monetization.transactions', 'Transactions'),
                data: data.revenue_over_time.map((d: any) => d.transactions),
                color: theme.palette.primary.main,
              },
              ...(data.prev_revenue_over_time.length > 0
                ? [
                    {
                      label: t(
                        'argus.monetization.prevRevenue',
                        'Prev. Revenue'
                      ),
                      data: data.prev_revenue_over_time.map(
                        (d: any) => d.revenue
                      ),
                      color: alpha(ARGUS_SEMANTIC.positive, 0.3),
                    },
                  ]
                : []),
              ...(data.refunds_over_time.length > 0
                ? [
                    {
                      label: t('argus.monetization.totalRefunds', 'Refunds'),
                      data: data.revenue_over_time.map((d: any) => {
                        const match = data.refunds_over_time.find(
                          (r: any) => r.period === d.period
                        );
                        return match ? match.refunds : 0;
                      }),
                      color: ARGUS_SEMANTIC.negative,
                    },
                  ]
                : []),
            ]}
            loading={loading}
            storagePrefix="argus_revenue_trend"
            showCompactToggle={false}
            onZoom={handleChartZoom(
              data.revenue_over_time.map((d: any) => d.period)
            )}
          />
        </Box>

        {/* Right: Composition Panel (30%) */}
        <Box
          sx={{
            flex: 3,
            minWidth: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* Payment Method */}
          {data.revenue_by_payment_method.length > 1 && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                border: '1px solid',
                borderColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
              }}
            >
              <Typography sx={{ ...sectionHeaderSx, mb: 1 }}>
                {t('argus.monetization.paymentMethod', 'Payment Method')}
              </Typography>
              {data.revenue_by_payment_method.map((pm: any) => {
                const pct =
                  data.total_revenue > 0
                    ? (pm.revenue / data.total_revenue) * 100
                    : 0;
                const pmColors: Record<string, string> = {
                  cash: ARGUS_SERIES[0],
                  gift_card: ARGUS_SEMANTIC.warning,
                  credit: ARGUS_SERIES[4],
                  promotion: ARGUS_SEMANTIC.positive,
                };
                return (
                  <Box key={pm.payment_method} sx={{ mb: 0.8 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.2,
                      }}
                    >
                      <Typography fontSize={11} fontWeight={600}>
                        {t(
                          `argus.revenue.payment_${pm.payment_method}`,
                          pm.payment_method
                        )}
                      </Typography>
                      <Typography fontSize={11} fontWeight={700}>
                        {pct.toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(pct, 100)}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: pmColors[pm.payment_method] || '#607d8b',
                          borderRadius: 2,
                        },
                      }}
                    />
                  </Box>
                );
              })}
            </Paper>
          )}
        </Box>
      </Box>

      {/* ARPDAU trend */}

      {data.revenue_over_time.some((d: any) => d.arpdau > 0) && (
        <ArgusVolumeChart
          title={t(
            'argus.monetization.arpdauTrend',
            'ARPDAU (Avg Revenue Per Daily Active User)'
          )}
          rawPeriods={data.revenue_over_time.map((d: any) => d.period)}
          labels={[]}
          datasets={[
            {
              label: 'ARPDAU',
              data: data.revenue_over_time.map((d: any) => d.arpdau),
              color: ARGUS_SEMANTIC.warning,
            },
          ]}
          loading={loading}
          storagePrefix="argus_arpdau_trend"
          showCompactToggle={false}
          mb={3}
          onZoom={handleChartZoom(
            data.revenue_over_time.map((d: any) => d.period)
          )}
        />
      )}

      {/* ════════ 4. AD REVENUE DETAIL ════════ */}
      {hasAdRevenue && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            mb: 3,
            bgcolor: isDark
              ? alpha(ARGUS_SEMANTIC.info, 0.04)
              : alpha(ARGUS_SEMANTIC.info, 0.02),
            border: '1px solid',
            borderColor: alpha(ARGUS_SEMANTIC.info, isDark ? 0.15 : 0.08),
          }}
        >
          {/* Ad Revenue Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Box>
              <Typography sx={sectionHeaderSx}>
                {t('argus.monetization.adRevenueDetail', 'Ad Revenue')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {[
                {
                  label: t('argus.monetization.adRevenueTotal', 'Revenue'),
                  value: fmt(data.total_ad_revenue),
                },
                {
                  label: t('argus.monetization.avgEcpm', 'eCPM'),
                  value: `$${data.avg_ecpm.toFixed(2)}`,
                },
                {
                  label: t(
                    'argus.monetization.totalImpressions',
                    'Impressions'
                  ),
                  value: data.total_impressions.toLocaleString(),
                },
                {
                  label: t('argus.monetization.adClicks', 'Clicks'),
                  value: data.total_ad_clicks.toLocaleString(),
                },
              ].map((m) => (
                <Box key={m.label} sx={{ textAlign: 'center' }}>
                  <Typography
                    fontSize={10}
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.3 }}
                  >
                    {m.label}
                  </Typography>
                  <Typography fontSize={16} fontWeight={800}>
                    {m.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* 3-column breakdown */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
              gap: 2,
            }}
          >
            {/* By Ad Type */}
            <Box>
              <Typography
                fontSize={11}
                fontWeight={700}
                color="text.secondary"
                sx={{ mb: 1, textTransform: 'uppercase' }}
              >
                {t('argus.monetization.byAdType', 'By Type')}
              </Typography>
              {data.revenue_by_ad_type.slice(0, 5).map((at: any) => (
                <Box
                  key={at.ad_type}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 0.4,
                  }}
                >
                  <Typography
                    fontSize={12}
                    fontWeight={600}
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {at.ad_type.replace(/_/g, ' ')}
                  </Typography>
                  <Box
                    sx={{ display: 'flex', gap: 0.8, alignItems: 'baseline' }}
                  >
                    <Typography fontSize={12} fontWeight={700}>
                      {fmt(at.revenue)}
                    </Typography>
                    <Typography fontSize={10} color="text.secondary">
                      ${at.ecpm.toFixed(1)}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {data.revenue_by_ad_type.length > 5 && (
                <Typography
                  fontSize={10}
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  +{data.revenue_by_ad_type.length - 5} more
                </Typography>
              )}
            </Box>

            {/* By Placement */}
            <Box>
              <Typography
                fontSize={11}
                fontWeight={700}
                color="text.secondary"
                sx={{ mb: 1, textTransform: 'uppercase' }}
              >
                {t('argus.monetization.byPlacement', 'By Placement')}
              </Typography>
              {data.revenue_by_placement.slice(0, 5).map((p: any) => (
                <Box
                  key={p.placement}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 0.4,
                  }}
                >
                  <Typography
                    fontSize={12}
                    fontWeight={600}
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {p.placement.replace(/_/g, ' ')}
                  </Typography>
                  <Typography fontSize={12} fontWeight={700}>
                    {fmt(p.revenue)}
                  </Typography>
                </Box>
              ))}
              {data.revenue_by_placement.length > 5 && (
                <Typography
                  fontSize={10}
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  +{data.revenue_by_placement.length - 5} more
                </Typography>
              )}
            </Box>

            {/* By SDK */}
            <Box>
              <Typography
                fontSize={11}
                fontWeight={700}
                color="text.secondary"
                sx={{ mb: 1, textTransform: 'uppercase' }}
              >
                {t('argus.monetization.bySdk', 'By SDK')}
              </Typography>
              {data.revenue_by_sdk.map((s: any) => (
                <Box
                  key={s.sdk}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 0.4,
                  }}
                >
                  <Typography fontSize={12} fontWeight={600}>
                    {s.sdk}
                  </Typography>
                  <Box
                    sx={{ display: 'flex', gap: 0.8, alignItems: 'baseline' }}
                  >
                    <Typography fontSize={12} fontWeight={700}>
                      {fmt(s.revenue)}
                    </Typography>
                    <Typography fontSize={10} color="text.secondary">
                      ${s.ecpm.toFixed(1)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      )}

      {/* ════════ 5. REVENUE HEALTH (Refund + Grants unified) ════════ */}
      {(data.refund_reasons.length > 0 || data.total_granted > 0) && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            mb: 3,
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <Typography sx={sectionHeaderSx}>
            {t('argus.monetization.revenueHealth', 'Revenue Health')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md:
                  data.refund_reasons.length > 0 && data.total_granted > 0
                    ? '1fr 1fr'
                    : '1fr',
              },
              gap: 3,
            }}
          >
            {/* Refund Analysis */}
            {data.refund_reasons.length > 0 && (
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <Typography fontSize={13} fontWeight={700}>
                    ↩{' '}
                    {t('argus.monetization.refundAnalysis', 'Refund Analysis')}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${data.refund_rate.toFixed(1)}%`}
                    sx={{
                      height: 18,
                      fontSize: 10,
                      fontWeight: 700,
                      bgcolor: alpha(
                        data.refund_rate > 5
                          ? ARGUS_SEMANTIC.negative
                          : ARGUS_SEMANTIC.warning,
                        isDark ? 0.15 : 0.08
                      ),
                      color:
                        data.refund_rate > 5
                          ? ARGUS_SEMANTIC.negative
                          : ARGUS_SEMANTIC.warning,
                      border: 'none',
                    }}
                  />
                </Box>
                {(() => {
                  const REFUND_LABELS: Record<string, string> = {
                    policy_refund: t(
                      'argus.monetization.refund_policy',
                      'Policy Refund'
                    ),
                    technical_issue: t(
                      'argus.monetization.refund_technical',
                      'Technical Issue'
                    ),
                    accidental_purchase: t(
                      'argus.monetization.refund_accidental',
                      'Accidental Purchase'
                    ),
                    changed_mind: t(
                      'argus.monetization.refund_changed_mind',
                      'Changed Mind'
                    ),
                    not_as_expected: t(
                      'argus.monetization.refund_not_expected',
                      'Not as Expected'
                    ),
                    duplicate_charge: t(
                      'argus.monetization.refund_duplicate',
                      'Duplicate Charge'
                    ),
                    fraud: t('argus.monetization.refund_fraud', 'Fraud'),
                  };
                  const listedSum = data.refund_reasons.reduce(
                    (s: any, rr: any) => s + rr.amount,
                    0
                  );
                  const otherAmount = data.total_refunds - listedSum;
                  const rows = [
                    ...data.refund_reasons,
                    ...(otherAmount > 0.01
                      ? [{ reason: '__other__', amount: otherAmount, count: 0 }]
                      : []),
                  ];
                  return rows.map((rr: any) => {
                    const pct =
                      data.total_refunds > 0
                        ? (rr.amount / data.total_refunds) * 100
                        : 0;
                    const label =
                      rr.reason === '__other__'
                        ? t('common.other', 'Other')
                        : REFUND_LABELS[rr.reason] ||
                          rr.reason.replace(/_/g, ' ');
                    return (
                      <Box key={rr.reason} sx={{ mb: 0.8 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 0.2,
                          }}
                        >
                          <Typography
                            fontSize={12}
                            fontWeight={600}
                            sx={{ textTransform: 'capitalize' }}
                          >
                            {label}
                          </Typography>
                          <Typography fontSize={12} fontWeight={700}>
                            {fmt(rr.amount)}{' '}
                            <Box
                              component="span"
                              fontSize={10}
                              color="text.secondary"
                            >
                              ({pct.toFixed(0)}%)
                            </Box>
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(pct, 100)}
                          sx={{
                            height: 4,
                            borderRadius: 2,
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.04)',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: ARGUS_SEMANTIC.negative,
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Box>
                    );
                  });
                })()}
              </Box>
            )}

            {/* Grants */}
            {data.total_granted > 0 && (
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <Typography fontSize={13} fontWeight={700}>
                    {t('argus.monetization.grantSummary', 'Free Grants')}
                  </Typography>
                  <Typography fontSize={12} fontWeight={800}>
                    {fmt(data.total_granted)}
                  </Typography>
                </Box>
                <Typography fontSize={11} color="text.secondary" sx={{ mb: 1 }}>
                  {data.grant_count.toLocaleString()}{' '}
                  {t('argus.monetization.cases', 'cases')} ·{' '}
                  {data.grant_users.toLocaleString()}{' '}
                  {t('argus.monetization.users', 'users')}
                </Typography>
                {data.grants_by_reason.map((gr: any) => {
                  const pct =
                    data.total_granted > 0
                      ? (gr.total_granted / data.total_granted) * 100
                      : 0;
                  return (
                    <Box
                      key={gr.reason}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 0.3,
                      }}
                    >
                      <Typography fontSize={12} fontWeight={600}>
                        {gr.reason}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${fmt(gr.total_granted)} (${pct.toFixed(0)}%)`}
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: alpha(
                            ARGUS_SEMANTIC.warning,
                            isDark ? 0.12 : 0.06
                          ),
                          color: ARGUS_SEMANTIC.warning,
                          border: 'none',
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* ════════ 6. SEGMENT PERFORMANCE MATRIX ════════ */}
      {(data.revenue_by_country.length > 0 ||
        data.revenue_by_platform.length > 0) &&
        (() => {
          const countryMatrix = buildSegmentMatrix(
            data.revenue_by_country,
            data.prev_revenue_by_country || [],
            data.total_revenue,
            'country',
            t as any
          );
          const platformMatrix = buildSegmentMatrix(
            data.revenue_by_platform,
            data.prev_revenue_by_platform || [],
            data.total_revenue,
            'platform',
            t as any
          );
          const verdictColors: Record<string, string> = {
            invest: ARGUS_SEMANTIC.positive,
            maintain: ARGUS_SEMANTIC.info,
            opportunity: ARGUS_SEMANTIC.warning,
            review: ARGUS_SEMANTIC.negative,
          };
          const renderMatrix = (
            title: string,
            matrix: SegmentVerdict[],
            segType: 'country' | 'platform'
          ) => (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                border: '1px solid',
                borderColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
              }}
            >
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography sx={sectionHeaderSx}>{title}</Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                      {t('argus.monetization.segment', 'Segment')}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    >
                      {t('argus.monetization.revenue', 'Revenue')}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    >
                      {t('argus.monetization.change', 'Change')}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    >
                      {t('argus.monetization.verdict', 'Verdict')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matrix.map((seg) => (
                    <TableRow
                      key={seg.name}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(0,0,0,0.025)',
                        },
                      }}
                      onClick={() =>
                        setDrillSegment({
                          segment: seg,
                          type: segType as 'country' | 'platform',
                        })
                      }
                    >
                      <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>
                        {seg.name}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, fontSize: 12 }}
                      >
                        {fmt(seg.revenue)}
                      </TableCell>
                      <TableCell align="right">
                        {seg.changePct >= 99.9 ? (
                          <Chip
                            size="small"
                            label="NEW"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              bgcolor: alpha(
                                ARGUS_SEMANTIC.info,
                                isDark ? 0.15 : 0.08
                              ),
                              color: ARGUS_SEMANTIC.info,
                              border: 'none',
                            }}
                          />
                        ) : (
                          <ChangeIndicator
                            value={seg.changePct}
                            variant="chip"
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={seg.verdictLabel}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            fontWeight: 700,
                            bgcolor: alpha(
                              verdictColors[seg.verdict],
                              isDark ? 0.12 : 0.06
                            ),
                            color: verdictColors[seg.verdict],
                            border: 'none',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          );
          return (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2,
                mb: 3,
              }}
            >
              {countryMatrix.length > 0 &&
                renderMatrix(
                  t(
                    'argus.monetization.countryPerformance',
                    'Country Performance'
                  ),
                  countryMatrix,
                  'country'
                )}
              {platformMatrix.length > 0 &&
                renderMatrix(
                  t(
                    'argus.monetization.platformPerformance',
                    'Platform Performance'
                  ),
                  platformMatrix,
                  'platform'
                )}
            </Box>
          );
        })()}

      {/* ════════ 7. FUNNEL & COHORT (collapsible) ════════ */}
      {funnel && funnel.stages.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            mb: 2,
          }}
        >
          <Box
            onClick={() => setFunnelOpen(!funnelOpen)}
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              },
            }}
          >
            <Box>
              <Typography sx={sectionHeaderSx}>
                {t('argus.monetization.purchaseFunnel', 'Purchase Funnel')}
              </Typography>
              {!funnelOpen && (
                <Typography
                  fontSize={12}
                  color="text.secondary"
                  sx={{ mt: 0.3 }}
                >
                  {funnel.stages[0]?.label}:{' '}
                  {funnel.stages[0]?.users.toLocaleString()} →{' '}
                  {funnel.stages[funnel.stages.length - 1]?.label}:{' '}
                  {funnel.stages[
                    funnel.stages.length - 1
                  ]?.users.toLocaleString()}{' '}
                  (
                  {(
                    (funnel.stages[funnel.stages.length - 1]?.users /
                      (funnel.stages[0]?.users || 1)) *
                    100
                  ).toFixed(1)}
                  % {t('argus.monetization.conversion', 'conversion')})
                </Typography>
              )}
            </Box>
            {funnelOpen ? (
              <ExpandLess sx={{ color: 'text.secondary' }} />
            ) : (
              <ExpandMore sx={{ color: 'text.secondary' }} />
            )}
          </Box>
          <Collapse in={funnelOpen}>
            <Box sx={{ px: 2, pb: 2 }}>
              {funnel.stages.map((stage: any, i: number) => {
                const maxUsers = funnel.stages[0]?.users || 1;
                const prevUsers = i > 0 ? funnel.stages[i - 1].users : maxUsers;
                const convRate =
                  prevUsers > 0 ? (stage.users / prevUsers) * 100 : 0;
                const totalRate =
                  maxUsers > 0 ? (stage.users / maxUsers) * 100 : 0;
                return (
                  <Box key={stage.name} sx={{ mb: 1.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.3,
                      }}
                    >
                      <Typography fontSize={13} fontWeight={600}>
                        {stage.label}
                      </Typography>
                      <Box
                        sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}
                      >
                        <Typography fontSize={13} fontWeight={700}>
                          {stage.users.toLocaleString()}
                        </Typography>
                        {i > 0 && (
                          <Typography fontSize={11} color="text.secondary">
                            {convRate.toFixed(1)}%{' '}
                            {t('argus.monetization.fromPrev', 'from prev')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        position: 'relative',
                        height: 24,
                        borderRadius: 2,
                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${totalRate}%`,
                          background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${alpha(CHART_COLORS[i % CHART_COLORS.length], 0.5)})`,
                          borderRadius: 2,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        </Paper>
      )}

      {cohort && cohort.cohorts.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            mb: 3,
          }}
        >
          <Box
            onClick={() => setCohortOpen(!cohortOpen)}
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              },
            }}
          >
            <Box>
              <Typography sx={sectionHeaderSx}>
                {t(
                  'argus.monetization.revenueCohort',
                  'Revenue Cohort Analysis'
                )}
              </Typography>
              {!cohortOpen && (
                <Typography
                  fontSize={12}
                  color="text.secondary"
                  sx={{ mt: 0.3 }}
                >
                  {cohort.cohorts.length}{' '}
                  {t('argus.monetization.cohorts', 'cohorts')} ·{' '}
                  {t('argus.monetization.clickToExpand', 'Click to expand')}
                </Typography>
              )}
            </Box>
            {cohortOpen ? (
              <ExpandLess sx={{ color: 'text.secondary' }} />
            ) : (
              <ExpandMore sx={{ color: 'text.secondary' }} />
            )}
          </Box>
          <Collapse in={cohortOpen}>
            <Box sx={{ p: 2, pt: 0, overflow: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                      {t('argus.monetization.cohortWeek', 'Week')}
                    </TableCell>
                    {cohort.cohorts[0]?.data.map((d: any) => (
                      <TableCell
                        key={d.day}
                        align="center"
                        sx={{ fontWeight: 700, fontSize: 11 }}
                      >
                        D{d.day}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const allValues = cohort.cohorts.flatMap((c: any) =>
                      c.data.map((d: any) => d.cumulative_revenue)
                    );
                    const maxVal = Math.max(...allValues, 1);
                    return cohort.cohorts.map((c: any) => (
                      <TableRow key={c.cohort_week}>
                        <TableCell
                          sx={{
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {formatWith(c.cohort_week, 'M/D')}
                        </TableCell>
                        {c.data.map((d: any) => {
                          const intensity =
                            maxVal > 0 ? d.cumulative_revenue / maxVal : 0;
                          return (
                            <TableCell
                              key={d.day}
                              align="center"
                              sx={{
                                bgcolor:
                                  intensity > 0
                                    ? alpha(
                                        ARGUS_SEMANTIC.positive,
                                        Math.min(intensity * 0.8 + 0.1, 0.9)
                                      )
                                    : 'transparent',
                                color:
                                  intensity > 0.4 ? '#fff' : 'text.primary',
                                fontWeight: 600,
                                fontSize: 12,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {d.cumulative_revenue > 0
                                ? fmt(d.cumulative_revenue)
                                : '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* ════════ 8. SECTION NAVIGATION STRIPS ════════ */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[
          {
            id: 'products' as SectionId,
            title: t('argus.monetization.topProducts', 'Top Products'),
            detail: products[0]
              ? `#1 ${products[0].product_name} ${fmt(products[0].revenue)} · ${products.length} ${t('argus.monetization.items', 'items')}`
              : t('argus.monetization.clickToAnalyze', 'Click to analyze'),
          },
          {
            id: 'spenders' as SectionId,
            title: t('argus.monetization.topSpenders', 'Top Spenders'),
            detail: spenders
              ? `${t('argus.monetization.top', 'Top')} 10% → ${spenders.segments.find((s: any) => s.segment === 'top_10pct')?.percentage.toFixed(1) || '-'}%`
              : `${data.total_paying_users.toLocaleString()} ${t('argus.monetization.payersToAnalyze', 'payers to analyze')}`,
          },
          {
            id: 'economy' as SectionId,
            title: t('argus.monetization.economyHealth', 'Economy Health'),
            detail: economy
              ? `${economy.by_currency[0]?.currency_type || '-'}: ${t('argus.monetization.ratio', 'Ratio')} ${economy.by_currency[0] ? (economy.by_currency[0].sink > 0 ? (economy.by_currency[0].source / economy.by_currency[0].sink).toFixed(2) : '∞') : '-'}`
              : t('argus.monetization.clickToAnalyze', 'Click to analyze'),
          },
          {
            id: 'ltv' as SectionId,
            title: t('argus.monetization.ltv', 'Lifetime Value'),
            detail: ltv
              ? `${t('argus.monetization.d30Label', 'D30')} ${fmt(ltv.ltv_curve.find((c: any) => c.day === 30)?.cumulative_revenue || ltv.ltv_curve[ltv.ltv_curve.length - 1]?.cumulative_revenue || 0)}${ltv.pltv_predictions?.length ? ` · ${t('argus.monetization.pltvLabel', 'pLTV')} ${fmt(ltv.pltv_predictions[0]?.predicted_ltv || 0)}` : ''}`
              : t('argus.monetization.clickToAnalyze', 'Click to analyze'),
          },
        ].map((nav) => (
          <Box
            key={nav.id}
            onClick={() => setSection(nav.id)}
            sx={{
              px: 2,
              py: 1.5,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: `1px solid ${argusBorder(isDark)}`,
              transition: 'background 0.15s',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              },
            }}
          >
            <Box>
              <Typography fontSize={13} fontWeight={700}>
                {nav.title}
              </Typography>
              <Typography fontSize={12} color="text.secondary">
                {nav.detail}
              </Typography>
            </Box>
            <DrillIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </Box>
        ))}
      </Box>
      {/* ════════ SEGMENT DRILLDOWN PANEL ════════ */}
      {drillSegment && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 1200,
            display: 'flex',
          }}
        >
          {/* Backdrop */}
          <Box
            onClick={() => setDrillSegment(null)}
            sx={{
              position: 'fixed',
              inset: 0,
              bgcolor: 'rgba(0,0,0,0.3)',
              zIndex: -1,
            }}
          />
          <SegmentDrilldownPanel
            segment={drillSegment.segment}
            segmentType={drillSegment.type}
            revenueOverTime={data.revenue_over_time}
            products={products || []}
            totalRevenue={data.total_revenue}
            onClose={() => setDrillSegment(null)}
            onNavigateTab={(tab) => {
              setDrillSegment(null);
              setSection(tab as SectionId);
            }}
          />
        </Box>
      )}
    </>
  );
};
