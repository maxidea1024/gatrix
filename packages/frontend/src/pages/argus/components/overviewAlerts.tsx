import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import {
  TrendingUp as UpIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ARGUS_SEMANTIC, SECTION_LABEL_SX } from '../argusThemeTokens';
import { formatCompactNumber } from '@/utils/numberFormat';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  /** Navigation path when clicked */
  href?: string;
}

// ─── Alert Detection Logic ───────────────────────────────────────────────────

interface OverviewData {
  error_summary?: {
    total_errors: number;
    affected_users: number;
    unique_issues: number;
  };
  transaction_summary?: {
    total_transactions: number;
    error_rate: number;
  };
  session_summary?: {
    crash_free_rate: number;
    crashed_sessions: number;
  };
  previous_period?: {
    total_errors: number;
    affected_users: number;
    total_transactions: number;
    crash_free_rate: number;
  };
  top_issues?: {
    fingerprint: string;
    title: string;
    event_count: number;
    user_count: number;
    level?: string;
  }[];
  unhandled_rate?: number;
  error_by_release?: { release: string; count: number; users: number }[];
}

function pctChange(curr: number, prev: number): number | undefined {
  if (!prev || prev === 0) return undefined;
  return ((curr - prev) / prev) * 100;
}

/**
 * Automatically detect anomalies / attention items from overview data.
 * Returns a prioritized list of alerts (critical first).
 */
