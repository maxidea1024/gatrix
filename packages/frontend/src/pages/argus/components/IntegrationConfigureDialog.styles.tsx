import { styled, alpha } from '@mui/material/styles';
import { Box, Paper, Avatar } from '@mui/material';

// ─── Dialog Header Avatar ───

export const ProviderAvatar = styled(Avatar, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  width: 36,
  height: 36,
  backgroundColor: alpha('#667eea', isDark ? 0.2 : 0.08),
  color: '#667eea',
}));

// ─── Repo Card (connected + available) ───

export const RepoCard = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  borderRadius: 10,
}));

// ─── Empty Repos Placeholder ───

export const EmptyReposBox = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: 24,
  textAlign: 'center' as const,
  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
  borderRadius: 8,
}));
