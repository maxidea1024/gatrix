import { styled, alpha } from '@mui/material/styles';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  DialogTitle,
  DialogActions,
} from '@mui/material';

// ─── Step Badge (floating label above card) ───

export const StepBadge = styled(Box)<{ badgeColor: string }>(
  ({ badgeColor }) => ({
    position: 'absolute',
    top: -10,
    left: 16,
    zIndex: 1,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 1.6,
    paddingBottom: 1.6,
    borderRadius: 4,
    background: `linear-gradient(135deg, ${badgeColor}, ${alpha(badgeColor, 0.7)})`,
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
  })
);

export const StepPaper = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'accentColor',
})<{ isDark: boolean; accentColor: string }>(({ isDark, accentColor }) => ({
  padding: 16,
  paddingTop: 20,
  borderRadius: 8,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  borderLeft: `3px solid ${accentColor}`,
}));

export const StepLabel = styled(Typography)({
  color: 'text.disabled',
  fontSize: '0.68rem',
  marginBottom: 12,
  display: 'block',
});

// ─── Connector ───

export const ConnectorLine = styled(Box)({
  width: 2,
  height: 16,
  backgroundColor: 'divider',
  borderRadius: 4,
});

// ─── Card Row (Condition/Action) ───

export const CardRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: 12,
  borderRadius: 6,
  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
  position: 'relative' as const,
}));

export const DragHandle = styled(Box)({
  cursor: 'grab',
  marginTop: 8,
  color: 'text.disabled',
  '&:hover': { color: 'text.primary' },
});

export const CardIconBox = styled(Box)<{ accentColor: string }>(
  ({ accentColor }) => ({
    width: 36,
    height: 36,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(accentColor, 0.1),
    color: accentColor,
  })
);

// ─── Dialog ───

export const EditorDialogTitle = styled(DialogTitle, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  fontWeight: 700,
  fontSize: '1rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  paddingBottom: 12,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

export const EditorDialogActions = styled(DialogActions, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 24,
  paddingRight: 24,
  paddingBottom: 16,
  paddingTop: 8,
  borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

// ─── Logic Toggle ───

export const LogicToggleGroup = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  borderRadius: 4,
  overflow: 'hidden',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
}));

export const LogicToggleButton = styled(Button, {
  shouldForwardProp: (p) => p !== 'isActive',
})<{ isActive: boolean }>(({ isActive }) => ({
  textTransform: 'none',
  fontSize: '0.68rem',
  fontWeight: 700,
  paddingLeft: 12,
  paddingRight: 12,
  paddingTop: 1.6,
  paddingBottom: 1.6,
  minWidth: 0,
  borderRadius: 0,
  ...(isActive
    ? {
        backgroundColor: alpha('#f44336', 0.9),
        color: '#fff',
        '&:hover': {
          backgroundColor: alpha('#f44336', 0.8),
        },
      }
    : {}),
}));

// ─── Add Button ───

export const AddItemButton = styled(Button)({
  textTransform: 'none',
  fontSize: '0.75rem',
  alignSelf: 'flex-start',
  marginTop: 4,
});

// ─── Tag Chip ───

export const TagFilterChip = styled(Chip)({
  height: 22,
  fontSize: '0.68rem',
  backgroundColor: alpha('#00bcd4', 0.08),
  color: '#00bcd4',
  border: 'none',
  '& .MuiChip-deleteIcon': {
    fontSize: 14,
    color: alpha('#00bcd4', 0.5),
    '&:hover': { color: '#00bcd4' },
  },
});
