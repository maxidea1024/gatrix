import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, useTheme, alpha, Paper, Button,
  FormControl, InputLabel, Select, MenuItem, TextField, LinearProgress,
} from '@mui/material';
import {
  CompareArrows as ImpactIcon, TrendingUp as LiftIcon, People as PeopleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import DateRangeSelector, {
  DateRangeValue, dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  analyzeImpact, getAnalyticsEventNames,
  type ImpactAnalysisResult,
} from '@/services/argus/argusAnalytics';
import type { AnalyticsEventNameEntry } from '@/services/argus/argusTypes';

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps { label: string; value: string; sub?: string; color?: string; }

const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, color }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper variant="outlined" sx={{
      p: 2.5, borderRadius: 3, textAlign: 'center',
      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
      borderColor: color ? alpha(color, 0.3) : undefined,
    }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h4" fontWeight={800} sx={{ color: color || 'text.primary', my: 0.5 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusImpactPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');

  const [eventNames, setEventNames] = useState<AnalyticsEventNameEntry[]>([]);
  const [causeEvent, setCauseEvent] = useState('');
  const [effectEvent, setEffectEvent] = useState('');
  const [windowDays, setWindowDays] = useState(7);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ type: 'preset', preset: '30d' });
  const [result, setResult] = useState<ImpactAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAnalyticsEventNames(projectId).then(setEventNames).catch(() => {});
  }, [projectId]);

  const runAnalysis = useCallback(async () => {
    if (!causeEvent || !effectEvent) return;
    setLoading(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const data = await analyzeImpact(projectId, {
        causeEvent, effectEvent, windowDays, ...apiParams,
      });
      setResult(data);
    } catch { setResult(null); }
    finally { setLoading(false); }
  }, [projectId, causeEvent, effectEvent, windowDays, dateRange]);

  const liftColor = result && result.lift > 0 ? '#4caf50'
    : result && result.lift < 0 ? '#f44336' : theme.palette.text.primary;

  return (
    <Box>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              { label: t('argus.analytics.title', 'Analytics'), to: '/argus/analytics' },
              { label: t('argus.impact', 'Impact Analysis') },
            ]}
            size="title"
          />
        }
        subtitle={t('argus.impact.subtitle')}
      />

      {/* Query Builder */}
      <Paper variant="outlined" sx={{
        p: 2.5, borderRadius: 3, mb: 3,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
      }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={600}>{t('argus.impact.usersWhoDid')}</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('argus.impact.causeEvent')}</InputLabel>
            <Select value={causeEvent} label={t('argus.impact.causeEvent')} onChange={(e) => setCauseEvent(e.target.value)}>
              {eventNames.map((en) => <MenuItem key={en.name} value={en.name}>{en.display_name || en.name}</MenuItem>)}
            </Select>
          </FormControl>

          <ImpactIcon color="action" />

          <Typography variant="body2" fontWeight={600}>{t('argus.impact.thenDid')}</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('argus.impact.effectEvent')}</InputLabel>
            <Select value={effectEvent} label={t('argus.impact.effectEvent')} onChange={(e) => setEffectEvent(e.target.value)}>
              {eventNames.map((en) => <MenuItem key={en.name} value={en.name}>{en.display_name || en.name}</MenuItem>)}
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary">{t('argus.impact.within')}</Typography>
          <TextField type="number" size="small" value={windowDays}
            onChange={(e) => setWindowDays(Math.max(1, parseInt(e.target.value) || 1))}
            sx={{ width: 70 }} inputProps={{ min: 1, max: 90 }} />
          <Typography variant="body2" color="text.secondary">{t('argus.impact.days')}</Typography>

          <DateRangeSelector value={dateRange} onChange={setDateRange} />

          <Button variant="contained" onClick={runAnalysis}
            disabled={!causeEvent || !effectEvent || loading} sx={{ ml: 'auto' }}>
            {t('argus.impact.analyze')}
          </Button>
        </Box>
      </Paper>

      <PageContentLoader loading={loading}>
        {result ? (
          <>
            {/* KPI Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
              <MetricCard label={t('argus.impact.causeUsers')} value={result.cause_users.toLocaleString()}
                sub={`"${result.cause_event}"`} color={theme.palette.primary.main} />
              <MetricCard label={t('argus.impact.converted')} value={result.converted_users.toLocaleString()}
                sub={`${result.conversion_rate}% ${t('argus.impact.conversion')}`} color={theme.palette.secondary.main} />
              <MetricCard label={t('argus.impact.baselineRate')} value={`${result.baseline_rate}%`}
                sub={`${result.baseline_converted} / ${result.baseline_users}`} />
              <MetricCard label={t('argus.impact.lift')} value={`${result.lift > 0 ? '+' : ''}${result.lift}%`}
                sub={result.lift > 0 ? t('argus.impact.positiveImpact') : result.lift < 0 ? t('argus.impact.negativeImpact') : t('argus.impact.noImpact')}
                color={liftColor} />
            </Box>

            {/* Comparison Bar */}
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>{t('argus.impact.conversionComparison')}</Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>{t('argus.impact.exposed')}</Typography>
                  <Typography variant="body2" fontWeight={700} color="primary">{result.conversion_rate}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={Math.min(result.conversion_rate, 100)} sx={{
                  height: 24, borderRadius: 2,
                  bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  '& .MuiLinearProgress-bar': { borderRadius: 2 },
                }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>{t('argus.impact.baseline')}</Typography>
                  <Typography variant="body2" fontWeight={700} color="text.secondary">{result.baseline_rate}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={Math.min(result.baseline_rate, 100)} color="inherit" sx={{
                  height: 24, borderRadius: 2,
                  bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: 'text.disabled' },
                }} />
              </Box>
            </Paper>
          </>
        ) : (
          <EmptyPagePlaceholder
            icon={<ImpactIcon sx={{ fontSize: 48 }} />}
            message={t('argus.impact.selectAndAnalyze')}
          />
        )}
      </PageContentLoader>
    </Box>
  );
};

export default ArgusImpactPage;
