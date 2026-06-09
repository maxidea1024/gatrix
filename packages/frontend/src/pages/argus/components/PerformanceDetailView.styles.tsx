import { styled, alpha } from '@mui/material/styles';
import { Box, Paper } from '@mui/material';

// ─── Section Paper (bordered, rounded) ───

export const DetailPaper = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: 16,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  borderRadius: 8,
}));

// ─── Stat Card (gradient background) ───

export const StatCard = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'accentColor',
})<{ isDark: boolean; accentColor: string }>(({ isDark, accentColor }) => ({
  padding: 12,
  background: isDark
    ? `linear-gradient(135deg, ${alpha(accentColor, 0.12)}, ${alpha(accentColor, 0.03)})`
    : `linear-gradient(135deg, ${alpha(accentColor, 0.06)}, ${alpha(accentColor, 0.01)})`,
  border: `1px solid ${alpha(accentColor, 0.2)}`,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}));

// ─── Stat Icon Box ───

export const StatIconBox = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'accentColor',
})<{ isDark: boolean; accentColor: string }>(({ isDark, accentColor }) => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(accentColor, isDark ? 0.2 : 0.1),
  color: accentColor,
}));

// ─── Insight Box ───

export const InsightBox = styled(Box)<{ accentColor: string }>(
  ({ accentColor }) => ({
    padding: 12,
    borderRadius: 6,
    backgroundColor: alpha(accentColor, 0.1),
    border: `1px solid ${alpha(accentColor, 0.2)}`,
  })
);

// ─── Issue Row ───

export const IssueRow = styled(Box)<{ accentColor: string }>(
  ({ accentColor }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    paddingLeft: 0,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.15s',
    '&:hover': {
      backgroundColor: alpha(accentColor, 0.06),
    },
  })
);

// ─── Level Accent Bar ───

export const LevelAccent = styled(Box)<{ accentColor: string }>(
  ({ accentColor }) => ({
    width: 3,
    height: 32,
    borderRadius: 4,
    backgroundColor: accentColor,
    flexShrink: 0,
  })
);

// ─── Event Count Badge ───

export const EventCountBadge = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'accentColor',
})<{ isDark: boolean; accentColor: string }>(({ isDark, accentColor }) => ({
  paddingLeft: 9.6,
  paddingRight: 9.6,
  paddingTop: 2.4,
  paddingBottom: 2.4,
  borderRadius: 4,
  backgroundColor: alpha(accentColor, isDark ? 0.15 : 0.08),
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
}));

// ─── Span Progress Track ───

export const SpanProgressTrack = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  height: 4,
  borderRadius: 8,
  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
}));
