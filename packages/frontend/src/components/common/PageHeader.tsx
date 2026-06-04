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
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  tabs?: React.ReactNode;
  actions?: React.ReactNode;
  /** Free-form content rendered on the right side of the header, before tabs/actions. */
  headerActions?: React.ReactNode;
  /** Additional items to render inside the MoreVert menu, above the refresh option. */
  menuItems?: React.ReactNode;
  /** When provided, a MoreVert menu with Refresh is rendered at the end of the header. */
  onRefresh?: () => void;
  /** Automatically display a back button if the user arrived via in-app navigation */
  enableAutoBack?: boolean;
  /** Custom handler for back button. Trumps enableAutoBack if provided. */
  onBack?: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  tabs,
  actions,
  headerActions,
  menuItems,
  onRefresh,
  enableAutoBack = false,
  onBack,
}) => {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isFromSidebar = (location.state as any)?.fromSidebar === true;
  const showBackButton = !!onBack || (enableAutoBack && location.key !== 'default' && !isFromSidebar);
  const showRightSection = tabs || actions || headerActions || onRefresh;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 0.5,
          py: 0.5,
          minHeight: 36,
          borderRadius: '6px',
          bgcolor: 'transparent',
          borderBottom: (theme: any) =>
            theme.palette.mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.04)'
              : '1px solid rgba(0, 0, 0, 0.04)',
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
          {showBackButton && (
            <Tooltip title={t('common.goBack', '뒤로 가기')} placement="bottom">
              <IconButton 
                size="small" 
                onClick={onBack ? onBack : () => navigate(-1)}
                sx={{
                  mr: 0.5,
                  width: 30,
                  height: 30,
                  color: 'primary.main',
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(144, 202, 249, 0.08)'
                      : 'rgba(25, 118, 210, 0.08)',
                  border: (theme) =>
                    `1px solid ${theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.2)' : 'rgba(25, 118, 210, 0.2)'}`,
                  borderRadius: '50%',
                  '&:hover': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(144, 202, 249, 0.16)'
                        : 'rgba(25, 118, 210, 0.14)',
                  },
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: 26,
                height: 26,
                borderRadius: '6px',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                color: '#fff',
                '& .MuiSvgIcon-root': { fontSize: '0.95rem' },
              }}
            >
              {icon}
            </Box>
          )}
          {typeof title === 'string' ? (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {title}
            </Typography>
          ) : (
            title
          )}
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
            {headerActions}
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
    </Box>
  );
};

export default PageHeader;
