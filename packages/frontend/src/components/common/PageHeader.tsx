/**
 * PageHeader Component
 *
 * Compact page header with icon, title, inline subtitle and optional actions.
 * Title and subtitle are placed on the same line to maximize content area.
 * Ensures consistent styling across all admin and feature pages.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  actions,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1.5,
        minHeight: 40,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
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
      {actions && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexShrink: 0,
            ml: 2,
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;
