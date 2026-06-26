import { styled, alpha } from '@mui/material/styles';
import { Box, Chip } from '@mui/material';

/** Full-height page container */
export const PageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 96px)',
});

/** Split-panel container */
export const SplitContainer = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  flex: 1,
  display: 'flex',
  gap: 0,
  overflow: 'hidden',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  borderRadius: 8,
}));

/** Resizable splitter handle */
export const SplitterHandle = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDragging',
})<{ isDragging: boolean }>(({ isDragging, theme }) => ({
  width: '1px',
  flexShrink: 0,
  cursor: 'col-resize',
  backgroundColor: isDragging
    ? theme.palette.primary.main
    : theme.palette.divider,
  position: 'relative',
  zIndex: 10,
  transition: 'background-color 0.15s, transform 0.15s',
  transformOrigin: 'center',
  ...(isDragging && {
    backgroundColor: theme.palette.primary.main,
    transform: 'scaleX(4)',
  }),
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '-5px',
    right: '-5px',
    cursor: 'col-resize',
  },
  '&:hover, &:active': {
    backgroundColor: theme.palette.primary.main,
    transform: 'scaleX(4)',
  },
}));

/** Pagination wrapper */
export const PaginationWrapper = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  flexShrink: 0,
  borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

/** Total count chip in header */
export const TotalCountChip = styled(Chip)({
  fontWeight: 700,
  fontSize: '0.75rem',
  height: 22,
  backgroundColor: alpha('#7c4dff', 0.1),
  color: '#7c4dff',
  border: 'none',
});
