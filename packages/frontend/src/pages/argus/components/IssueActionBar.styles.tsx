import { styled, alpha } from '@mui/material/styles';
import { Box, Button, Typography, Chip, Menu } from '@mui/material';

/* ────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────── */
const AI_COLOR = '#7c4dff';

/* ────────────────────────────────────────────
 * Header Section
 * ──────────────────────────────────────────── */

/** Thin colored bar next to the breadcrumbs indicating issue level */
export const LevelIndicator = styled(Box, {
  shouldForwardProp: (p) => p !== 'color',
})<{ color: string }>(({ color }) => ({
  width: 4,
  height: 18,
  borderRadius: 4,
  backgroundColor: color,
  marginLeft: 8,
}));

/** Chip showing the issue level (error, warning, etc.) */
export const LevelChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'levelColor',
})<{ levelColor: string }>(({ levelColor }) => ({
  fontWeight: 700,
  fontSize: '0.65rem',
  height: 18,
  backgroundColor: alpha(levelColor, 0.12),
  color: levelColor,
  border: 'none',
}));

/** Purple-tinted AI Analysis button in the header */
export const AiAnalysisButton = styled(Button)(() => ({
  textTransform: 'none',
  fontWeight: 600,
  borderRadius: 8,
  paddingLeft: 16,
  paddingRight: 16,
  borderColor: alpha(AI_COLOR, 0.5),
  color: AI_COLOR,
  backgroundColor: alpha(AI_COLOR, 0.05),
  '&:hover': {
    borderColor: AI_COLOR,
    backgroundColor: alpha(AI_COLOR, 0.1),
  },
}));

/** Large number for event / user counts */
export const StatNumber = styled(Typography)(() => ({
  lineHeight: 1,
  fontSize: '1.2rem',
  fontWeight: 700,
}));

/** Small caption below stat numbers ("Events", "Users") */
export const StatLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.65rem',
}));

/* ────────────────────────────────────────────
 * Action Bar Section
 * ──────────────────────────────────────────── */

/** Main container row for the action bar chips */
export const ActionBarRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingTop: 8,
  paddingBottom: 8,
  paddingLeft: 12,
  paddingRight: 12,
  marginBottom: 12,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
  borderRadius: 10,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
  backdropFilter: 'blur(8px)',
}));

/** Status text inside the status badge */
export const StatusText = styled('span')(() => ({
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.03em',
}));

/** Small text for sub-status indicators (Regressed, Regression) */
export const SubstatusText = styled('span')(() => ({
  fontSize: '0.62rem',
  fontWeight: 600,
  color: '#ff9800',
}));

/* ────────────────────────────────────────────
 * Menus
 * ──────────────────────────────────────────── */

/** Styled status dropdown menu with dark/light theme support */
export const StatusMenu = styled(Menu, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  '& .MuiPaper-root': {
    minWidth: 150,
    marginTop: 4,
    borderRadius: 8,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    backgroundImage: 'none',
    backgroundColor: isDark ? '#222' : '#fff',
  },
}));

/** Priority dot indicator */
export const PriorityDot = styled(Box, {
  shouldForwardProp: (p) => p !== 'dotColor',
})<{ dotColor: string }>(({ dotColor }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: dotColor,
}));

/* ────────────────────────────────────────────
 * Right-Side Meta Area
 * ──────────────────────────────────────────── */

/** Container for right-side items (presence, fingerprint, actions) */
export const RightSideContainer = styled(Box)(() => ({
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}));

/** Chip for displaying fingerprint / event ID metadata */
export const MetaChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  cursor: 'default',
  height: 22,
  fontSize: '0.68rem',
  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
  border: 'none',
}));
