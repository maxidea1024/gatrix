import { styled, alpha } from '@mui/material/styles';
import { Paper } from '@mui/material';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

// ─── Bulk Action Bar ───

export const BulkActionBar = styled(Paper)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 6.4,
  paddingBottom: 6.4,
  borderRadius: 6,
  backgroundColor: alpha(ARGUS_SEMANTIC.warning, 0.06),
  border: `1px solid ${alpha(ARGUS_SEMANTIC.warning, 0.15)}`,
});

// ─── Rule Card ───

export const RuleCard = styled(Paper, {
  shouldForwardProp: (p) =>
    p !== 'isDark' && p !== 'accentColor' && p !== 'dimmed',
})<{ isDark: boolean; accentColor: string; dimmed: boolean }>(
  ({ isDark, accentColor, dimmed }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 8,
    transition: 'all 0.15s',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    borderLeft: `3px solid ${accentColor}`,
    opacity: dimmed ? (accentColor === 'transparent' ? 0.55 : 0.45) : 1,
    '&:hover': {
      borderColor: alpha(ARGUS_SEMANTIC.warning, 0.3),
    },
  })
);
