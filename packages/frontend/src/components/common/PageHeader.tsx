/**
 * PageHeader Component
 *
 * Unified page header with icon, title, subtitle and optional actions.
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
        alignItems: 'flex-start',
        mb: 3,
      }}
    >
      <Box>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'text.primary',
                '& .MuiSvgIcon-root': { color: 'inherit' },
              }}
            >
              {icon}
            </Box>
          )}
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {actions}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;
