import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  Avatar,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  DonutLarge as DonutIcon,
  Person as PersonIcon,
  RocketLaunch as DeployIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/numberFormat';
import { formatRelativeTime } from '@/utils/dateFormat';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// ─── Constants ───

export const PAGE_SIZE_STORAGE_KEY = 'argus_release_issues_page_size';
export const COLLAPSE_STORAGE_KEY = 'argus_release_detail_collapsed';

export type IssueTabType = 'all' | 'new' | 'unhandled' | 'regressed' | 'resolved';

export const ISSUE_TABS: { key: IssueTabType; labelKey: string; fallback: string }[] = [
  { key: 'all', labelKey: 'argus.releaseDetail.allIssues', fallback: 'All' },
  { key: 'new', labelKey: 'argus.releaseDetail.newIssues', fallback: 'New' },
  {
    key: 'unhandled',
    labelKey: 'argus.releaseDetail.unhandledIssues',
    fallback: 'Unhandled',
  },
  {
    key: 'regressed',
    labelKey: 'argus.releaseDetail.regressedIssues',
    fallback: 'Regressed',
  },
  {
    key: 'resolved',
    labelKey: 'argus.releaseDetail.resolvedIssues',
    fallback: 'Resolved',
  },
];

// ─── Session Status Constants ───

export const SESSION_STATUSES = [
  {
    key: 'healthy',
    labelKey: 'argus.sessions.healthy',
    fallback: 'Healthy',
    color: '#4caf50',
  },
  {
    key: 'errored',
    labelKey: 'argus.sessions.errored',
    fallback: 'Errored',
    color: '#ff9800',
  },
  {
    key: 'crashed',
    labelKey: 'argus.sessions.crashed',
    fallback: 'Crashed',
    color: '#f44336',
  },
  {
    key: 'abnormal',
    labelKey: 'argus.sessions.abnormal',
    fallback: 'Abnormal',
    color: '#9c27b0',
  },
] as const;

// ─── ReleaseHealthChart ───

export const ReleaseHealthChart: React.FC<{
  data: { timestamp: string; crash_free_rate: number }[];
  isDark: boolean;
}> = ({ data, isDark }) => {
  const { t } = useTranslation();
  if (!data || data.length < 2) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 180,
        }}
      >
        <Typography variant="body2" color="text.disabled">
          {t('argus.releaseDetail.noHealthData', 'No health data available')}
        </Typography>
      </Box>
    );
  }

  const maxVal = 100;
  const minVal = Math.min(...data.map((d) => d.crash_free_rate), 90);
  const range = maxVal - minVal || 1;
  const chartWidth = 800;
  const chartHeight = 160;
  const padding = { top: 10, right: 40, bottom: 30, left: 50 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * innerW,
    y: padding.top + (1 - (d.crash_free_rate - minVal) / range) * innerH,
    value: d.crash_free_rate,
    ts: d.timestamp,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  const lineColor = '#4caf50';
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal];
  const xLabels =
    data.length > 6
      ? [
          0,
          Math.floor(data.length / 3),
          Math.floor((2 * data.length) / 3),
          data.length - 1,
        ]
      : data.map((_, i) => i);

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 2,
        p: 2,
        mb: 3,
      }}
    >
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
        style={{ maxHeight: 180 }}
      >
        {/* Y-axis grid + labels */}
        {yTicks.map((tick) => {
          const y = padding.top + (1 - (tick - minVal) / range) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                strokeDasharray="3,3"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fill={isDark ? '#888' : '#999'}
                fontSize={11}
              >
                {tick.toFixed(1)}%
              </text>
            </g>
          );
        })}
        {/* X-axis labels */}
        {xLabels.map((idx) => {
          const p = points[idx as number];
          if (!p) return null;
          const label = new Date(
            data[idx as number].timestamp
          ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <text
              key={idx}
              x={p.x}
              y={chartHeight - 5}
              textAnchor="middle"
              fill={isDark ? '#888' : '#999'}
              fontSize={10}
            >
              {label}
            </text>
          );
        })}
        {/* Area fill */}
        <path d={areaPath} fill={alpha(lineColor, 0.08)} />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <Tooltip
            key={i}
            title={`${p.value.toFixed(2)}% — ${new Date(p.ts).toLocaleString()}`}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={3}
              fill={lineColor}
              stroke="#fff"
              strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
            />
          </Tooltip>
        ))}
      </svg>
    </Paper>
  );
};

// ─── SessionStatusChart ───

