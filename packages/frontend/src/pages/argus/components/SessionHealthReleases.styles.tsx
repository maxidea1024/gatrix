import { styled, alpha } from '@mui/material/styles';
import { Box, Paper, Chip } from '@mui/material';

// ─── Section Paper ───

export const SectionPaper = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: 20,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  borderRadius: 8,
}));

// ─── Section Accent ───

export const SectionAccent = styled(Box)<{ gradient: string }>(
  ({ gradient }) => ({
    width: 3,
    height: 16,
    borderRadius: 4,
    background: gradient,
    marginRight: 4,
  })
);

// ─── Stacked Bar Container ───

export const StackedBarContainer = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  height: 28,
  borderRadius: 8,
  overflow: 'hidden',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

// ─── Legend Item ───

export const LegendItem = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 3.2,
  paddingLeft: 6.4,
  paddingRight: 6.4,
  paddingTop: 2.4,
  paddingBottom: 2.4,
  borderRadius: 4,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
}));

// ─── Legend Color Dot ───

export const LegendDot = styled(Box)<{ dotColor: string }>(({ dotColor }) => ({
  width: 8,
  height: 8,
  borderRadius: '2px',
  backgroundColor: dotColor,
  flexShrink: 0,
}));

// ─── Release Row ───

export const ReleaseRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'isLast',
})<{ isDark: boolean; isLast: boolean }>(({ isDark, isLast }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 8,
  paddingBottom: 8,
  borderBottom: isLast
    ? 'none'
    : `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
  cursor: 'pointer',
  transition: 'all 0.15s',
  '&:hover': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    transform: 'translateX(4px)',
    boxShadow: '-2px 0 0 0 #7c4dff',
  },
}));

// ─── Release Chip ───

export const ReleaseChip = styled(Chip)({
  fontWeight: 600,
  fontSize: '0.7rem',
  minWidth: 100,
  backgroundColor: alpha('#7c4dff', 0.1),
  color: '#7c4dff',
  border: 'none',
  cursor: 'pointer',
});

// ─── Progress Track ───

export const ProgressTrack = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  height: 5,
  borderRadius: 12,
  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
}));

// ─── Table Section Header ───

export const TableSectionHeader = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 12,
  paddingBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
}));
