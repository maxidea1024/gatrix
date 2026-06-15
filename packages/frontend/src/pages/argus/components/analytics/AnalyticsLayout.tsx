import React from 'react';
import { Box, Paper, useTheme, Typography, Divider } from '@mui/material';
import { useResizableSplit } from '@/hooks/useResizableSplit';
import GlobalFilterBar from './GlobalFilterBar';

export interface AnalyticsLayoutProps {
  /** The content of the left sidebar (Query Builder) */
  leftPanel: React.ReactNode;
  /** The top toolbar above the chart */
  toolbar?: React.ReactNode;
  /** The main chart/table content */
  children: React.ReactNode;
  /** Optional title for the right section */
  title?: string;
  /** Project ID for global filter property picker */
  projectId?: string;
}

const AnalyticsLayout: React.FC<AnalyticsLayoutProps> = ({
  leftPanel,
  toolbar,
  children,
  title,
  projectId,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const {
    splitWidth: panelWidth,
    isDragging: isPanelDragging,
    handleMouseDown: handlePanelSplitterMouseDown,
  } = useResizableSplit({
    storageKey: 'argus_analytics_panel_width',
    defaultWidth: 340,
    minWidth: 260,
    maxWidth: 600,
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flex: 1,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Left Sidebar: Query Builder */}
      <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
        <Box
          sx={{
            width: panelWidth,
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
              borderRadius: '3px',
            },
          }}
        >
          {leftPanel}
        </Box>
        <Box
          onMouseDown={handlePanelSplitterMouseDown}
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '1px',
            cursor: 'col-resize',
            bgcolor: isPanelDragging ? 'primary.main' : 'transparent',
            zIndex: 10,
            transition: 'background-color 0.15s, transform 0.15s',
            transformOrigin: 'center',
            ...(isPanelDragging && {
              bgcolor: 'primary.main',
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
              bgcolor: 'primary.main',
              transform: 'scaleX(4)',
            },
          }}
        />
      </Box>

      {/* Right Content: Visualization & Table */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
        }}
      >
        {/* Toolbar Row */}
        {(toolbar || title) && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              minHeight: 64,
            }}
          >
            {title ? (
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ fontSize: '1.1rem' }}
              >
                {title}
              </Typography>
            ) : (
              <Box /> // Spacer
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {toolbar}
            </Box>
          </Box>
        )}

        {/* Global Filter Bar */}
        {projectId && (
          <Box
            sx={{
              px: 3,
              py: 1,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <GlobalFilterBar projectId={projectId} />
          </Box>
        )}

        {/* Main Content */}
        <Box
          sx={{
            flexGrow: 1,
            p: 3,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
              borderRadius: '3px',
            },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AnalyticsLayout;
