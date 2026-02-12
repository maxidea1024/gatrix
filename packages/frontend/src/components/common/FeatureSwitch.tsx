import React from 'react';
import { Box, styled, Typography } from '@mui/material';

// Utility to darken a hex color
const darkenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
};

// Utility to lighten a hex color
const lightenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
};

// Get contrast text color for a background
const getContrastText = (hex: string): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a2e' : '#ffffff';
};

interface FeatureSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: (e: React.MouseEvent) => void;
  color?: string;
  label?: string;
}

// ── Pill mode sizes (with label) ──
const PILL = {
  small: { w: 80, h: 22, grip: 16, font: '0.65rem' },
  medium: { w: 96, h: 26, grip: 20, font: '0.72rem' },
  large: { w: 110, h: 30, grip: 24, font: '0.8rem' },
};

// ── Classic mode sizes (no label) ──
const CLASSIC = {
  small: { w: 34, h: 20, thumb: 14 },
  medium: { w: 42, h: 24, thumb: 18 },
  large: { w: 50, h: 28, thumb: 22 },
};

// ═══════════════════════════════════════════
// Pill track – fixed width, rounded, with sliding grip + truncated label
// ═══════════════════════════════════════════
const PillTrack = styled(Box, {
  shouldForwardProp: (p) =>
    !['checked', 'disabled', 'switchSize', 'customColor'].includes(p as string),
})<{
  checked: boolean;
  disabled?: boolean;
  switchSize: 'small' | 'medium' | 'large';
  customColor?: string;
}>(({ theme, checked, disabled, switchSize, customColor }) => {
  const { w, h } = PILL[switchSize];
  const base = customColor || '#43a047';
  const isDark = theme.palette.mode === 'dark';

  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width: w,
    height: h,
    borderRadius: h / 2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.25s ease, box-shadow 0.25s ease',
    userSelect: 'none' as const,
    background: checked
      ? disabled
        ? isDark
          ? darkenColor(base, 35)
          : lightenColor(base, 35)
        : base
      : disabled
        ? isDark
          ? '#2a2a2a'
          : '#e0e0e0'
        : isDark
          ? '#3d3d4d'
          : '#d4d4dc',
    boxShadow: checked
      ? `inset 0 1px 3px ${darkenColor(base, 20)}66`
      : isDark
        ? 'inset 0 1px 3px rgba(0,0,0,0.4)'
        : 'inset 0 1px 3px rgba(0,0,0,0.15)',
    opacity: disabled ? 0.45 : 1,
    '&:hover': disabled
      ? {}
      : {
          filter: 'brightness(1.08)',
        },
    '&:active': disabled
      ? {}
      : {
          transform: 'scale(0.98)',
        },
  };
});

// Sliding grip circle
const PillGrip = styled(Box, {
  shouldForwardProp: (p) => !['checked', 'switchSize'].includes(p as string),
})<{
  checked: boolean;
  switchSize: 'small' | 'medium' | 'large';
}>(({ checked, switchSize }) => {
  const { w, grip } = PILL[switchSize];
  const pad = (PILL[switchSize].h - grip) / 2;

  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: checked ? w - grip - pad : pad,
    width: grip,
    height: grip,
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 0 1px rgba(0,0,0,0.1)',
    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 2,
  };
});

// ═══════════════════════════════════════════
// Classic track – compact, no label
// ═══════════════════════════════════════════
const ClassicTrack = styled(Box, {
  shouldForwardProp: (p) =>
    !['checked', 'disabled', 'switchSize', 'customColor'].includes(p as string),
})<{
  checked: boolean;
  disabled?: boolean;
  switchSize: 'small' | 'medium' | 'large';
  customColor?: string;
}>(({ theme, checked, disabled, switchSize, customColor }) => {
  const { w, h } = CLASSIC[switchSize];
  const base = customColor || '#43a047';
  const isDark = theme.palette.mode === 'dark';

  return {
    position: 'relative',
    width: w,
    height: h,
    borderRadius: h / 2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.25s ease, box-shadow 0.25s ease',
    background: checked
      ? disabled
        ? isDark
          ? darkenColor(base, 35)
          : lightenColor(base, 35)
        : base
      : disabled
        ? isDark
          ? '#2a2a2a'
          : '#e0e0e0'
        : isDark
          ? '#3d3d4d'
          : '#ccc',
    boxShadow: checked
      ? `inset 0 1px 3px ${darkenColor(base, 20)}66`
      : isDark
        ? 'inset 0 1px 3px rgba(0,0,0,0.4)'
        : 'inset 0 1px 3px rgba(0,0,0,0.15)',
    opacity: disabled ? 0.45 : 1,
    '&:hover': disabled
      ? {}
      : {
          filter: 'brightness(1.08)',
        },
    '&:active': disabled
      ? {}
      : {
          transform: 'scale(0.98)',
        },
  };
});

// Classic sliding thumb
const ClassicThumb = styled(Box, {
  shouldForwardProp: (p) => !['checked', 'switchSize'].includes(p as string),
})<{
  checked: boolean;
  switchSize: 'small' | 'medium' | 'large';
}>(({ checked, switchSize }) => {
  const { w, thumb } = CLASSIC[switchSize];
  const pad = (CLASSIC[switchSize].h - thumb) / 2;

  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: checked ? w - thumb - pad : pad,
    width: thumb,
    height: thumb,
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 0 1px rgba(0,0,0,0.1)',
    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  };
});

/**
 * FeatureSwitch – Toggle switch with optional label pill mode.
 *
 * With `label`: fixed-width pill with grip circle + truncated text.
 * Without `label`: compact iOS-style toggle.
 */
const FeatureSwitch: React.FC<FeatureSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'small',
  onClick,
  color,
  label,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    if (!disabled) onChange();
  };

  const a11y = {
    role: 'switch' as const,
    'aria-checked': checked,
    'aria-disabled': disabled,
    'aria-label': label,
    tabIndex: disabled ? -1 : 0,
    onClick: handleClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        onChange();
      }
    },
  };

  // ── Pill mode ──
  if (label) {
    const base = color || '#43a047';
    const textColor = checked ? getContrastText(base) : undefined;
    const { grip, font } = PILL[size];

    return (
      <PillTrack
        checked={checked}
        disabled={disabled}
        switchSize={size}
        customColor={color}
        {...a11y}
      >
        <PillGrip checked={checked} switchSize={size} />

        <Typography
          component="span"
          sx={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            // Precisely constrain text to the area NOT occupied by the grip
            // grip pad = (h - grip) / 2; gap between grip and text = 4px
            left: checked ? (PILL[size].h - grip) / 2 : grip + (PILL[size].h - grip) / 2 + 4,
            right: checked ? grip + (PILL[size].h - grip) / 2 + 4 : (PILL[size].h - grip) / 2,
            textAlign: 'center',
            fontSize: font,
            fontWeight: 600,
            lineHeight: 1,
            color: checked
              ? textColor
              : (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </PillTrack>
    );
  }

  // ── Classic mode ──
  return (
    <ClassicTrack
      checked={checked}
      disabled={disabled}
      switchSize={size}
      customColor={color}
      {...a11y}
    >
      <ClassicThumb checked={checked} switchSize={size} />
    </ClassicTrack>
  );
};

export default FeatureSwitch;
