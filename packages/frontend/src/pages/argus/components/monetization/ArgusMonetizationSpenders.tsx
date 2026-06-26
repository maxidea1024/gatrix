import React from 'react';
import {
  Box, Typography, alpha, Paper, Chip, LinearProgress, Table, TableHead, TableRow, TableCell, TableBody, Avatar, Button
} from '@mui/material';
import { Diamond as DiamondIcon } from '@mui/icons-material';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { stringToColor, getInitials } from '@/utils/argusHelpers';
import { fmt, fmtNum, type SectionId } from './MonetizationHelpers';
import { downloadCsv } from '@/utils/csvExport';
import { ARGUS_SEMANTIC, ARGUS_SERIES, SECTION_LABEL_SX, argusBorder } from '../../argusThemeTokens';

interface ArgusMonetizationSpendersProps {
  spenders: any;
  segmentComparison: any;
  loading: boolean;
  isDark: boolean;
  t: any;
  navigate: any;
  handleChartZoom: (rawPeriods: string[]) => (startIdx: number, endIdx: number) => void;
}

export const ArgusMonetizationSpenders: React.FC<ArgusMonetizationSpendersProps> = ({
  spenders, segmentComparison, loading, isDark, t, navigate, handleChartZoom
}) => {
  if (!spenders || spenders.total_spenders === 0) {
    return <EmptyPagePlaceholder icon={<DiamondIcon sx={{ fontSize: 48 }} />} message={t('argus.monetization.noSpenders', 'No spender data')} subtitle={t('argus.monetization.noSpendersDesc', 'No purchase events found')} />;
  }

  const segmentLabels: Record<string, string> = {
    top_1_pct: t('argus.monetization.top1Pct', 'Top 1% (Whales)'),
    top_10_pct: t('argus.monetization.top10Pct', 'Top 10%'),
    bottom_90_pct: t('argus.monetization.bottom90Pct', 'Bottom 90%'),
  };
  const segmentColors: Record<string, string> = {
    top_1_pct: ARGUS_SEMANTIC.negative,
    top_10_pct: ARGUS_SEMANTIC.warning,
    bottom_90_pct: ARGUS_SEMANTIC.positive,
  };

  return (
    <>
      {/* ═══ Whale Health Check ═══ */}
      <Paper elevation={0} sx={{
        p: 2.5, borderRadius: 3, mb: 3,
        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
        border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }}>
        <Typography sx={SECTION_LABEL_SX}>
          {t('argus.monetization.whaleHealthCheck', 'Whale Health Check')}
        </Typography>

        {/* Revenue Concentration */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {spenders.segments.map((seg: any) => {
            const segColor = seg.segment === 'top_1_pct' ? ARGUS_SEMANTIC.negative : seg.segment === 'top_10_pct' ? ARGUS_SEMANTIC.warning : ARGUS_SEMANTIC.positive;
            const isRisky = seg.percentage > (seg.segment === 'top_1_pct' ? 30 : seg.segment === 'top_10_pct' ? 65 : 100);
            return (
              <Box key={seg.segment} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.3 }}>
                    <Typography fontSize={12} fontWeight={600}>
                      {segmentLabels[seg.segment] || seg.segment}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8 }}>
                      <Typography fontSize={13} fontWeight={800} sx={{ color: segColor }}>
                        {seg.percentage.toFixed(1)}%
                      </Typography>
                      <Typography fontSize={11} color="text.secondary">
                        {fmt(seg.revenue)} · {seg.user_count.toLocaleString()} {t('argus.monetization.users', 'users')}
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={Math.min(seg.percentage, 100)}
                    sx={{ height: 8, borderRadius: 4, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      '& .MuiLinearProgress-bar': { bgcolor: segColor, borderRadius: 4 },
                    }}
                  />
                </Box>
                {isRisky && (
                  <Chip size="small" label={t('argus.monetization.highRisk', 'High')} sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: alpha(ARGUS_SEMANTIC.negative, isDark ? 0.15 : 0.08), color: ARGUS_SEMANTIC.negative, border: 'none' }} />
                )}
              </Box>
            );
          })}
        </Box>

        {/* Whale Insight */}
        {(() => {
          const top10 = spenders.segments.find((s: any) => s.segment === 'top_10_pct');
          const top1 = spenders.segments.find((s: any) => s.segment === 'top_1_pct');
          if (top10 && top10.percentage > 65) {
            return (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: isDark ? alpha(ARGUS_SEMANTIC.negative, 0.06) : alpha(ARGUS_SEMANTIC.negative, 0.03), border: '1px solid', borderColor: alpha(ARGUS_SEMANTIC.negative, isDark ? 0.12 : 0.06) }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: ARGUS_SEMANTIC.negative }}>
                  {t('argus.monetization.whaleConcentrationWarning', '{{pct}}% of revenue concentrated in Top 10%', { pct: top10.percentage.toFixed(0) })}{top1 ? ` (Top 1% → ${top1.percentage.toFixed(0)}%)` : ''}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>
                  → {t('argus.monetization.whaleConcentrationDetail', 'Revenue crash risk if whale users churn. Consider mid-tier growth programs & VIP retention.')}
                </Typography>
              </Box>
            );
          }
          return null;
        })()}

        {/* Top Spenders Mini Cards */}
        {spenders.top_users.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ ...SECTION_LABEL_SX, mb: 1 }}>
              {t('argus.monetization.topSpenders', 'Top Spenders')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {spenders.top_users.slice(0, 5).map((u: any, i: number) => (
                <Chip
                  key={u.user_id}
                  size="small"
                  avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 9, bgcolor: stringToColor(u.user_id) }}>{getInitials(u.user_id)}</Avatar>}
                  label={`${u.user_id.slice(0, 8)}… ${fmt(u.total_spent)}`}
                  onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(u.user_id)}`)}
                  sx={{ fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    bgcolor: i === 0 ? alpha(ARGUS_SEMANTIC.negative, isDark ? 0.12 : 0.06) : 'transparent',
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Segment cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, mb: 3 }}>
        {spenders.segments.map((seg: any) => (
          <Paper key={seg.segment} elevation={0} sx={{
            p: 2.5, borderRadius: 3, textAlign: 'center',
            bgcolor: isDark ? alpha(segmentColors[seg.segment] || '#999', 0.06) : alpha(segmentColors[seg.segment] || '#999', 0.03),
            border: '1px solid', borderColor: alpha(segmentColors[seg.segment] || '#999', isDark ? 0.15 : 0.1),
          }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>{segmentLabels[seg.segment] || seg.segment}</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color: segmentColors[seg.segment] }}>{seg.percentage.toFixed(1)}%</Typography>
            <Typography variant="caption" color="text.secondary">{t('argus.monetization.ofRevenue', 'of revenue')}</Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" fontSize={13}>{seg.user_count.toLocaleString()} {t('argus.monetization.users', 'users')} · {fmt(seg.revenue)}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Spending distribution chart */}
      {spenders.distribution.length > 0 && (
        <ArgusVolumeChart
          title={t('argus.monetization.spendDistribution', 'Spending Distribution')}
          labels={spenders.distribution.map((d: any) => `$${fmtNum(d.range_start)}~$${fmtNum(d.range_end)}`)}
          datasets={[
            { label: t('argus.monetization.users', 'Users'), data: spenders.distribution.map((d: any) => d.user_count), color: ARGUS_SERIES[0] },
          ]}
          loading={loading}
          storagePrefix="argus_spend_dist"
          showCompactToggle={false}
          mb={3}
        />
      )}

      {/* Whale dependency trend */}
      {spenders.whale_trend.length > 0 && (
        <ArgusVolumeChart
          title={t('argus.monetization.whaleTrend', 'Top 10% Revenue Share Trend')}
          rawPeriods={spenders.whale_trend.map((d: any) => d.period)}
          labels={[]}
          datasets={[
            { label: t('argus.monetization.top10PctShare', 'Top 10% Share'), data: spenders.whale_trend.map((d: any) => d.top10_pct_share), color: ARGUS_SEMANTIC.negative },
          ]}
          loading={loading}
          storagePrefix="argus_whale_trend"
          showCompactToggle={false}
          mb={3}
          onZoom={handleChartZoom(spenders.whale_trend.map((d: any) => d.period))}
        />
      )}

      {/* Top individual spenders table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>{t('argus.monetization.topIndividualSpenders', 'Top 10 Individual Spenders')}</Typography>
          <Button
            size="small" variant="outlined"
            onClick={() => downloadCsv(spenders.top_users, [
              { key: 'user_id', label: 'User ID' },
              { key: 'total_spent', label: 'Total Spent', formatter: (v: any) => `$${(Number(v) || 0).toFixed(2)}` },
              { key: 'purchase_count', label: 'Purchases' },
              { key: 'percentage', label: 'Share %', formatter: (v: any) => `${(Number(v) || 0).toFixed(1)}%` },
            ], `top_spenders_${new Date().toISOString().slice(0, 10)}`)}
            sx={{ fontSize: 11, textTransform: 'none', minWidth: 'auto', px: 1.5 }}
          >
            CSV
          </Button>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t('argus.monetization.userId', 'User ID')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.totalSpent', 'Total Spent')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.purchaseCount', 'Purchases')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.share', 'Share')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {spenders.top_users.map((u: any, i: number) => (
              <TableRow key={u.user_id} hover>
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  <Box
                    onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(u.user_id)}`)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  >
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: stringToColor(u.user_id) }}>
                      {getInitials(u.user_id)}
                    </Avatar>
                    <Typography fontWeight={600} fontSize={13} color="primary">{u.user_id}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="right"><Typography fontWeight={600} fontSize={13}>{fmt(u.total_spent)}</Typography></TableCell>
                <TableCell align="right">{u.purchase_count}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                    <LinearProgress variant="determinate" value={Math.min(u.percentage, 100)} sx={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3 }} />
                    <Typography fontSize={12} color="text.secondary">{u.percentage.toFixed(1)}%</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Segment Comparison: Whales vs Normal */}
      {segmentComparison && segmentComparison.segments.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{t('argus.monetization.segmentComparison', 'Whale vs Normal Comparison')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${segmentComparison.segments.length}, 1fr)` }, gap: 2 }}>
            {segmentComparison.segments.map((seg: any) => (
              <Paper key={seg.segment} variant="outlined" sx={{
                p: 2.5, borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                borderColor: seg.segment === 'whales' ? alpha(ARGUS_SEMANTIC.negative, 0.4) : alpha(ARGUS_SEMANTIC.positive, 0.4),
              }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{
                  color: seg.segment === 'whales' ? ARGUS_SEMANTIC.negative : ARGUS_SEMANTIC.positive,
                  textTransform: 'uppercase', mb: 1.5,
                }}>
                  {seg.segment === 'whales' ? `${t('argus.monetization.whales', 'Whales')} (Top 10%)` : t('argus.monetization.normalUsers', 'Normal Users')}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('argus.monetization.users', 'Users')}</Typography>
                    <Typography fontWeight={700}>{seg.user_count.toLocaleString()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('argus.monetization.totalRevenue', 'Revenue')}</Typography>
                    <Typography fontWeight={700}>{fmt(seg.total_revenue)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('argus.monetization.avgSpend', 'Avg Spend')}</Typography>
                    <Typography fontWeight={700}>{fmt(seg.avg_spend)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('argus.monetization.avgPurchases', 'Avg Purchases')}</Typography>
                    <Typography fontWeight={700}>{seg.avg_purchases.toFixed(1)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('argus.monetization.aov', 'AOV')}</Typography>
                    <Typography fontWeight={700}>{fmt(seg.avg_order_value)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('argus.monetization.avgActiveDays', 'Avg Active Days')}</Typography>
                    <Typography fontWeight={700}>{seg.avg_active_days.toFixed(1)}</Typography>
                  </Box>
                </Box>
                {seg.top_products.length > 0 && (
                  <>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('argus.monetization.topProducts', 'Top Products')}</Typography>
                    {seg.top_products.map((p: any, i: number) => (
                      <Box key={p.product_name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                        <Typography fontSize={12}>{i + 1}. {p.product_name}</Typography>
                        <Typography fontSize={12} color="text.secondary">{p.count}</Typography>
                      </Box>
                    ))}
                  </>
                )}
              </Paper>
            ))}
          </Box>
        </Box>
      )}
    </>
  );
};
