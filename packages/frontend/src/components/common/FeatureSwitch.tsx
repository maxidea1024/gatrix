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
            small: { width: 32, height: 18, thumbSize: 14 },
            medium: { width: 40, height: 22, thumbSize: 18 },
            large: { width: 48, height: 26, thumbSize: 22 },
        };
        const { width, height } = sizes[switchSize];

        return {
            position: 'relative',
            width,
            height,
            borderRadius: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            background: checked
                ? disabled
                    ? theme.palette.mode === 'dark' ? '#3d6b3d' : '#a5d6a7'
                    : theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)'
                        : 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)'
                : disabled
                    ? theme.palette.mode === 'dark' ? '#444' : '#e0e0e0'
                    : theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #555 0%, #333 100%)'
                        : 'linear-gradient(135deg, #bdbdbd 0%, #9e9e9e 100%)',
            boxShadow: checked
                ? 'inset 0 1px 2px rgba(0,0,0,0.1), 0 1px 3px rgba(76, 175, 80, 0.3)'
                : 'inset 0 1px 3px rgba(0,0,0,0.2)',
            border: checked
                ? '1px solid rgba(46, 125, 50, 0.3)'
                : '1px solid rgba(0,0,0,0.1)',
            opacity: disabled ? 0.6 : 1,
            '&:hover': disabled ? {} : {
                boxShadow: checked
                    ? 'inset 0 1px 2px rgba(0,0,0,0.1), 0 2px 6px rgba(76, 175, 80, 0.4)'
                    : '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 3px rgba(0,0,0,0.2)',
            },
            '&:active': disabled ? {} : {
                transform: 'scale(0.97)',
            },
        };
    }
);

const SwitchThumb = styled(Box, {
    shouldForwardProp: (prop) => !['checked', 'switchSize'].includes(prop as string),
})<{ checked: boolean; switchSize: 'small' | 'medium' | 'large' }>(
    ({ checked, switchSize }) => {
        const sizes = {
            small: { width: 32, height: 18, thumbSize: 14 },
            medium: { width: 40, height: 22, thumbSize: 18 },
            large: { width: 48, height: 26, thumbSize: 22 },
        };
        const { width, thumbSize } = sizes[switchSize];
        const padding = 2;

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
                color: checked ? '#2e7d32' : '#9e9e9e',
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
 * - Green gradient when enabled, gray when disabled
 * - Checkmark indicator when enabled
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
