import React, { useState, useEffect, ReactNode } from 'react';
import { Drawer, Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface ResizableDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  storageKey: string; // localStorage key for persisting width
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  zIndex?: number;
}

/**
 * Resizable Drawer component with drag-to-resize functionality
 * Width is persisted in localStorage using the provided storageKey
 */
const ResizableDrawer: React.FC<ResizableDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  storageKey,
  defaultWidth = 600,
  minWidth = 400,
  maxWidth,
  zIndex = 1300,
}) => {
  // Drawer width state (persisted in localStorage)
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved) : defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Handle drawer resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      const effectiveMinWidth = minWidth;
      const effectiveMaxWidth = maxWidth || window.innerWidth;

      if (newWidth >= effectiveMinWidth && newWidth <= effectiveMaxWidth) {
        setDrawerWidth(newWidth);
        localStorage.setItem(storageKey, String(newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth, storageKey]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex,
        '& .MuiDrawer-paper': {
          width: `${drawerWidth}px`,
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
      slotProps={{
        backdrop: { sx: { zIndex: zIndex - 1 } }
      }}
    >
      {/* Resize Grip */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '8px',
          cursor: 'ew-resize',
          bgcolor: isResizing ? 'primary.main' : 'transparent',
          transition: 'background-color 0.2s',
          zIndex: 1000,
          '&:hover': {
            bgcolor: 'primary.light',
          }
        }}
      />

      {/* Header */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            '&:hover': {
              bgcolor: 'action.hover',
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Drawer>
  );
};

export default ResizableDrawer;

