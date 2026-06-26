import React from 'react';
import {
  Box, Typography, alpha, Paper, Chip, Table, TableHead, TableRow, TableCell, TableBody, TextField, InputAdornment, Select, MenuItem
} from '@mui/material';
import { Timeline as LtvIcon } from '@mui/icons-material';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { formatWith } from '@/utils/dateFormat';
import { fmt, fmtNum, CHART_COLORS } from './MonetizationHelpers';
import { ARGUS_SEMANTIC, ARGUS_SERIES } from '../../argusThemeTokens';

interface ArgusMonetizationLtvProps {
  ltv: any;
  loading: boolean;
  isDark: boolean;
  t: any;
  cacInput: number;
  setCacInput: (cac: number) => void;
  cohortLtv: any;
  ltvCohortBy: string;
  setLtvCohortBy: (by: string) => void;
  handleChartZoom: (rawPeriods: string[]) => (startIdx: number, endIdx: number) => void;
}

export const ArgusMonetizationLtv: React.FC<ArgusMonetizationLtvProps> = ({
  ltv, loading, isDark, t, cacInput, setCacInput, cohortLtv, ltvCohortBy, setLtvCohortBy, handleChartZoom
}) => {
  if (!ltv || ltv.ltv_curve.length === 0) {
    return <EmptyPagePlaceholder icon={<LtvIcon sx={{ fontSize: 48 }} />} message={t('argus.monetization.noLtv', 'No LTV data')} subtitle={t('argus.monetization.noLtvDesc', 'Need purchase events with user tracking')} />;
  }

  // Show LTV milestones with user_count
  const milestones = [0, 1, 7, 14, 30, 60, 90].filter((d) => ltv.ltv_curve.some((c: any) => c.day === d));
  const milestoneData = milestones.map((d) => ltv.ltv_curve.find((c: any) => c.day === d)!).filter(Boolean);

  // D1 value for growth multiplier calculation
  const d1LtvObj = ltv.ltv_curve.find((c: any) => c.day === 1);
  const d1LtvVal = d1LtvObj ? d1LtvObj.cumulative_revenue : 0;

  // BEP (Payback Day) calculation
  const paybackObj = ltv.ltv_curve.find((c: any) => c.cumulative_revenue >= cacInput);
  const isPaybackReached = !!paybackObj;
  const paybackDayText = isPaybackReached ? `D${paybackObj.day}` : t('argus.monetization.notReached', 'Not Reached');

  return (
    <>
      {/* LTV Header with CAC input and Payback Period */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {t('argus.monetization.ltvAnalysis', 'LTV & ROAS Simulator')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('argus.monetization.ltvDesc', 'Track Lifetime Value progression, Customer Acquisition Cost (CAC) payback, and multiplier growth.')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label={t('argus.monetization.targetCac', 'Target CAC')}
            type="number"
            size="small"
            value={cacInput === 0 ? '' : cacInput}
            onChange={(e) => setCacInput(Math.max(0, Number(e.target.value) || 0))}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            sx={{ width: 140 }}
          />
        </Box>
      </Box>

      {/* Milestone cards with user count, Multiplier and ROAS */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 2, mb: 3 }}>
        {/* Special BEP Payback Period Card */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 3,
            textAlign: 'center',
            border: '2px solid',
            borderColor: isPaybackReached ? ARGUS_SEMANTIC.positive : 'divider',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t('argus.monetization.paybackPeriod', 'PAYBACK PERIOD')}
          </Typography>
          <Typography variant="h5" fontWeight={800} color={isPaybackReached ? ARGUS_SEMANTIC.positive : 'text.primary'} sx={{ my: 0.5 }}>
            {paybackDayText}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {isPaybackReached
              ? t('argus.monetization.bepReached', '100% ROAS Achieved')
              : t('argus.monetization.bepNotReached', 'Below Target CAC')}
          </Typography>
        </Paper>

        {milestoneData.map((m: any) => {
          const roasVal = cacInput > 0 ? ((m.cumulative_revenue / cacInput) * 100).toFixed(1) + '%' : '-';
          const mult = d1LtvVal > 0 ? (m.cumulative_revenue / d1LtvVal).toFixed(1) + 'x' : '1.0x';
          return (
            <Paper
              key={m.day}
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                textAlign: 'center',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
              }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                Day {m.day}
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ my: 0.5 }}>
                {fmt(m.cumulative_revenue)}
              </Typography>
              <Box sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                <div style={{ color: m.cumulative_revenue >= cacInput ? ARGUS_SEMANTIC.positive : ARGUS_SEMANTIC.warning }}>
                  {roasVal} ROAS
                </div>
                {m.day > 1 && (
                  <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>
                    {mult} of D1
                  </div>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* pLTV Predictions — Milestone Cards */}
      {ltv.pltv_predictions && ltv.pltv_predictions.length > 0 && (
        <Paper elevation={0} sx={{
          p: 2.5, borderRadius: 3, mb: 3,
          bgcolor: isDark ? alpha(ARGUS_SERIES[4], 0.04) : alpha(ARGUS_SERIES[4], 0.02),
          border: '1px dashed', borderColor: alpha(ARGUS_SERIES[4], isDark ? 0.2 : 0.15),
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: ARGUS_SERIES[4] }}>
                {t('argus.monetization.pltvPrediction', 'Predicted LTV (pLTV)')}
              </Typography>
              <Typography fontSize={11} color="text.secondary">
                {t('argus.monetization.pltvDesc', 'Log-curve fit: y = a·ln(x+1) + b')}
              </Typography>
            </Box>
            <Chip size="small"
              label={`R² = ${(ltv.pltv_confidence * 100).toFixed(1)}%`}
              sx={{
                height: 22, fontSize: 11, fontWeight: 700,
                bgcolor: alpha(ltv.pltv_confidence >= 0.9 ? ARGUS_SEMANTIC.positive : ltv.pltv_confidence >= 0.7 ? ARGUS_SEMANTIC.warning : ARGUS_SEMANTIC.negative, isDark ? 0.15 : 0.08),
                color: ltv.pltv_confidence >= 0.9 ? ARGUS_SEMANTIC.positive : ltv.pltv_confidence >= 0.7 ? ARGUS_SEMANTIC.warning : ARGUS_SEMANTIC.negative,
                border: 'none',
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {ltv.pltv_predictions.map((pred: any) => {
              const roasVal = cacInput > 0 ? ((pred.predicted_ltv / cacInput) * 100).toFixed(1) + '%' : '-';
              return (
                <Box key={pred.day} sx={{
                  flex: '1 1 100px', minWidth: 90, textAlign: 'center',
                  p: 1.5, borderRadius: 2,
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                  border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }}>
                  <Typography fontSize={10} color="text.secondary" fontWeight={700}>D{pred.day}</Typography>
                  <Typography fontSize={16} fontWeight={800} sx={{ color: ARGUS_SERIES[4] }}>
                    {fmt(pred.predicted_ltv)}
                  </Typography>
                  {cacInput > 0 && (
                    <Typography fontSize={10} sx={{ color: pred.predicted_ltv >= cacInput ? ARGUS_SEMANTIC.positive : ARGUS_SEMANTIC.warning, fontWeight: 600 }}>
                      {roasVal} ROAS
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Dual LTV chart: cumulative + daily + pLTV prediction */}
      {(() => {
        // Build unified labels: actual days + predicted extension
        const actualDays = ltv.ltv_curve.map((d: any) => d.day);
        const maxActualDay = actualDays.length > 0 ? Math.max(...actualDays) : 0;
        const hasPltv = ltv.pltv_curve && ltv.pltv_curve.length > 0;

        // Extended labels: actual + predicted-only days
        const predOnlyDays = hasPltv
          ? ltv.pltv_curve.filter((p: any) => p.day > maxActualDay).map((p: any) => p.day)
          : [];
        const allDays = [...actualDays, ...predOnlyDays];
        const labels = allDays.map(d => `D${d}`);

        // Actual data padded with null for predicted extension
        const actualCumulative = [
          ...ltv.ltv_curve.map((d: any) => d.cumulative_revenue),
          ...predOnlyDays.map(() => null as number | null),
        ];
        const actualDaily = [
          ...ltv.ltv_curve.map((d: any) => d.daily_revenue),
          ...predOnlyDays.map(() => null as number | null),
        ];

        // Predicted line: null for days before prediction starts, then predicted values
        const predLine = hasPltv
          ? allDays.map(day => {
              const pt = ltv.pltv_curve.find((p: any) => p.day === day);
              return pt ? pt.predicted_ltv : null;
            })
          : [];

        return (
          <ArgusVolumeChart
            title={t('argus.monetization.ltvCurve', 'Revenue LTV Curve')}
            labels={labels}
            datasets={[
              { label: t('argus.monetization.cumulativeRevenue', 'Cumulative Revenue'), data: actualCumulative as number[], color: ARGUS_SEMANTIC.positive },
              { label: t('argus.monetization.dailyRevenue', 'Daily Revenue'), data: actualDaily as number[], color: ARGUS_SEMANTIC.info },
              ...(hasPltv ? [{
                label: t('argus.monetization.pltvLine', 'Predicted LTV'),
                data: predLine as number[],
                color: ARGUS_SERIES[4],
              }] : []),
            ]}
            loading={loading}
            storagePrefix="argus_revenue_ltv"
            showCompactToggle={false}
            mb={3}
          />
        );
      })()}

      {/* Cohort LTV Comparison */}
      {cohortLtv && cohortLtv.cohorts.length > 0 && (
        <Box sx={{ mt: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('argus.monetization.cohortLtv', 'LTV by Cohort')}</Typography>
            <Select
              size="small"
              value={ltvCohortBy}
              onChange={(e) => setLtvCohortBy(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="week">{t('argus.monetization.byWeek', 'By Install Week')}</MenuItem>
              <MenuItem value="platform">{t('argus.monetization.byPlatform', 'By Platform')}</MenuItem>
              <MenuItem value="country">{t('argus.monetization.byCountry', 'By Country')}</MenuItem>
            </Select>
          </Box>
          <ArgusVolumeChart
            title=""
            labels={(() => {
              const maxLen = Math.max(...cohortLtv.cohorts.map((c: any) => c.ltv_curve.length));
              const ref = cohortLtv.cohorts.find((c: any) => c.ltv_curve.length === maxLen);
              return ref ? ref.ltv_curve.map((d: any) => `D${d.day}`) : [];
            })()}
            datasets={cohortLtv.cohorts.map((c: any, i: number) => ({
              label: ltvCohortBy === 'week'
                ? formatWith(c.label, 'M/D')
                : c.label || t('common.unknown', 'Unknown'),
              data: c.ltv_curve.map((d: any) => d.cumulative_revenue),
              color: CHART_COLORS[i % CHART_COLORS.length],
            }))}
            loading={loading}
            storagePrefix="argus_cohort_ltv"
            showCompactToggle={false}
            mb={0}
          />
        </Box>
      )}

      {/* LTV detailed breakdown table */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t('argus.monetization.ltvBreakdownTable', 'LTV Detailed Breakdown')}
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{t('argus.monetization.cohortDay', 'Day')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.cumulativeLtv', 'Cumulative LTV')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.dailyRevenue', 'Daily Revenue')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.multiplier', 'Multiplier')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.roas', 'ROAS')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.monetization.users', 'Cohort Users')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ltv.ltv_curve.map((row: any) => {
              const multVal = d1LtvVal > 0 ? (row.cumulative_revenue / d1LtvVal).toFixed(2) + 'x' : '-';
              const roasPercent = cacInput > 0 ? ((row.cumulative_revenue / cacInput) * 100).toFixed(1) + '%' : '-';
              const isBep = row.cumulative_revenue >= cacInput;
              return (
                <TableRow key={row.day} hover>
                  <TableCell>Day {row.day}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={600} fontSize={13}>{fmt(row.cumulative_revenue)}</Typography>
                  </TableCell>
                  <TableCell align="right">{fmt(row.daily_revenue)}</TableCell>
                  <TableCell align="right">{row.day === 1 ? '1.00x (Ref)' : multVal}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={600} fontSize={13} color={isBep ? ARGUS_SEMANTIC.positive : ARGUS_SEMANTIC.warning}>
                      {roasPercent}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{row.user_count.toLocaleString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </>
  );
};
