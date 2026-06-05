import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, useTheme, alpha, Tooltip, LinearProgress, Divider,
} from '@mui/material';
import {
  TrendingDown as ImpactIcon, People as UsersIcon,
  AttachMoney as RevenueIcon, Timer as LatencyIcon,
  ShowChart as TrendIcon, Warning as SeverityIcon,
  Speed as TransactionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface BusinessImpactWidgetProps {
  projectId: string;
  issueId: string;
  eventCount: number;
  userCount: number;
  firstSeen?: string;
  lastSeen?: string;
  level: string;
  isDark: boolean;
}

interface ImpactMetrics {
  impactScore: number;
  estimatedRevenueLoss: string;
  affectedSessions: number;
  errorBudgetUsed: number;
  mttr: string; // Mean Time To Resolve
  trend: 'increasing' | 'stable' | 'decreasing';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

function calculateImpact(
  eventCount: number, userCount: number, firstSeen?: string, lastSeen?: string, level?: string
): ImpactMetrics {
  // Impact score based on events, users, severity
  const severityWeight = level === 'fatal' ? 5 : level === 'error' ? 3 : level === 'warning' ? 1 : 0.5;
  const eventScore = Math.min(eventCount / 100, 5); // 0-5
  const userScore = Math.min(userCount / 50, 5); // 0-5

  // Duration factor
  let durationHours = 0;
  if (firstSeen && lastSeen) {
    durationHours = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 3600000;
  }
  const durationScore = Math.min(durationHours / 24, 3); // 0-3

  const rawScore = (eventScore * 3 + userScore * 4 + durationScore * 1 + severityWeight * 2) / 15 * 100;
  const impactScore = Math.min(Math.round(rawScore), 100);

  // Estimated revenue loss (simplified calculation)
  const avgRevenuePerUser = 2.5; // arbitrary $/user/day
  const estimatedLoss = userCount * avgRevenuePerUser * Math.max(durationHours / 24, 0.1);

  // Error budget used (assuming 99.9% SLA)
  const errorBudgetUsed = Math.min(Math.round((eventCount / 1000) * 100), 100);

  // MTTR
  const hoursDiff = durationHours;
  const mttr = hoursDiff < 1 ? `${Math.round(hoursDiff * 60)}m` :
    hoursDiff < 24 ? `${Math.round(hoursDiff)}h` : `${Math.round(hoursDiff / 24)}d`;

  // Trend (based on recent activity)
  const recentHours = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) / 3600000 : 999;
  const trend: ImpactMetrics['trend'] = recentHours < 1 ? 'increasing' : recentHours < 6 ? 'stable' : 'decreasing';

  // Risk level
  const riskLevel: ImpactMetrics['riskLevel'] =
    impactScore >= 80 ? 'critical' : impactScore >= 50 ? 'high' : impactScore >= 25 ? 'medium' : 'low';

  return {
    impactScore,
    estimatedRevenueLoss: `$${estimatedLoss.toFixed(0)}`,
    affectedSessions: Math.round(eventCount * 1.3),
    errorBudgetUsed,
    mttr,
    trend,
    riskLevel,
  };
}

const RISK_COLORS: Record<string, string> = {
  critical: '#f44336', high: '#ff9800', medium: '#2196f3', low: '#4caf50',
};

const getTrendConfig = (t: (key: string, fallback: string) => string): Record<string, { color: string; label: string }> => ({
  increasing: { color: '#f44336', label: `↗ ${t('argus.impact.trendIncreasing', 'Increasing')}` },
  stable: { color: '#ff9800', label: `→ ${t('argus.impact.trendStable', 'Stable')}` },
  decreasing: { color: '#4caf50', label: `↘ ${t('argus.impact.trendDecreasing', 'Decreasing')}` },
});

const MetricCard: React.FC<{
  icon: React.ReactElement; label: string; value: string | number;
  color: string; subtitle?: string; isDark: boolean;
}> = ({ icon, label, value, color, subtitle, isDark }) => (
  <Box sx={{
    p: 1.5, borderRadius: 1.5, flex: 1, minWidth: 100,
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </Typography>
    </Box>
    <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color, lineHeight: 1.2 }}>{value}</Typography>
    {subtitle && <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', mt: 0.25 }}>{subtitle}</Typography>}
  </Box>
);

const BusinessImpactWidget: React.FC<BusinessImpactWidgetProps> = ({
  projectId, issueId, eventCount, userCount, firstSeen, lastSeen, level, isDark,
}) => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null);

  useEffect(() => {
    const result = calculateImpact(eventCount, userCount, firstSeen, lastSeen, level);
    setMetrics(result);
  }, [eventCount, userCount, firstSeen, lastSeen, level]);

  if (!metrics) return null;

  const riskColor = RISK_COLORS[metrics.riskLevel];
  const trendConfig = getTrendConfig(t)[metrics.trend];

  return (
    <Box sx={{ mb: 2 }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
      }}>
        <ImpactIcon sx={{ fontSize: 18, color: riskColor }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, fontSize: '0.82rem' }}>
          {t('argus.impact.title', 'Business Impact')}
        </Typography>
        <Chip label={metrics.riskLevel.toUpperCase()} size="small" sx={{
          height: 20, fontSize: '0.6rem', fontWeight: 800,
          backgroundColor: alpha(riskColor, 0.1), color: riskColor,
        }} />
        <Chip label={trendConfig.label} size="small" sx={{
          height: 20, fontSize: '0.6rem', fontWeight: 600,
          backgroundColor: alpha(trendConfig.color, 0.08), color: trendConfig.color,
        }} />
      </Box>

      {/* Impact Score Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary' }}>
            {t('argus.impact.score', 'Impact Score')}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: riskColor }}>
            {metrics.impactScore}/100
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={metrics.impactScore}
          sx={{
            height: 6, borderRadius: 3,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              background: metrics.impactScore >= 80
                ? 'linear-gradient(90deg, #ff9800, #f44336)'
                : metrics.impactScore >= 50
                  ? 'linear-gradient(90deg, #2196f3, #ff9800)'
                  : 'linear-gradient(90deg, #4caf50, #2196f3)',
            },
          }}
        />
      </Box>

      {/* Metric Grid */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <MetricCard isDark={isDark}
          icon={<UsersIcon sx={{ fontSize: 14 }} />} label={t('argus.impact.users', 'Users')}
          value={userCount.toLocaleString()} color="#2196f3"
          subtitle={`${metrics.affectedSessions.toLocaleString()} ${t('argus.impact.sessions', 'sessions')}`}
        />
        <MetricCard isDark={isDark}
          icon={<RevenueIcon sx={{ fontSize: 14 }} />} label={t('argus.impact.estLoss', 'Est. Loss')}
          value={metrics.estimatedRevenueLoss} color="#f44336"
          subtitle={t('argus.impact.basedOnUserImpact', 'based on user impact')}
        />
        <MetricCard isDark={isDark}
          icon={<TransactionIcon sx={{ fontSize: 14 }} />} label={t('argus.impact.errorBudget', 'Error Budget')}
          value={`${metrics.errorBudgetUsed}%`} color={metrics.errorBudgetUsed > 80 ? '#f44336' : '#ff9800'}
          subtitle={t('argus.impact.ofSla', 'of 99.9% SLA')}
        />
        <MetricCard isDark={isDark}
          icon={<LatencyIcon sx={{ fontSize: 14 }} />} label={t('argus.impact.mttr', 'Duration')}
          value={metrics.mttr} color="#7c4dff"
          subtitle={t('argus.impact.sinceFirstSeen', 'since first seen')}
        />
      </Box>

      <Divider sx={{ mt: 2 }} />
    </Box>
  );
};

export default BusinessImpactWidget;
