/**
 * PageHeader Component
 *
 * Compact page header with icon, title, inline subtitle, optional tabs and actions.
 * Title, subtitle, tabs and actions are placed on the same line to maximize content area.
 * Ensures consistent styling across all admin and feature pages.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  tabs?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  tabs,
  actions,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1.5,
        pb: 1,
        minHeight: 40,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {/* Left: icon + title + subtitle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
          flexShrink: 1,
          overflow: 'hidden',
        }}
      >
        {icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.primary',
              flexShrink: 0,
              '& .MuiSvgIcon-root': { color: 'inherit', fontSize: '1.25rem' },
            }}
          >
            {icon}
          </Box>
        )}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: '1.1rem',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <>
            <Box
              sx={{
                width: '1px',
                height: 16,
                bgcolor: 'divider',
                flexShrink: 0,
                mx: 0.5,
              }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '0.8rem',
              }}
            >
              {subtitle}
            </Typography>
          </>
        )}
      </Box>

      {/* Right: tabs + actions */}
      {(tabs || actions) && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            alignItems: 'center',
            flexShrink: 0,
            ml: 2,
            // Compact action buttons globally
            '& .MuiButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              px: 1.5,
              py: 0.375,
              minHeight: 30,
              borderRadius: 1.5,
              lineHeight: 1.4,
              '& .MuiButton-startIcon': {
                mr: 0.5,
                '& .MuiSvgIcon-root': { fontSize: '0.95rem' },
              },
              '& .MuiButton-endIcon': {
                ml: 0.25,
                '& .MuiSvgIcon-root': { fontSize: '0.95rem' },
              },
            },
            '& .MuiIconButton-root': {
              p: 0.5,
              '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
            },
          }}
        >
          {tabs}
          {actions}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;
