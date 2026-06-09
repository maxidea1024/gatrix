import { styled, alpha } from '@mui/material/styles';
import { Box, Chip } from '@mui/material';

// ─── Panel Header ───

export const PanelHeader = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 8,
  paddingBottom: 8,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
  backgroundColor: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.02)',
  flexShrink: 0,
}));

// ─── Level Chip ───

export const LevelChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'levelColor',
})<{ levelColor: string }>(({ levelColor }) => ({
  height: 22,
  fontSize: '0.65rem',
  fontWeight: 800,
  backgroundColor: alpha(levelColor, 0.15),
  color: levelColor,
  border: `1px solid ${alpha(levelColor, 0.3)}`,
}));

// ─── Metadata Bar ───

export const MetadataBar = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap' as const,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 6.4,
  paddingBottom: 6.4,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
  backgroundColor: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.01)',
  flexShrink: 0,
}));

// ─── Trace Header Bar ───

export const TraceHeaderBar = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 8,
  paddingBottom: 8,
  flexShrink: 0,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
}));
