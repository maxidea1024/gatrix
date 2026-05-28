/**
 * PageHeader Component
 *
 * Compact page header with icon, title, inline subtitle, optional tabs and actions.
 * Title, subtitle, tabs and actions are placed on the same line to maximize content area.
 * When `onRefresh` is provided, a MoreVert menu with a Refresh item is rendered at the end.
 * Ensures consistent styling across all admin and feature pages.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  tabs?: React.ReactNode;
  actions?: React.ReactNode;
  /** Additional items to render inside the MoreVert menu, above the refresh option. */
  menuItems?: React.ReactNode;
  /** When provided, a MoreVert menu with Refresh is rendered at the end of the header. */
  onRefresh?: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  tabs,
  actions,
  menuItems,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const showRightSection = tabs || actions || onRefresh;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1,
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

      {/* Right: tabs + actions + context menu */}
      {showRightSection && (
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
              fontWeight: '600 !important',
              fontSize: '0.78rem !important',
              minHeight: '28px !important',
              maxHeight: '28px !important',
              height: '28px !important',
              lineHeight: '1 !important',
              padding: '2px 10px !important',
              boxShadow: 'none !important',
              '&:hover': { boxShadow: 'none !important' },
              '& .MuiButton-startIcon': {
                mr: 0.5,
                '& .MuiSvgIcon-root': { fontSize: '0.85rem !important' },
              },
              '& .MuiButton-endIcon': {
                ml: 0.25,
                '& .MuiSvgIcon-root': { fontSize: '0.85rem !important' },
              },
            },
            // borderRadius only for standalone buttons (not inside ButtonGroup)
            '& .MuiButton-root:not(.MuiButtonGroup-grouped)': {
              borderRadius: 1.5,
            },
            // Compact IconButtons (VertMore, etc.) — match button height
            '& .MuiIconButton-root': {
              width: '28px !important',
              height: '28px !important',
              padding: '4px !important',
              '& .MuiSvgIcon-root': { fontSize: '1rem !important' },
            },
          }}
        >
          {tabs}
          {actions}
          {onRefresh && (
            <>
              <IconButton
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                size="small"
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {menuItems}
                {menuItems && <Divider />}
                <MenuItem
                  onClick={() => {
                    onRefresh();
                    setMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <RefreshIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('common.refresh')}</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;
