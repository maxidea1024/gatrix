import { styled, alpha } from '@mui/material/styles';
import { Box, Button, ButtonGroup, IconButton, Select } from '@mui/material';

// ═════════════════════════════════════════════════════════════════════════════
// Dialog layout
// ═════════════════════════════════════════════════════════════════════════════

export const DialogBody = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

export const HeaderBar = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 10,
  paddingBottom: 6,
  flexShrink: 0,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

export const HeaderLeft = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const HeaderRight = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

export const TreeEditor = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 12,
  paddingBottom: 12,
  minHeight: 0,
});

export const SplitHandle = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  height: 6,
  cursor: 'row-resize',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  '&:hover, &:active': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
  },
  '&::after': {
    content: '""',
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
  },
}));

export const BottomSection = styled(Box)({
  paddingLeft: 16,
  paddingRight: 16,
  paddingBottom: 12,
  paddingTop: 8,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
});

// ═════════════════════════════════════════════════════════════════════════════
// Header icons
// ═════════════════════════════════════════════════════════════════════════════

export const UndoRedoGroup = styled(ButtonGroup)(({ theme }) => ({
  '& .MuiButtonGroup-grouped': {
    minWidth: 28,
    padding: '2px 4px',
    border: `1px solid ${theme.palette.divider}`,
    '&:not(:last-of-type)': {
      borderRight: `1px solid ${theme.palette.divider}`,
    },
  },
}));

export const UndoRedoBtn = styled(IconButton, {
  shouldForwardProp: (p) => p !== 'isDisabled',
})<{ isDisabled: boolean }>(({ isDisabled }) => ({
  borderRadius: 0,
  padding: 3,
  opacity: isDisabled ? 0.2 : 0.6,
  '&:hover': { opacity: 1 },
}));

export const FullscreenButton = styled(IconButton)({
  opacity: 0.5,
  '&:hover': { opacity: 1 },
});

// ═════════════════════════════════════════════════════════════════════════════
// Group
// ═════════════════════════════════════════════════════════════════════════════

export const GroupBox = styled(Box, {
  shouldForwardProp: (p) =>
    !['isDark', 'isRoot', 'lineColor'].includes(p as string),
})<{ isDark: boolean; isRoot: boolean; lineColor: string }>(
  ({ isDark, isRoot, lineColor }) => ({
    marginTop: 0,
    ...(isRoot
      ? {}
      : {
          border: `1px solid ${isDark ? alpha(lineColor, 0.25) : alpha(lineColor, 0.2)}`,
          borderRadius: 8,
          backgroundColor: isDark
            ? alpha(lineColor, 0.04)
            : alpha(lineColor, 0.03),
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 3,
        }),
  })
);

export const GroupHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginBottom: 3,
});

