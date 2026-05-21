import React, { useState } from 'react';
import {
  Box,
  Tooltip,
  Badge,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  useTheme,
  alpha,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { MenuCategory } from '@/config/navigation';

declare const __APP_VERSION__: string;

// Rail width constant - exported for layout calculations
export const RAIL_WIDTH = 60;

interface NavigationRailProps {
  categories: MenuCategory[];
  activeCategoryId: string | null;
  subPanelOpen: boolean;
  onCategorySelect: (categoryId: string) => void;
  onDirectNavigate: (path: string) => void;
  onRailClick: () => void;
  sseConnectionStatus: string;
  onLogoClick: () => void;
}

/**
 * NavigationRail - Slim left-side icon bar (Discord/Slack style)
 *
 * Shows category icons vertically. Clicking an icon either:
 * - Toggles the SubPanel for that category, or
 * - Directly navigates (for categories with a `path` and single child)
 */
const NavigationRail: React.FC<NavigationRailProps> = ({
  categories,
  activeCategoryId,
  subPanelOpen,
  onCategorySelect,
  onDirectNavigate,
  onRailClick,
  sseConnectionStatus,
  onLogoClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [aboutOpen, setAboutOpen] = useState(false);

  // Determine if a category should navigate directly (no children to show in sub-panel)
  const isDirectNav = (cat: MenuCategory): boolean => {
    return !!cat.path && cat.children.length === 0;
  };

  const handleCategoryClick = (cat: MenuCategory) => {
    if (isDirectNav(cat)) {
      // No children - just navigate, no sub-panel needed
      onDirectNavigate(cat.path!);
    } else if (cat.path && cat.children.length > 0) {
      // Has both path and children (e.g. Change Requests) - navigate AND open sub-panel
      onDirectNavigate(cat.path);
      onCategorySelect(cat.id);
    } else {
      // Has children but no direct path - just open sub-panel
      onCategorySelect(cat.id);
    }
  };

  // When sub-panel is closed, clicking anywhere on the rail reopens it
  const handleRailBackgroundClick = () => {
    if (!subPanelOpen) {
      onRailClick();
    }
  };

  return (
    <Box
      onClick={handleRailBackgroundClick}
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        bgcolor: isDark
          ? alpha(theme.palette.background.paper, 0.6)
          : alpha(theme.palette.grey[100], 0.8),
        borderRight: `1px solid ${theme.palette.divider}`,
        py: 1,
        position: 'relative',
        zIndex: theme.zIndex.drawer + 1,
        cursor: subPanelOpen ? 'default' : 'pointer',
        transition: 'background-color 0.2s ease',
        ...(!subPanelOpen && {
          '&:hover': {
            bgcolor: isDark
              ? alpha(theme.palette.background.paper, 0.8)
              : alpha(theme.palette.grey[200], 0.8),
          },
        }),
      }}
    >
      {/* Logo */}
      <Tooltip title="Dashboard" placement="right" arrow>
        <Box
          onClick={onLogoClick}
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            overflow: 'hidden',
            cursor: 'pointer',
            mb: 1.5,
            '&:hover': { transform: 'scale(1.08)' },
            '&:active': { transform: 'scale(0.95)' },
            transition: 'transform 0.2s',
            border: sseConnectionStatus === 'error'
              ? `2px solid ${theme.palette.error.main}`
              : '2px solid transparent',
          }}
        >
          <img
            src="/images/gat-face.png"
            alt="Gatrix"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      </Tooltip>

      {/* Divider */}
      <Box
        sx={{
          width: 28,
          height: '2px',
          borderRadius: 1,
          bgcolor: theme.palette.divider,
          mb: 1,
        }}
      />

      {/* Category icons */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          width: '100%',
          overflow: 'auto',
          // Hide scrollbar
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;

          return (
            <Tooltip
              key={cat.id}
              title={t(cat.text)}
              placement="right"
              arrow
            >
              <Box
                onClick={() => handleCategoryClick(cat)}
                sx={{
                  position: 'relative',
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: isActive ? 2 : '50%',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: isActive
                    ? theme.palette.primary.main
                    : theme.palette.text.secondary,
                  bgcolor: isActive
                    ? isDark
                      ? alpha(theme.palette.primary.main, 0.15)
                      : alpha(theme.palette.primary.main, 0.1)
                    : 'transparent',
                  '&:hover': {
                    bgcolor: isActive
                      ? isDark
                        ? alpha(theme.palette.primary.main, 0.2)
                        : alpha(theme.palette.primary.main, 0.15)
                      : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.06)',
                    borderRadius: 2,
                    color: isActive
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                  },
                  '&:active': {
                    transform: 'scale(0.92)',
                  },
                }}
              >
                {/* Active indicator - left bar */}
                {isActive && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 20,
                      borderRadius: '0 3px 3px 0',
                      bgcolor: theme.palette.primary.main,
                      transition: 'height 0.2s ease',
                    }}
                  />
                )}

                {/* Icon with badge */}
                <Badge
                  badgeContent={cat.badge}
                  color="error"
                  max={99}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.6rem',
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '& .MuiSvgIcon-root': {
                        fontSize: 22,
                      },
                    }}
                  >
                    {cat.icon}
                  </Box>
                </Badge>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* About button */}
      <Tooltip title={t('common.about', 'About')} placement="right" arrow>
        <IconButton
          onClick={() => setAboutOpen(true)}
          size="small"
          sx={{
            mt: 0.5,
            mb: 0.5,
            color: 'text.disabled',
            transition: 'color 0.2s',
            '&:hover': { color: 'text.secondary' },
          }}
        >
          <InfoIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* About Dialog */}
      <Dialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
          },
        }}
      >
        <DialogContent sx={{ textAlign: 'center', py: 5, px: 4 }}>
          {/* Mascot */}
          <Box
            component="img"
            src="/images/gat-mascot.png"
            alt="Gat"
            sx={{
              width: 96,
              height: 96,
              borderRadius: 3,
              mx: 'auto',
              mb: 2.5,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          />

          {/* App name */}
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Gatrix
          </Typography>

          {/* Version */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontFamily: 'monospace',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'grey.100',
              display: 'inline-block',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              mb: 2,
            }}
          >
            v{__APP_VERSION__}
          </Typography>

          {/* Description */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('about.description', 'Game Operations Management Platform')}
          </Typography>

          {/* Copyright */}
          <Typography variant="caption" color="text.disabled">
            © {new Date().getFullYear()} Gatrix. All rights reserved.
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default NavigationRail;
