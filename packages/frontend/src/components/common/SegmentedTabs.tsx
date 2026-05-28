/**
 * SegmentedTabs Component
 *
 * A compact, pill-style segmented control for switching between views.
 * Designed to fit inline within PageHeader or any toolbar.
 * Reusable across all tabbed pages.
 */

import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';

export interface SegmentedTabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  value: string;
  onChange: (key: string) => void;
}

const SegmentedTabs: React.FC<SegmentedTabsProps> = ({
  items,
  value,
  onChange,
}) => {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {items.map((item, index) => {
        const isActive = item.key === value;
        return (
          <ButtonBase
            key={item.key}
            onClick={() => onChange(item.key)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.75,
              py: 0.625,
              position: 'relative',
              transition: 'all 0.2s ease',
              bgcolor: isActive
                ? (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'primary.dark'
                      : 'primary.main'
                : 'transparent',
              // Divider between inactive items
              borderRight: index < items.length - 1 ? 1 : 0,
              borderColor: 'divider',
              '&:hover': {
                bgcolor: isActive
                  ? undefined
                  : (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)',
              },
              '& .MuiSvgIcon-root': {
                fontSize: '0.95rem',
                color: isActive ? '#fff' : 'text.secondary',
                transition: 'color 0.2s ease',
              },
            }}
          >
            {item.icon}
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#fff' : 'text.secondary',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
                transition: 'all 0.2s ease',
              }}
            >
              {item.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
};

export default SegmentedTabs;