export const NotBadge = styled(Box, {
  shouldForwardProp: (p) => !['isNegated', 'isDark'].includes(p as string),
})<{ isNegated: boolean; isDark: boolean }>(({ theme, isNegated, isDark }) => ({
  fontSize: '0.45rem',
  fontWeight: 800,
  paddingLeft: 3,
  paddingRight: 3,
  paddingTop: 0.5,
  paddingBottom: 0.5,
  borderRadius: 3,
  minWidth: 22,
  textAlign: 'center' as const,
  cursor: 'pointer',
  userSelect: 'none' as const,
  color: isNegated
    ? theme.palette.error.main
    : alpha(theme.palette.text.disabled, 0.3),
  backgroundColor: isNegated
    ? alpha(theme.palette.error.main, 0.1)
    : 'transparent',
  border: `1px solid ${isNegated ? alpha(theme.palette.error.main, 0.4) : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
  transition: 'all 0.12s',
  '&:hover': { color: theme.palette.error.main },
}));

export const ConnectorChip = styled(Box, {
  shouldForwardProp: (p) => !['isOr', 'primaryColor'].includes(p as string),
})<{ isOr: boolean; primaryColor: string }>(
  ({ theme, isOr, primaryColor }) => ({
    fontSize: '0.6rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: 4,
    cursor: 'pointer',
    userSelect: 'none' as const,
    color: '#fff',
    backgroundColor: isOr ? theme.palette.warning.main : primaryColor,
    transition: 'all 0.12s',
    '&:hover': { transform: 'scale(1.04)', filter: 'brightness(1.1)' },
  })
);

export const AddRuleButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '0.55rem',
  fontWeight: 600,
  paddingLeft: 6,
  paddingRight: 6,
  paddingTop: 1,
  paddingBottom: 1,
  marginLeft: 4,
  borderRadius: 12,
  border: '1px dashed',
  borderColor: theme.palette.divider,
  color: theme.palette.text.disabled,
  minWidth: 0,
  '&:hover': {
    borderStyle: 'solid',
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
  },
}));

export const AddGroupButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '0.55rem',
  fontWeight: 600,
  paddingLeft: 6,
  paddingRight: 6,
  paddingTop: 1,
  paddingBottom: 1,
  borderRadius: 12,
  border: '1px dashed',
  borderColor: theme.palette.divider,
  color: theme.palette.text.disabled,
  minWidth: 0,
  '&:hover': {
    borderStyle: 'solid',
    borderColor: theme.palette.info.main,
    color: theme.palette.info.main,
  },
}));

export const GroupActionButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== 'actionColor',
})<{ actionColor: 'info' | 'error' }>(({ theme, actionColor }) => ({
  padding: 1.5,
  opacity: 0.2,
  '&:hover': {
    opacity: 1,
    color:
      actionColor === 'info'
        ? theme.palette.info.main
        : theme.palette.error.main,
  },
}));

export const ChildrenContainer = styled(Box, {
  shouldForwardProp: (p) => p !== 'isRoot',
})<{ isRoot: boolean }>(({ isRoot }) => ({
  display: 'flex',
  flexDirection: 'column',
  marginLeft: isRoot ? 10 : 6,
  paddingLeft: isRoot ? 14 : 10,
  position: 'relative',
}));

// ═════════════════════════════════════════════════════════════════════════════
// Filter row
// ═════════════════════════════════════════════════════════════════════════════

export const FilterRow = styled(Box, {
  shouldForwardProp: (p) =>
    !['isDragging', 'lineColor', 'isDark'].includes(p as string),
})<{ isDragging: boolean; lineColor: string; isDark: boolean }>(
  ({ isDragging, lineColor, isDark }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 4,
    paddingTop: 3,
    paddingBottom: 3,
    borderRadius: 6,
    border: `1px solid ${isDark ? alpha(lineColor, 0.18) : alpha(lineColor, 0.15)}`,
    backgroundColor: isDark ? alpha(lineColor, 0.06) : alpha(lineColor, 0.04),
    opacity: isDragging ? 0.3 : 1,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    '&:hover': {
      borderColor: alpha(lineColor, 0.4),
      boxShadow: `0 0 0 1px ${alpha(lineColor, 0.1)}`,
    },
  })
);

export const DragHandle = styled(Box)({
  cursor: 'grab',
  display: 'flex',
  alignItems: 'center',
  opacity: 0.15,
  '&:hover': { opacity: 0.5 },
});

export const FilterSelect = styled(Select)({
  height: 26,
  fontSize: '0.7rem',
  '& .MuiSelect-select': { paddingTop: 2, paddingBottom: 2 },
});

// ═════════════════════════════════════════════════════════════════════════════
// Preview section
// ═════════════════════════════════════════════════════════════════════════════

export const PreviewHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 4,
});

export const PreviewModeToggle = styled(Box, {
  shouldForwardProp: (p) => !['isActive', 'primaryColor'].includes(p as string),
})<{ isActive: boolean; primaryColor: string }>(
  ({ isActive, primaryColor }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 1,
    paddingBottom: 1,
    fontSize: '0.5rem',
    fontWeight: 600,
    borderRadius: 10,
    cursor: 'pointer',
    userSelect: 'none' as const,
    color: isActive ? primaryColor : undefined,
    backgroundColor: isActive ? alpha(primaryColor, 0.1) : 'transparent',
    transition: 'all 0.15s',
    '&:hover': { backgroundColor: alpha(primaryColor, 0.06) },
  })
);

export const PreviewContainer = styled(Box)({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
});

export const ActionsRow = styled(Box)({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 12,
});

export const CancelButton = styled(Button)({
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.7rem',
});

export const ApplyButton = styled(Button)({
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.7rem',
  paddingLeft: 16,
  paddingRight: 16,
  borderRadius: 6,
  boxShadow: 'none',
  '&:hover': { boxShadow: 'none' },
});

// ═════════════════════════════════════════════════════════════════════════════
// Empty group hint
// ═════════════════════════════════════════════════════════════════════════════

export const EmptyGroupHint = styled(Box)({
  paddingTop: 12,
  paddingBottom: 12,
  paddingLeft: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

// ═════════════════════════════════════════════════════════════════════════════
// Drop zone
// ═════════════════════════════════════════════════════════════════════════════

export const DropZone = styled(Box, {
  shouldForwardProp: (p) => !['isActive', 'primaryColor'].includes(p as string),
})<{ isActive: boolean; primaryColor: string }>(
  ({ isActive, primaryColor }) => ({
    height: 8,
    borderRadius: 4,
    border: isActive ? `2px dashed ${primaryColor}` : '2px dashed transparent',
    transition: 'border-color 0.1s',
  })
);
