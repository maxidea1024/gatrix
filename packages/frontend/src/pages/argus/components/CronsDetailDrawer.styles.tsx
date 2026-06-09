import { styled, alpha } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

// ─── Drawer Header ───

export const DrawerHeader = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 16,
  paddingBottom: 16,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

// ─── Summary Strip ───

export const SummaryStrip = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 12,
  paddingBottom: 12,
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap' as const,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
}));

// ─── Code Block ───

export const CodeBlockContainer = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  position: 'relative',
  padding: 12,
  borderRadius: 6,
  backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : '#1e1e2e',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)'}`,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: '0.68rem',
  lineHeight: 1.7,
  color: '#e0e0e0',
  overflowX: 'auto' as const,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-all' as const,
}));

export const CopyButton = styled(Box)({
  position: 'absolute',
  top: 4,
  right: 4,
  color: 'rgba(255,255,255,0.4)',
  '&:hover': { color: 'rgba(255,255,255,0.8)' },
});

// ─── Section Label (uppercase) ───

export const SectionLabel = styled(Typography)({
  fontSize: '0.72rem',
  fontWeight: 600,
  marginBottom: 4,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
});

// ─── Empty Placeholder ───

export const EmptyCheckinBox = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingTop: 48,
  paddingBottom: 48,
  textAlign: 'center' as const,
  color: 'text.disabled',
  border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
  borderRadius: 8,
}));

// ─── Status Values Box ───

export const StatusValuesBox = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: 12,
  borderRadius: 6,
  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  fontSize: '0.72rem',
  lineHeight: 1.8,
}));