export function detectAlerts(
  data: OverviewData,
  t: (key: string, fallback: string, vars?: any) => string
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const es = data.error_summary;
  const ts = data.transaction_summary;
  const ss = data.session_summary;
  const pp = data.previous_period;

  // 1. Error spike
  if (es && pp && pp.total_errors > 0) {
    const chg = pctChange(es.total_errors, pp.total_errors);
    if (chg !== undefined && chg > 50) {
      alerts.push({
        id: 'error-spike',
        severity: chg > 200 ? 'critical' : 'warning',
        title: t(
          'argus.overview.alertErrorSpike',
          'Errors increased {{pct}}% vs previous period',
          { pct: Math.round(chg) }
        ),
        detail: t(
          'argus.overview.alertErrorSpikeDetail',
          '{{errors}} errors affecting {{users}} users',
          {
            errors: formatCompactNumber(es.total_errors),
            users: formatCompactNumber(es.affected_users),
          }
        ),
        href: '/argus/issues',
      });
    }
  }

  // 2. Crash-free rate drop
  if (ss && pp && pp.crash_free_rate > 0) {
    const diff = ss.crash_free_rate - pp.crash_free_rate;
    if (diff < -1) {
      alerts.push({
        id: 'crash-rate-drop',
        severity: diff < -5 ? 'critical' : 'warning',
        title: t(
          'argus.overview.alertCrashRate',
          'Crash-free rate dropped {{diff}}%p',
          { diff: Math.abs(diff).toFixed(1) }
        ),
        detail: t(
          'argus.overview.alertCrashRateDetail',
          '{{current}}% → was {{prev}}%',
          {
            current: ss.crash_free_rate.toFixed(1),
            prev: pp.crash_free_rate.toFixed(1),
          }
        ),
        href: '/argus/issues',
      });
    }
  }

  // 3. High unhandled rate
  if (data.unhandled_rate !== undefined && data.unhandled_rate > 30) {
    alerts.push({
      id: 'high-unhandled',
      severity: data.unhandled_rate > 60 ? 'critical' : 'warning',
      title: t(
        'argus.overview.alertUnhandled',
        '{{pct}}% of errors are unhandled',
        { pct: data.unhandled_rate.toFixed(0) }
      ),
      detail: t(
        'argus.overview.alertUnhandledDetail',
        'Unhandled errors crash the app and degrade user experience'
      ),
      href: '/argus/issues?level=fatal',
    });
  }

  // 4. Transaction error rate
  if (ts && ts.error_rate > 5) {
    alerts.push({
      id: 'txn-error-rate',
      severity: ts.error_rate > 15 ? 'critical' : 'warning',
      title: t(
        'argus.overview.alertTxnErrorRate',
        'Transaction error rate at {{pct}}%',
        { pct: ts.error_rate.toFixed(1) }
      ),
      detail: `${formatCompactNumber(ts.total_transactions)} ${t('argus.overview.totalTransactions', 'total transactions')}`,
      href: '/argus/performance',
    });
  }

  // 5. Affected users spike
  if (es && pp && pp.affected_users > 0) {
    const chg = pctChange(es.affected_users, pp.affected_users);
    if (chg !== undefined && chg > 80) {
      alerts.push({
        id: 'user-impact-spike',
        severity: 'warning',
        title: t(
          'argus.overview.alertUserSpike',
          'Affected users increased {{pct}}%',
          { pct: Math.round(chg) }
        ),
        detail: `${formatCompactNumber(es.affected_users)} ${t('argus.overview.usersAffected', 'users affected')}`,
        href: '/argus/issues',
      });
    }
  }

  // 6. Release with high error count
  if (data.error_by_release && data.error_by_release.length > 0) {
    const topRelease = data.error_by_release[0];
    const totalErrors = es?.total_errors || 0;
    if (totalErrors > 0 && topRelease.count / totalErrors > 0.5) {
      alerts.push({
        id: 'release-hotspot',
        severity: 'warning',
        title: t(
          'argus.overview.alertRelease',
          'Release "{{release}}" causing {{pct}}% of errors',
          {
            release:
              topRelease.release.length > 20
                ? topRelease.release.slice(0, 20) + '…'
                : topRelease.release,
            pct: ((topRelease.count / totalErrors) * 100).toFixed(0),
          }
        ),
        detail: `${formatCompactNumber(topRelease.count)} ${t('argus.overview.errors', 'errors')}, ${formatCompactNumber(topRelease.users)} ${t('argus.overview.usersAffected', 'users affected')}`,
        href: '/argus/issues',
      });
    }
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}

// ─── AlertPanel Component ────────────────────────────────────────────────────

const severityConfig = {
  critical: { color: ARGUS_SEMANTIC.negative, icon: WarningIcon },
  warning: { color: ARGUS_SEMANTIC.warning, icon: WarningIcon },
  info: { color: ARGUS_SEMANTIC.info, icon: UpIcon },
} as const;

interface AlertPanelProps {
  alerts: AlertItem[];
  onNavigate: (href: string) => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  onNavigate,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  if (alerts.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ ...SECTION_LABEL_SX, mb: 1.5 }}>
        {t('argus.overview.attentionNeeded', 'Attention Needed')}
      </Typography>
      {/* Outer card */}
      <Box
        sx={{
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: theme.palette.background.paper,
          p: { xs: 2, sm: 2.5 },
        }}
      >
        {/* Inner cards grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm:
                alerts.length <= 2
                  ? `repeat(${alerts.length}, 1fr)`
                  : 'repeat(2, 1fr)',
              md:
                alerts.length <= 4
                  ? `repeat(${alerts.length}, 1fr)`
                  : 'repeat(4, 1fr)',
            },
            gap: 2,
          }}
        >
          {alerts.map((alert) => {
            const cfg = severityConfig[alert.severity];
            const Icon = cfg.icon;
            return (
              <Box
                key={alert.id}
                onClick={() => alert.href && onNavigate(alert.href)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha(cfg.color, isDark ? 0.2 : 0.15)}`,
                  background: isDark
                    ? alpha(cfg.color, 0.04)
                    : alpha(cfg.color, 0.02),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  cursor: alert.href ? 'pointer' : 'default',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': alert.href
                    ? {
                        transform: 'translateY(-2px)',
                        borderColor: alpha(cfg.color, 0.4),
                        background: isDark
                          ? alpha(cfg.color, 0.08)
                          : alpha(cfg.color, 0.04),
                      }
                    : {},
                }}
              >
                {/* Icon + Arrow row */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      bgcolor: alpha(cfg.color, isDark ? 0.15 : 0.1),
                      color: cfg.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 16 }} />
                  </Box>
                  {alert.href && (
                    <ArrowIcon
                      sx={{
                        fontSize: 14,
                        color: isDark
                          ? 'rgba(255,255,255,0.15)'
                          : 'rgba(0,0,0,0.15)',
                        transition: 'color 0.2s',
                      }}
                    />
                  )}
                </Box>

                {/* Text */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      lineHeight: 1.35,
                      color: cfg.color,
                    }}
                  >
                    {alert.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.675rem',
                      color: 'text.secondary',
                      lineHeight: 1.3,
                      mt: 0.5,
                    }}
                  >
                    {alert.detail}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};
