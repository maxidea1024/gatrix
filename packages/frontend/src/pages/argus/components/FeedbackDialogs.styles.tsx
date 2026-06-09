import { styled, alpha } from '@mui/material/styles';
import { Box, Chip } from '@mui/material';

/** Spam keyword row in spam filter dialog */
export const SpamKeywordRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingLeft: 12,
  paddingRight: 12,
  paddingTop: 6.4,
  paddingBottom: 6.4,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
  '&:hover': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
  },
}));

/** Regex badge chip in spam filter */
export const RegexChip = styled(Chip)({
  height: 18,
  fontSize: '0.58rem',
  fontWeight: 700,
  backgroundColor: alpha('#ff9800', 0.1),
  color: '#ff9800',
  border: 'none',
});

/** Issue search result row in link-issue dialog */
export const IssueResultRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 12,
  paddingRight: 12,
  paddingTop: 8,
  paddingBottom: 8,
  cursor: 'pointer',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  '&:hover': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  },
}));

/** Issue status chip (compact) in link-issue results */
export const IssueStatusChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'statusColor',
})<{ statusColor: string }>(({ statusColor }) => ({
  height: 18,
  fontSize: '0.55rem',
  fontWeight: 700,
  backgroundColor: alpha(statusColor, 0.12),
  color: statusColor,
  border: 'none',
  flexShrink: 0,
  marginTop: 1.6,
}));

/** Issue tracker provider chip */
export const TrackerChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'providerColor',
})<{ providerColor: string }>(({ providerColor }) => ({
  height: 18,
  fontSize: '0.6rem',
  fontWeight: 700,
  backgroundColor: alpha(providerColor, 0.1),
  color: providerColor,
  border: 'none',
}));
