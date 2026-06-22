import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/numberFormat';

// ─── formatHourLabel ───

export function formatHourLabel(hourStr: string): string {
  try {
    const d = new Date(hourStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  } catch {
    return hourStr;
  }
}

// ─── ChangeIndicator ───

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
        <TrendingUpIcon sx={{ fontSize: 14, color }} />
      ) : (
        <TrendingDownIcon sx={{ fontSize: 14, color }} />
      )}
      <Typography
        variant="caption"
        sx={{ fontSize: '0.65rem', fontWeight: 700, color }}
      >
        {Math.abs(Math.round(value)).toLocaleString()}%
      </Typography>
    </Box>
  );
};

// ─── DistributionCard ───

export const DistributionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  data: { label: string; value: number }[];
  loading: boolean;
  isDark: boolean;
  color: string;
  onItemClick?: (label: string) => void;
}> = ({ title, icon, data, loading, isDark, color, onItemClick }) => {
  const { t } = useTranslation();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        fontWeight={600}
        sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        {icon}
        {title}
      </Typography>
      {loading ? (
        <Skeleton variant="rounded" height={120} />
      ) : data.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 2, textAlign: 'center' }}
        >
          {t('argus.overview.noData')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {data.slice(0, 5).map((item, idx) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <Box
                key={`${item.label}-${idx}`}
                onClick={() => onItemClick?.(item.label)}
                sx={{
                  cursor: onItemClick ? 'pointer' : 'default',
                  borderRadius: 1,
                  px: 0.5,
                  py: 0.3,
                  transition: 'background 0.15s',
                  '&:hover': onItemClick
                    ? {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                      }
                    : {},
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 0.2,
                  }}
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
                      fontWeight={700}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {formatCompactNumber(item.value)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.62rem',
                        color: isDark ? '#555' : '#bbb',
                      }}
                    >
                      {pct.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    minWidth: 0,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <Box
                    sx={{
                      minWidth: 0,
                      height: '100%',
                      borderRadius: 2,
                      width: `${pct}%`,
                      backgroundColor: alpha(color, 0.6 + idx * 0.05),
                      transition: 'width 0.4s ease',
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

// ─── MetricBar ───

export const MetricBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
}> = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          {label}
        </Typography>
        <Typography variant="caption" fontWeight={700}>
          {value.toFixed(0)}ms
        </Typography>
      </Box>
      <Box
        sx={{
          minWidth: 0,
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(128,128,128,0.1)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            height: '100%',
            borderRadius: 3,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            transition: 'width 0.5s ease',
          }}
        />
      </Box>
    </Box>
  );
};

// ─── MetricRow ───

export const MetricRow: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      py: 0.3,
    }}
  >
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ fontSize: '0.82rem' }}
    >
      {label}
    </Typography>
    <Typography
      variant="body2"
      fontWeight={600}
      sx={{ fontSize: '0.82rem', ...(highlight && { color: 'error.main' }) }}
    >
      {value}
    </Typography>
  </Box>
);
