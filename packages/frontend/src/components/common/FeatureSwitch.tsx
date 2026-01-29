import React from 'react';
import { Box, styled } from '@mui/material';

// Utility to darken a hex color
const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
};

// Utility to lighten a hex color
const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
};

interface FeatureSwitchProps {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    size?: 'small' | 'medium' | 'large';
    onClick?: (e: React.MouseEvent) => void;
    color?: string; // Custom color for the switch when checked
}

const SwitchContainer = styled(Box, {
    shouldForwardProp: (prop) => !['checked', 'disabled', 'switchSize', 'customColor'].includes(prop as string),
})<{ checked: boolean; disabled?: boolean; switchSize: 'small' | 'medium' | 'large'; customColor?: string }>(
    ({ theme, checked, disabled, switchSize, customColor }) => {
        const sizes = {
            small: { width: 32, height: 18, thumbSize: 14 },
            medium: { width: 40, height: 22, thumbSize: 18 },
            large: { width: 48, height: 26, thumbSize: 22 },
        };
        const { width, height } = sizes[switchSize];

        // Use custom color or default green
        const baseColor = customColor || '#43a047';
        const darkColor = darkenColor(baseColor, 20);
        const lightColor = lightenColor(baseColor, 10);

        return {
            position: 'relative',
            width,
            height,
            borderRadius: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            background: checked
                ? disabled
                    ? theme.palette.mode === 'dark' ? darkenColor(baseColor, 30) : lightenColor(baseColor, 30)
                    : theme.palette.mode === 'dark'
                        ? `linear-gradient(135deg, ${baseColor} 0%, ${darkColor} 100%)`
                        : `linear-gradient(135deg, ${lightColor} 0%, ${baseColor} 100%)`
                : disabled
                    ? theme.palette.mode === 'dark' ? '#444' : '#e0e0e0'
                    : theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #555 0%, #333 100%)'
                        : 'linear-gradient(135deg, #bdbdbd 0%, #9e9e9e 100%)',
            boxShadow: checked
                ? `inset 0 1px 2px rgba(0,0,0,0.1), 0 1px 3px ${baseColor}4D`
                : 'inset 0 1px 3px rgba(0,0,0,0.2)',
            border: checked
                ? `1px solid ${darkColor}4D`
                : '1px solid rgba(0,0,0,0.1)',
            opacity: disabled ? 0.6 : 1,
            '&:hover': disabled ? {} : {
                boxShadow: checked
                    ? `inset 0 1px 2px rgba(0,0,0,0.1), 0 2px 6px ${baseColor}66`
                    : '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 3px rgba(0,0,0,0.2)',
            },
            '&:active': disabled ? {} : {
                transform: 'scale(0.97)',
            },
        };
    }
);

const SwitchThumb = styled(Box, {
    shouldForwardProp: (prop) => !['checked', 'switchSize', 'customColor'].includes(prop as string),
})<{ checked: boolean; switchSize: 'small' | 'medium' | 'large'; customColor?: string }>(
    ({ checked, switchSize, customColor }) => {
        const sizes = {
            small: { width: 32, height: 18, thumbSize: 14 },
            medium: { width: 40, height: 22, thumbSize: 18 },
            large: { width: 48, height: 26, thumbSize: 22 },
        };
        const { width, thumbSize } = sizes[switchSize];
        const padding = 2;

        // Use custom color or default green for checkmark
        const checkColor = customColor ? darkenColor(customColor, 20) : '#2e7d32';

        return {
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: checked ? width - thumbSize - padding - 2 : padding,
            width: thumbSize,
            height: thumbSize,
            borderRadius: 0,
            background: checked
                ? 'linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%)'
                : 'linear-gradient(180deg, #ffffff 0%, #e8e8e8 100%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&::after': {
                content: checked ? '"✓"' : '""',
                fontSize: switchSize === 'small' ? 9 : switchSize === 'medium' ? 11 : 13,
                color: checked ? checkColor : '#9e9e9e',
                fontWeight: 'bold',
            },
        };
    }
);

/**
 * FeatureSwitch - A modern rectangular toggle switch for feature flags
 * 
 * Features:
 * - Clean rectangular design that matches modern UI
 * - Clear visual distinction between ON/OFF states
 * - Smooth animations
 * - Custom color support for environment-specific styling
 * - Checkmark indicator when enabled
 * - Three sizes: small, medium, large
 */
const FeatureSwitch: React.FC<FeatureSwitchProps> = ({
    checked,
    onChange,
    disabled = false,
    size = 'small',
    onClick,
    color,
}) => {
    const handleClick = (e: React.MouseEvent) => {
        if (onClick) onClick(e);
        if (!disabled) {
            onChange();
        }
    };

    return (
        <SwitchContainer
            checked={checked}
            disabled={disabled}
            switchSize={size}
            customColor={color}
            onClick={handleClick}
            role="switch"
            aria-checked={checked}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e: React.KeyboardEvent) => {
                if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                    e.preventDefault();
                    onChange();
                }
            }}
        >
            <SwitchThumb checked={checked} switchSize={size} customColor={color} />
        </SwitchContainer>
    );
};

export default FeatureSwitch;

