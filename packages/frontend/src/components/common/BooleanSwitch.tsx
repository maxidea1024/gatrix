import React from 'react';
import { Switch, SwitchProps } from '@mui/material';
import { styled } from '@mui/material/styles';

/**
 * BooleanSwitch - A toggle switch with True/False labels inside the track.
 *
 * Usage:
 *   <BooleanSwitch checked={value} onChange={(e) => setValue(e.target.checked)} />
 */
const BooleanSwitch = styled((props: SwitchProps) => (
    <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(({ theme }) => ({
    width: 62,
    height: 26,
    padding: 0,
    '& .MuiSwitch-switchBase': {
        padding: 0,
        margin: 2,
        transitionDuration: '200ms',
        '&.Mui-checked': {
            transform: 'translateX(36px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
                backgroundColor: theme.palette.primary.main,
                opacity: 1,
                border: 0,
                '&::before': {
                    opacity: 1,
                },
                '&::after': {
                    opacity: 0,
                },
            },
        },
    },
    '& .MuiSwitch-thumb': {
        boxSizing: 'border-box',
        width: 22,
        height: 22,
    },
    '& .MuiSwitch-track': {
        borderRadius: 13,
        backgroundColor: theme.palette.mode === 'dark' ? '#bdbdbd' : '#bdbdbd',
        opacity: 1,
        position: 'relative',
        '&::before, &::after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: theme.typography.fontFamily,
            transition: 'opacity 200ms',
        },
        '&::before': {
            content: '"True"',
            left: 6,
            color: '#fff',
            opacity: 0,
        },
        '&::after': {
            content: '"False"',
            right: 4,
            color: '#fff',
            opacity: 1,
        },
    },
}));

export default BooleanSwitch;
