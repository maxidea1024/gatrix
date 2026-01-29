import React from 'react';
import { Box, styled } from '@mui/material';

interface FeatureSwitchProps {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    size?: 'small' | 'medium' | 'large';
    onClick?: (e: React.MouseEvent) => void;
}

const SwitchContainer = styled(Box, {
    shouldForwardProp: (prop) => !['checked', 'disabled', 'switchSize'].includes(prop as string),
})<{ checked: boolean; disabled?: boolean; switchSize: 'small' | 'medium' | 'large' }>(
    ({ theme, checked, disabled, switchSize }) => {
        const sizes = {
            small: { width: 36, height: 20, thumbSize: 16 },
            medium: { width: 44, height: 24, thumbSize: 20 },
            large: { width: 52, height: 28, thumbSize: 24 },
        };
        const { width, height, thumbSize } = sizes[switchSize];
        const padding = (height - thumbSize) / 2;

        return {
            position: 'relative',
            width,
            height,
            borderRadius: height / 2,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: checked
                ? disabled
                    ? theme.palette.mode === 'dark' ? '#3d6b3d' : '#a5d6a7'
                    : 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
                : disabled
                    ? theme.palette.mode === 'dark' ? '#444' : '#e0e0e0'
                    : theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #616161 0%, #424242 100%)'
                        : 'linear-gradient(135deg, #bdbdbd 0%, #9e9e9e 100%)',
            boxShadow: checked
                ? '0 2px 8px rgba(76, 175, 80, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)'
                : 'inset 0 1px 3px rgba(0,0,0,0.2)',
            opacity: disabled ? 0.6 : 1,
            '&:hover': disabled ? {} : {
                transform: 'scale(1.05)',
                boxShadow: checked
                    ? '0 4px 12px rgba(76, 175, 80, 0.5), inset 0 1px 2px rgba(255,255,255,0.2)'
                    : '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 3px rgba(0,0,0,0.2)',
            },
            '&:active': disabled ? {} : {
                transform: 'scale(0.98)',
            },
        };
    }
);

const SwitchThumb = styled(Box, {
    shouldForwardProp: (prop) => !['checked', 'switchSize'].includes(prop as string),
})<{ checked: boolean; switchSize: 'small' | 'medium' | 'large' }>(
    ({ theme, checked, switchSize }) => {
        const sizes = {
            small: { width: 36, height: 20, thumbSize: 16 },
            medium: { width: 44, height: 24, thumbSize: 20 },
            large: { width: 52, height: 28, thumbSize: 24 },
        };
        const { width, height, thumbSize } = sizes[switchSize];
        const padding = (height - thumbSize) / 2;

        return {
            position: 'absolute',
            top: padding,
            left: checked ? width - thumbSize - padding : padding,
            width: thumbSize,
            height: thumbSize,
            borderRadius: '50%',
            background: checked
                ? 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)'
                : 'linear-gradient(180deg, #ffffff 0%, #e0e0e0 100%)',
            boxShadow: checked
                ? '0 2px 6px rgba(0,0,0,0.3), 0 0 0 1px rgba(76,175,80,0.2)'
                : '0 2px 4px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&::after': {
                content: checked ? '"✓"' : '""',
                fontSize: switchSize === 'small' ? 10 : switchSize === 'medium' ? 12 : 14,
                color: checked ? '#2e7d32' : '#9e9e9e',
                fontWeight: 'bold',
            },
        };
    }
);

const StatusIndicator = styled(Box, {
    shouldForwardProp: (prop) => !['checked', 'switchSize'].includes(prop as string),
})<{ checked: boolean; switchSize: 'small' | 'medium' | 'large' }>(
    ({ checked, switchSize }) => {
        const iconSize = switchSize === 'small' ? 8 : switchSize === 'medium' ? 10 : 12;
        const position = switchSize === 'small' ? 6 : switchSize === 'medium' ? 7 : 8;

        return {
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: checked ? position : 'auto',
            right: checked ? 'auto' : position,
            width: iconSize,
            height: iconSize,
            borderRadius: '50%',
            background: checked
                ? 'rgba(255,255,255,0.9)'
                : 'rgba(255,255,255,0.4)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: iconSize - 2,
            color: checked ? '#2e7d32' : '#757575',
            fontWeight: 'bold',
        };
    }
);

/**
 * FeatureSwitch - A beautifully designed toggle switch for feature flags
 * 
 * Features:
 * - Clear visual distinction between ON/OFF states
 * - Smooth animations
 * - Green gradient when enabled, gray when disabled
 * - Checkmark indicator when enabled
 * - Hover and active states
 * - Three sizes: small, medium, large
 */
const FeatureSwitch: React.FC<FeatureSwitchProps> = ({
    checked,
    onChange,
    disabled = false,
    size = 'small',
    onClick,
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
            <SwitchThumb checked={checked} switchSize={size} />
        </SwitchContainer>
    );
};

export default FeatureSwitch;
