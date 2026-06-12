import { styled, alpha } from '@mui/material/styles';
import { Box, Paper, TableCell } from '@mui/material';

// ─── Table Paper (shared by all 3 tabs) ───

export const TablePaper = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  borderRadius: 8,
  overflow: 'auto',
  width: '100%',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

// ─── Sortable Table Header Cell ───

export const SortableHeaderCell = styled(TableCell, {
  shouldForwardProp: (p) => p !== 'isActive' && p !== 'isSortable',
})<{ isActive?: boolean; isSortable?: boolean }>(
  ({ theme, isActive, isSortable }) => ({
    fontWeight: 700,
    fontSize: '0.7rem',
    textTransform: 'uppercase' as const,
    cursor: isSortable ? 'pointer' : 'default',
    userSelect: 'none' as const,
    paddingTop: 8,
    paddingBottom: 8,
    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
  })
);

// ─── Group By Toolbar ───

export const GroupByToolbar = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 12,
  paddingBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

// ─── Op Color Dot ───

export const OpDot = styled(Box)<{ dotColor: string }>(({ dotColor }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: dotColor,
  flexShrink: 0,
}));
