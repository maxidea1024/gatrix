import { styled, alpha } from '@mui/material/styles';
import { Box, Typography, Chip, ToggleButtonGroup, ToggleButton, IconButton } from '@mui/material';

/* ─── Shared Analytics Styled Components ─── */

/** Data table wrapper with horizontal scroll */
export const DataTableWrapper = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  overflowX: 'auto',
  '&::-webkit-scrollbar': { height: 6 },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    borderRadius: 3,
  },
}));

/** HTML table with consistent styling */
export const StyledTable = styled('table')({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8rem',
});

/** Table header cell */
export const StyledTh = styled('th', {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'align' && p !== 'sticky',
})<{ isDark: boolean; align?: 'left' | 'right' | 'center'; sticky?: boolean }>(
  ({ isDark, align = 'left', sticky }) => ({
    textAlign: align,
    padding: '12px 16px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    position: sticky ? 'sticky' : undefined,
    top: sticky ? 0 : undefined,
    zIndex: sticky ? 2 : undefined,
    letterSpacing: '-0.01em',
  })
);

/** Table body cell */
export const StyledTd = styled('td', {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'align' && p !== 'mono',
})<{ isDark: boolean; align?: 'left' | 'right' | 'center'; mono?: boolean }>(
  ({ isDark, align = 'left', mono }) => ({
    textAlign: align,
    padding: '10px 16px',
    fontVariantNumeric: mono ? 'tabular-nums' : undefined,
    fontWeight: mono ? 600 : 400,
  })
);

/** Table row with subtle divider */
export const StyledTr = styled('tr', {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
  transition: 'background 0.1s ease',
  '&:hover': {
    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
  },
}));

/** Series color dot */
export const SeriesDot = styled(Box, {
  shouldForwardProp: (p) => p !== 'dotColor',
})<{ dotColor: string }>(({ dotColor }) => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: dotColor,
  flexShrink: 0,
}));

/** Funnel step number badge */
export const StepBadge = styled(Box, {
  shouldForwardProp: (p) => p !== 'bgColor',
})<{ bgColor: string }>(({ bgColor }) => ({
  width: 20,
  height: 20,
  borderRadius: 4,
  backgroundColor: bgColor,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.6rem',
  fontWeight: 800,
  flexShrink: 0,
}));

/** Metric summary card (e.g., Overall Conversion, Median Time) */
export const MetricCard = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  flex: 1,
  minWidth: 120,
  padding: '16px',
  borderRadius: 12,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  textAlign: 'center',
  background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
}));

/** Overall conversion rate large display */
export const ConversionDisplay = styled(Box)({
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
  marginBottom: 8,
  paddingLeft: 8,
});

/** Heatmap retention cell */
export const HeatmapCell = styled(Box, {
  shouldForwardProp: (p) => p !== 'pct' && p !== 'isDark',
})<{ pct: number; isDark: boolean }>(({ pct, isDark }) => {
  const color = getHeatColor(pct);
  return {
    width: '100%',
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    fontSize: '0.7rem',
    fontWeight: pct > 0 ? 600 : 400,
    background: pct > 0 ? alpha(color, isDark ? 0.55 : 0.8) : 'transparent',
    color: pct > 50 ? '#fff' : pct > 0 ? undefined : undefined,
    transition: 'background 0.15s ease',
  };
});

/** Section divider with consistent opacity */
export const SectionDivider = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  height: 1,
  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
  margin: '4px 0',
}));

/** Step connector line between funnel/retention steps */
export const StepConnector = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  justifyContent: 'center',
  margin: '-4px 0',
  '& > div': {
    width: 2,
    height: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  },
}));

/** Recharts tooltip content style */
export const tooltipStyle = (isDark: boolean) => ({
  background: isDark ? '#1e1e2e' : '#fff',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
  borderRadius: 8,
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  fontSize: 12,
});

/** Recharts grid stroke */
export const gridStroke = (isDark: boolean) =>
  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

/** Recharts tick style */
export const tickStyle = (textColor: string) => ({
  fontSize: 11,
  fill: textColor,
});

/* ─── Helpers ─── */

function getHeatColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#10b981';
  if (pct >= 40) return '#34d399';
  if (pct >= 20) return '#6ee7b7';
  if (pct >= 10) return '#a7f3d0';
  return '#d1fae5';
}
