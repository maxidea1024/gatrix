import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  useTheme,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';

export interface EventBlockProps {
  /** The letter index, e.g., 'A', 'B' */
  indexLabel: string;
  /** Primary color for this block */
  color: string;
  /** Main content inside the block */
  children: React.ReactNode;
  /** Optional remove callback */
  onRemove?: () => void;
  /** Whether the block is in a hover/focused state */
  isFocused?: boolean;
  /** Drag handle props from useSortable (attributes + listeners) */
  dragHandleProps?: Record<string, any>;
  /** Whether this block is currently being dragged */
  isDragging?: boolean;
}

const EventBlock: React.FC<EventBlockProps> = ({
  indexLabel,
  color,
  children,
  onRemove,
  isFocused = false,
  dragHandleProps,
  isDragging = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        p: 1.5,
        borderRadius: 2,
        border: `1px solid ${
          isFocused
            ? alpha(color, 0.4)
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.06)'
        }`,
        background: isDark ? 'rgba(255,255,255,0.015)' : '#fff',
        transition: 'all 0.2s',
        boxShadow: isDragging
          ? `0 4px 20px ${alpha(color, 0.25)}`
          : isFocused
            ? `0 2px 12px ${alpha(color, 0.15)}`
            : 'none',
        opacity: isDragging ? 0.6 : 1,
        '&:hover': {
          borderColor: alpha(color, 0.3),
          background: isDark ? 'rgba(255,255,255,0.03)' : alpha(color, 0.02),
        },
      }}
    >
      {/* Drag Handle */}
      {dragHandleProps && (
        <Box
          {...dragHandleProps}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            opacity: 0.4,
            mt: 0.25,
            flexShrink: 0,
            '&:hover': { opacity: 0.8 },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIcon sx={{ fontSize: 18 }} />
        </Box>
      )}

      {/* Letter Badge */}
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '6px',
          background: alpha(color, 0.15),
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, fontSize: '0.75rem' }}
        >
          {indexLabel}
        </Typography>
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          minWidth: 0,
        }}
      >
        {children}
      </Box>

      {/* Remove Button */}
      {onRemove && (
        <Tooltip title="Remove">
          <IconButton
            size="small"
            onClick={onRemove}
            sx={{
              mt: -0.5,
              mr: -0.5,
              opacity: 0,
              '.MuiBox-root:hover > &': { opacity: 0.5 },
              '&:hover': { opacity: '1 !important' },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default EventBlock;
