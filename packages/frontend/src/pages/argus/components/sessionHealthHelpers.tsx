import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// ─── Constants ───

export const SESSION_STATUS_DEFS: Record<string, string> = {
  healthy: 'argus.sessions.healthyDef',
  crashed: 'argus.sessions.crashedDef',
  errored: 'argus.sessions.erroredDef',
  abnormal: 'argus.sessions.abnormalDef',
};

export const RELEASE_COLORS = [
  '#7c4dff',
  '#448aff',
  '#00bcd4',
  '#26a69a',
  '#66bb6a',
  '#ffa726',
  '#ef5350',
  '#ab47bc',
];

// ─── Helpers ───

export function formatHour(h: string): string {
  try {
    const d = new Date(h);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  } catch {
    return h;
  }
}

export const calcChange = (
  current: number | undefined,
  previous: number | undefined
): number | null => {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

// ─── Sub-components ───

export const ChangeIndicator: React.FC<{ value: number; invert?: boolean }> = ({
  value,
  invert,
}) => {
  const isUp = value > 0;
  const isGood = invert ? !isUp : isUp;
  const color = isGood ? '#4caf50' : '#f44336';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
      {isUp ? (
        <TrendingUpIcon sx={{ fontSize: 13, color }} />
      ) : (
        <TrendingDownIcon sx={{ fontSize: 13, color }} />
      )}
      <Typography
        variant="caption"
        sx={{ fontSize: '0.6rem', fontWeight: 700, color }}
      >
        {Math.abs(value).toFixed(0)}%
      </Typography>
    </Box>
  );
};

export const CrashDistribution: React.FC<{
  data: { label: string; total: number; crashed: number; rate: number }[];
  isDark: boolean;
  onClick?: (label: string) => void;
}> = ({ data, isDark, onClick }) => {
  const { t } = useTranslation();
  if (data.length === 0)
    return (
      <EmptyPlaceholder message={t('argus.sessions.noData')} minHeight={100} />
    );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
      {data.slice(0, 5).map((item, idx) => (
        <Box
          key={`${item.label}-${idx}`}
          onClick={() => onClick?.(item.label)}
          sx={{
            p: 0.8,
            px: 1,
            borderRadius: 1.5,
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all 0.15s',
            '&:hover': onClick
              ? {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                  transform: 'scale(1.02) translateX(2px)',
                }
              : {},
          }}
        >
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: '0.72rem', fontWeight: 500 }}
            >
              {item.label}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
              <Typography
                variant="caption"
                sx={{ fontSize: '0.65rem', color: isDark ? '#777' : '#999' }}
              >
                {item.crashed}/{item.total}
              </Typography>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  fontSize: '0.7rem',
                  color:
                    item.rate > 5
                      ? '#f44336'
                      : item.rate > 1
                        ? '#ff9800'
                        : '#4caf50',
                }}
              >
                {item.rate.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            }}
          >
            <Box
              sx={{
                height: '100%',
                borderRadius: 2,
                width: `${Math.min(item.rate * 5, 100)}%`,
                backgroundColor:
                  item.rate > 5
                    ? alpha('#f44336', 0.7)
                    : item.rate > 1
                      ? alpha('#ff9800', 0.6)
                      : alpha('#4caf50', 0.5),
                transition: 'width 0.4s',
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};
