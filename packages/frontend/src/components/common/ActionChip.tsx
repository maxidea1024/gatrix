/**
 * ActionChip — Reusable flat action button for toolbars and action bars.
 *
 * Variants:
 *  - "outlined" (default): subtle border, transparent background
 *  - "filled": subtle background fill, no border
 *  - "tinted": colored background tint with matching text color
 *
 * Usage:
 *  <ActionChip label="Resolve" icon={<CheckCircleIcon />} onClick={...} />
 *  <ActionChipSplit
 *    label="Resolve" icon={<CheckCircleIcon />}
 *    onClick={...} onDropdownClick={...}
 *  />
 */
import React from 'react';
import {
  Box,
  Chip,
  Divider,
  useTheme,
  alpha,
  type ChipProps,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

// ==================== ActionChip ====================

export interface ActionChipProps {
  label: React.ReactNode;
  icon?: React.ReactElement;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** @default 'outlined' */
  variant?: 'outlined' | 'filled' | 'tinted';
  /** Tint color — only used with variant="tinted" */
  tintColor?: string;
  /** Height in px @default 28 */
  height?: number;
  disabled?: boolean;
  sx?: ChipProps['sx'];
}

export const ActionChip: React.FC<ActionChipProps> = ({
  label,
  icon,
  onClick,
  variant = 'outlined',
  tintColor,
  height = 28,
  disabled,
  sx,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

  const variantStyles = {
    outlined: {
      border: `1px solid ${borderColor}`,
      backgroundColor: 'transparent',
      color: 'text.primary',
      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
    },
    filled: {
      border: 'none',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      color: 'text.primary',
      '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' },
    },
    tinted: {
      border: `1px solid ${tintColor ? alpha(tintColor, 0.3) : borderColor}`,
      backgroundColor: tintColor ? alpha(tintColor, 0.12) : 'transparent',
      color: tintColor || 'text.primary',
      '&:hover': { backgroundColor: tintColor ? alpha(tintColor, 0.18) : undefined },
    },
  };

  return (
    <Chip
      label={label}
      icon={icon}
      size="small"
      disabled={disabled}
      onClick={onClick}
      sx={{
        height,
        borderRadius: '6px',
        fontWeight: 600,
        fontSize: '0.75rem',
        '& .MuiChip-icon': { color: 'inherit', ml: 0.8 },
        '& .MuiChip-label': { px: 0.8 },
        ...variantStyles[variant],
        ...sx,
      }}
    />
  );
};

// ==================== ActionChipSplit ====================

export interface ActionChipSplitProps {
  label: React.ReactNode;
  icon?: React.ReactElement;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onDropdownClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Height in px @default 28 */
  height?: number;
  disabled?: boolean;
  sx?: ChipProps['sx'];
}

/**
 * A split-button style chip: main action on the left, dropdown arrow on the right,
 * with a single shared border container.
 */
export const ActionChipSplit: React.FC<ActionChipSplitProps> = ({
  label,
  icon,
  onClick,
  onDropdownClick,
  height = 28,
  disabled,
  sx,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', height,
      border: `1px solid ${borderColor}`,
      borderRadius: '6px', overflow: 'hidden',
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      ...sx,
    }}>
      <Chip
        icon={icon}
        label={label}
        size="small"
        onClick={onClick}
        sx={{
          height: '100%', borderRadius: 0, border: 'none',
          backgroundColor: 'transparent',
          color: 'text.primary', fontWeight: 600, fontSize: '0.75rem',
          '& .MuiChip-icon': { color: 'inherit', ml: 0.8 },
          '& .MuiChip-label': { px: 0.8 },
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        }}
      />
      <Divider orientation="vertical" flexItem />
      <Chip
        icon={<ExpandMoreIcon sx={{ fontSize: '16px !important' }} />}
        size="small"
        onClick={onDropdownClick}
        sx={{
          height: '100%', borderRadius: 0, border: 'none', minWidth: 28,
          backgroundColor: 'transparent',
          color: 'text.secondary',
          '& .MuiChip-icon': { color: 'inherit', ml: 0.5, mr: -0.5 },
          '& .MuiChip-label': { display: 'none' },
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        }}
      />
    </Box>
  );
};

export default ActionChip;
