import { styled, alpha } from '@mui/material/styles';
import { Box, Paper, Card } from '@mui/material';

/** Full-width page container */
export const PageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  padding: '0 0 24px',
});

/** Feature card on the analytics landing page */
export const FeatureCard = styled(Card, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'accentColor',
})<{ isDark: boolean; accentColor: string }>(({ isDark, accentColor }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '24px 28px',
  borderRadius: 14,
  cursor: 'pointer',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: alpha(accentColor, 0.4),
    background: alpha(accentColor, isDark ? 0.06 : 0.03),
    transform: 'translateY(-2px)',
    boxShadow: `0 4px 20px ${alpha(accentColor, 0.15)}`,
  },
}));

/** Icon circle on feature cards */
export const FeatureIconBox = styled(Box, {
  shouldForwardProp: (p) => p !== 'color',
})<{ color: string }>(({ color }) => ({
  width: 44,
  height: 44,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: alpha(color, 0.12),
  color,
  flexShrink: 0,
}));

/** Section header row */
export const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
});

/** Stats card on the landing page */
export const StatCard = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: '16px 20px',
  borderRadius: 12,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}));
