import { styled, alpha } from '@mui/material/styles';
import { Box, IconButton } from '@mui/material';

// ─── Preview Container ───────────────────────────────────────────────────────

export const PreviewContainer = styled('pre', {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  position: 'relative',
  fontSize: '0.82rem',
  lineHeight: 1.7,
  padding: '12px',
  paddingRight: 32,
  margin: 0,
  flex: 1,
  minHeight: 80,
  overflowY: 'auto',
  backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
  borderRadius: 4,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  overflowX: 'auto',
  '&:hover .copy-btn': { opacity: 1 },
}));

export const EmptyPreview = styled('pre', {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  fontSize: '0.72rem',
  padding: '12px',
  margin: 0,
  flex: 1,
  minHeight: 80,
  backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
  borderRadius: 4,
  border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
  color: 'inherit',
  fontStyle: 'italic',
  opacity: 0.5,
}));

// ─── Copy Button ─────────────────────────────────────────────────────────────

export const CopyButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  position: 'absolute',
  top: 4,
  right: 4,
  padding: 3,
  opacity: 0,
  transition: 'opacity 0.15s',
  color: 'inherit',
  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  '&:hover': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
  },
}));
