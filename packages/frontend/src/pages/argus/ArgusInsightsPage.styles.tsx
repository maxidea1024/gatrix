import { styled, alpha } from '@mui/material/styles';
import { Box, Paper, Chip, Select } from '@mui/material';

/** Query builder row */
export const QueryRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 10,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
  flexWrap: 'wrap',
}));

/** Event tag chip */
export const EventChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'accentColor',
})<{ accentColor?: string }>(({ accentColor }) => ({
  fontWeight: 600,
  fontSize: '0.75rem',
  height: 28,
  ...(accentColor && {
    backgroundColor: alpha(accentColor, 0.12),
    color: accentColor,
    '& .MuiChip-deleteIcon': {
      color: alpha(accentColor, 0.5),
      '&:hover': {
        color: accentColor,
      },
    },
  }),
}));

/** Toolbar row for actions and date selector */
export const ToolbarRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
});

/** Chart container */
export const ChartContainer = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: '16px 20px',
  borderRadius: 12,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
  minHeight: 300,
}));
