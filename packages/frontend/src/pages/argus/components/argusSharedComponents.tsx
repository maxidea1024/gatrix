/**
 * Argus Shared UI Primitives
 *
 * Reusable, opinionated building blocks for all Argus analytics pages.
 * These replace the ad-hoc inline-styled patterns that were previously
 * copy-pasted across Overview, Revenue, Session Health, etc.
 *
 * Import from '@/pages/argus/components/argusSharedComponents'.
 */

import React from 'react';
import {
  Box,
  Typography,
  alpha,
  useTheme,
  type SxProps,
  type Theme,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowDropUp,
  ArrowDropDown,
  ChevronRight as DrilldownArrowIcon,
} from '@mui/icons-material';

import {
  ARGUS_SEMANTIC,
  SECTION_LABEL_SX,
  METRIC_VALUE_SX,
  METRIC_LABEL_SX,
  changeColor,
  argusBorder,
  argusHoverBg,
} from '../argusThemeTokens';

// ─────────────────────────────────────────────────────────────────────────────
// ChangeIndicator
// ─────────────────────────────────────────────────────────────────────────────
// Shows a +/- percentage change with an up/down icon.
// Replaces: overviewHelpers.ChangeIndicator, inline Chip patterns in Revenue, etc.

export interface ChangeIndicatorProps {
  /** Percentage change value (e.g. 12.5 means +12.5%). */
  value: number | null | undefined;
  /**
   * If true, a *decrease* is considered good (e.g. error count).
   * The colour will flip accordingly.
   */
  invert?: boolean;
  /**
   * Display format:
   *   - `'compact'` (default): icon + value, small inline chip style
   *   - `'chip'`: chip-like badge with background, used in KPI rows
   */
  variant?: 'compact' | 'chip';
  /** Suffix after the number. Default `'%'`. Use `'%p'` for percentage points. */
  suffix?: string;
}

export const ChangeIndicator: React.FC<ChangeIndicatorProps> = ({
  value,
  invert = false,
  variant = 'compact',
  suffix = '%',
}) => {
  if (value == null || !isFinite(value) || Math.abs(value) < 0.1) return null;

  const color = changeColor(value, invert);
  const isUp = value > 0;
  const label = `${isUp ? '+' : ''}${Math.abs(value).toFixed(1)}${suffix}`;

  if (variant === 'chip') {
    return (
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.15,
          px: 0.6,
          py: 0.15,
          borderRadius: '4px',
          bgcolor: alpha(color, 0.1),
          color,
          fontSize: '0.6875rem',
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {isUp ? (
          <ArrowDropUp sx={{ fontSize: 16, ml: -0.3 }} />
        ) : (
          <ArrowDropDown sx={{ fontSize: 16, ml: -0.3 }} />
        )}
        {label}
      </Box>
    );
  }

  // compact (default)
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.15,
      }}
    >
      {isUp ? (
        <TrendingUpIcon sx={{ fontSize: 14, color }} />
      ) : (
        <TrendingDownIcon sx={{ fontSize: 14, color }} />
      )}
      <Typography
        component="span"
        sx={{ fontSize: '0.65rem', fontWeight: 700, color }}
      >
        {label}
      </Typography>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SectionLabel
// ─────────────────────────────────────────────────────────────────────────────
// Consistent section header.  Replaces emoji + sectionHeaderSx pattern.

export interface SectionLabelProps {
  /** Optional leading icon (Material Icon, 18px). No emoji. */
  icon?: React.ReactNode;
  /** The label text. */
  children: React.ReactNode;
  /** Extra sx overrides. */
  sx?: SxProps<Theme>;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({
  icon,
  children,
  sx,
}) => (
  <Typography
    sx={{
      ...SECTION_LABEL_SX,
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
      mb: 1.5,
      ...sx,
    }}
  >
    {icon && (
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          fontSize: 16,
          opacity: 0.6,
        }}
      >
        {icon}
      </Box>
    )}
    {children}
  </Typography>
);

// ─────────────────────────────────────────────────────────────────────────────
// MetricRow  (flat KPI display — NOT a card)
// ─────────────────────────────────────────────────────────────────────────────
// A single KPI as a horizontal row: label · value · change.
// Multiple <MetricRow>s stack into a flat KPI bar separated by borders.

export interface MetricRowProps {
  /** Display label (e.g. "Revenue", "ARPU"). */
  label: string;
  /** Formatted display value (e.g. "$45.2K"). */
  value: string;
  /** Optional percentage change vs. previous period. */
  change?: number | null;
  /** If true, decrease is considered good. */
  invertChange?: boolean;
  /** Optional sub-text below the value. */
  sub?: string;
  /** Click handler — enables hover + cursor:pointer. */
  onClick?: () => void;
}