export const SessionStatusChart: React.FC<{
  releaseData: any;
  isDark: boolean;
}> = ({ releaseData, isDark }) => {
  const { t } = useTranslation();
  const totalSessions = Number(releaseData.total_sessions) || 1;
  const crashFreeRate = Number(releaseData.crash_free_rate) / 100;
  const crashed =
    Number(releaseData.fatal_count || 0) +
    Number(releaseData.unhandled_count || 0);
  const errored = Number(releaseData.error_count || 0) - crashed;
  const healthy = Math.max(
    0,
    Math.round(totalSessions * crashFreeRate) - Math.max(0, errored)
  );
  const abnormal = Math.max(
    0,
    totalSessions - healthy - Math.max(0, errored) - crashed
  );

  const segments = [
    {
      ...SESSION_STATUSES[0],
      label: t(SESSION_STATUSES[0].labelKey, SESSION_STATUSES[0].fallback),
      value: healthy,
    },
    {
      ...SESSION_STATUSES[1],
      label: t(SESSION_STATUSES[1].labelKey, SESSION_STATUSES[1].fallback),
      value: Math.max(0, errored),
    },
    {
      ...SESSION_STATUSES[2],
      label: t(SESSION_STATUSES[2].labelKey, SESSION_STATUSES[2].fallback),
      value: crashed,
    },
    {
      ...SESSION_STATUSES[3],
      label: t(SESSION_STATUSES[3].labelKey, SESSION_STATUSES[3].fallback),
      value: abnormal,
    },
  ].filter((s) => s.value > 0);

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  // SVG donut
  const cx = 60,
    cy = 60,
    r = 45,
    strokeW = 14;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 2,
        p: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        fontWeight={700}
        sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <DonutIcon sx={{ fontSize: 16, color: '#7c4dff' }} />
        {t('argus.releaseDetail.sessionStatus', 'Session Status')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          {segments.map((seg, i) => {
            const pct = seg.value / total;
            const dashLen = pct * circumference;
            const dashOffset = -cumulative * circumference;
            cumulative += pct;
            return (
              <circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeW}
                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="butt"
              />
            );
          })}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fill={isDark ? '#fff' : '#333'}
            fontSize={14}
            fontWeight={800}
          >
            {formatCompactNumber(totalSessions)}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fill={isDark ? '#888' : '#999'}
            fontSize={9}
          >
            {t('argus.sessions.sessions', 'sessions')}
          </text>
        </svg>
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, flex: 1 }}
        >
          {segments.map((seg) => (
            <Box
              key={seg.key}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: seg.color,
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{ fontSize: '0.72rem', flex: 1 }}
              >
                {seg.label}
              </Typography>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{ fontSize: '0.72rem' }}
              >
                {formatCompactNumber(seg.value)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  color: 'text.disabled',
                  minWidth: 36,
                  textAlign: 'right',
                }}
              >
                {((seg.value / total) * 100).toFixed(1)}%
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
};

// ─── CommitAuthorBreakdown ───

export const CommitAuthorBreakdown: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { t } = useTranslation();
  // Placeholder — backend doesn't expose commit data yet
  // Will be populated when API is available
  const authors: { name: string; email: string; commits: number }[] = [];

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 2,
        p: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        fontWeight={700}
        sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <PersonIcon sx={{ fontSize: 16, color: '#2196f3' }} />
        {t('argus.releaseDetail.commitAuthors', 'Commit Authors')}
      </Typography>
      {authors.length === 0 ? (
        <EmptyPlaceholder
          message={t('argus.releaseDetail.noCommitData', 'No commit data')}
          description={t(
            'argus.releaseDetail.noCommitDataHint',
            'Associate commits to see author breakdown'
          )}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {authors.map((a) => {
            const maxCommits = Math.max(...authors.map((x) => x.commits), 1);
            return (
              <Box
                key={a.email}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Avatar
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: '0.65rem',
                    bgcolor: alpha('#2196f3', 0.2),
                    color: '#2196f3',
                  }}
                >
                  {a.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{ fontSize: '0.72rem' }}
                  >
                    {a.name}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(a.commits / maxCommits) * 100}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      mt: 0.3,
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.05)',
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ fontSize: '0.7rem' }}
                >
                  {a.commits}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

// ─── DeployHistory ───

export const DeployHistory: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { t } = useTranslation();
  // Placeholder — backend doesn't expose deploy data yet
  const deploys: { environment: string; deployed_at: string }[] = [];

  const envColors: Record<string, string> = {
    production: '#f44336',
    staging: '#ff9800',
    development: '#4caf50',
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 2,
        p: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        fontWeight={700}
        sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <DeployIcon sx={{ fontSize: 16, color: '#00bcd4' }} />
        {t('argus.releaseDetail.deploys', 'Deploys')}
      </Typography>
      {deploys.length === 0 ? (
        <EmptyPlaceholder
          message={t('argus.releaseDetail.noDeployData', 'No deploy data')}
          description={t(
            'argus.releaseDetail.noDeployDataHint',
            'Set up deploy notifications to track'
          )}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {deploys.map((d, i) => {
            const color = envColors[d.environment] || '#7c4dff';
            return (
              <Box
                key={i}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <DotIcon sx={{ fontSize: 10, color }} />
                <Chip
                  label={d.environment}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: alpha(color, 0.1),
                    color,
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem', ml: 'auto' }}
                >
                  {formatRelativeTime(d.deployed_at)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};