export const MetricRow: React.FC<MetricRowProps> = ({
  label,
  value,
  change,
  invertChange,
  sub,
  onClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
        py: 1,
        px: 0.5,
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 1,
        transition: 'background 0.15s',
        '&:hover': onClick ? { backgroundColor: argusHoverBg(isDark) } : {},
      }}
    >
      <Typography sx={{ ...METRIC_LABEL_SX, minWidth: 0, flex: 'none' }}>
        {label}
      </Typography>
      <Typography
        sx={{ ...METRIC_VALUE_SX, fontSize: '1rem', fontWeight: 700 }}
      >
        {value}
      </Typography>
      <ChangeIndicator value={change} invert={invertChange} variant="chip" />
      {sub && (
        <Typography
          sx={{
            fontSize: '0.65rem',
            color: 'text.secondary',
            ml: 0.5,
          }}
        >
          {sub}
        </Typography>
      )}
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MetricStrip
// ─────────────────────────────────────────────────────────────────────────────
// A horizontal bar of KPIs separated by thin dividers (replaces card grid).

export interface MetricStripItem {
  label: string;
  value: string;
  change?: number | null;
  invertChange?: boolean;
  sub?: string;
  onClick?: () => void;
}

export interface MetricStripProps {
  items: MetricStripItem[];
  /** Border below the strip. Default true. */
  bordered?: boolean;
}

export const MetricStrip: React.FC<MetricStripProps> = ({
  items,
  bordered = true,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0,
        borderBottom: bordered ? `1px solid ${argusBorder(isDark)}` : 'none',
      }}
    >
      {items.map((item, idx) => (
        <Box
          key={item.label}
          sx={{
            flex: '1 1 120px',
            minWidth: 100,
            py: 1.5,
            px: 2,
            borderRight:
              idx < items.length - 1
                ? `1px solid ${argusBorder(isDark)}`
                : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            cursor: item.onClick ? 'pointer' : 'default',
            transition: 'background 0.15s',
            '&:hover': item.onClick
              ? { backgroundColor: argusHoverBg(isDark) }
              : {},
          }}
          onClick={item.onClick}
        >
          <Typography sx={METRIC_LABEL_SX}>{item.label}</Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 0.75,
            }}
          >
            <Typography
              sx={{
                fontSize: '1.125rem',
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {item.value}
            </Typography>
            <ChangeIndicator
              value={item.change}
              invert={item.invertChange}
              variant="chip"
            />
          </Box>
          {item.sub && (
            <Typography
              sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.15 }}
            >
              {item.sub}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BreakdownBar
// ─────────────────────────────────────────────────────────────────────────────
// A label + value + percentage bar.  Replaces the repeated LinearProgress
// pattern in Revenue Overview, Payment Method, Refund Analysis, etc.

export interface BreakdownBarProps {
  label: string;
  value: string;
  percentage: number;
  /** Bar fill colour.  Falls back to theme primary. */
  color?: string;
  onClick?: () => void;
}

export const BreakdownBar: React.FC<BreakdownBarProps> = ({
  label,
  value,
  percentage,
  color,
  onClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const barColor = color || theme.palette.primary.main;

  return (
    <Box
      onClick={onClick}
      sx={{
        mb: 0.75,
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 1,
        px: 0.5,
        py: 0.3,
        transition: 'background 0.15s',
        '&:hover': onClick ? { backgroundColor: argusHoverBg(isDark) } : {},
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'baseline' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
            {value}
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
            {percentage.toFixed(0)}%
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        }}
      >
        <Box
          sx={{
            height: '100%',
            borderRadius: 2,
            width: `${Math.min(percentage, 100)}%`,
            bgcolor: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DrilldownLink
// ─────────────────────────────────────────────────────────────────────────────
// A subtle "→ View details" link that navigates or triggers drilldown.

export interface DrilldownLinkProps {
  /** Display text.  Default "View details". */
  label?: string;
  onClick: () => void;
  sx?: SxProps<Theme>;
}

export const DrilldownLink: React.FC<DrilldownLinkProps> = ({
  label = 'View details',
  onClick,
  sx,
}) => (
  <Typography
    component="span"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.25,
      fontSize: '0.6875rem',
      fontWeight: 600,
      color: 'primary.main',
      cursor: 'pointer',
      '&:hover': { textDecoration: 'underline' },
      ...sx,
    }}
  >
    {label}
    <DrilldownArrowIcon sx={{ fontSize: 14 }} />
  </Typography>
);
