import React, { useState, useRef, useCallback } from 'react';
import GatRunnerGame from './GatRunnerGame';
import {
  Box,
  Tooltip,
  Badge,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Info as InfoIcon,
  Close as CloseIcon,
  MenuBook as MenuBookIcon,
} from '@mui/icons-material';
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
  const [gameOpen, setGameOpen] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCatImageClick = useCallback(() => {
    clickCountRef.current++;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      setAboutOpen(false);
      setGameOpen(true);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1500);
  }, []);

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
    if (!subPanelOpen && !aboutOpen) {
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
          onClick={(e) => {
            e.stopPropagation();
            onLogoClick();
          }}
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
            border:
              sseConnectionStatus === 'error'
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
            <Tooltip key={cat.id} title={t(cat.text)} placement="right" arrow>
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategoryClick(cat);
                }}
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
      <Tooltip title={t('common.about')} placement="right" arrow>
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            setAboutOpen(true);
          }}
          size="medium"
          sx={{
            mt: 0.5,
            mb: 0.5,
            color: 'text.disabled',
            transition: 'all 0.2s',
            '&:hover': {
              color: 'text.secondary',
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          }}
        >
          <InfoIcon sx={{ fontSize: 22 }} />
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
        <IconButton
          onClick={() => setAboutOpen(false)}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'text.disabled',
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <DialogContent sx={{ textAlign: 'center', py: 4, px: 4 }}>
          {/* Gaming animation - click 5 times for easter egg! */}
          <Box
            component="img"
            src="/images/gat-gaming.webp"
            alt="Gat"
            onClick={handleCatImageClick}
            sx={{
              width: 120,
              height: 120,
              mx: 'auto',
              mb: 1,
              display: 'block',
              cursor: 'pointer',
              transition: 'transform 0.1s',
              '&:active': { transform: 'scale(0.95)' },
            }}
          />

          {/* Typing animation: "I am Gat" */}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              mb: 3,
              height: 20,
              overflow: 'hidden',
              display: 'inline-block',
              borderRight: '2px solid',
              borderColor: 'primary.main',
              whiteSpace: 'nowrap',
              animation: `typing 1.5s steps(12) forwards, blink 0.6s step-end infinite`,
              '@keyframes typing': {
                '0%': { width: 0 },
                '100%': { width: '8em' },
              },
              '@keyframes blink': {
                '0%, 100%': { borderColor: 'transparent' },
                '50%': { borderColor: 'primary.main' },
              },
            }}
          >
            I am Gat 🐱
          </Typography>

          {/* App name */}
          <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
            Gatrix
          </Typography>

          {/* Version badge */}
          <Typography
            variant="caption"
            sx={{
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'grey.100',
              display: 'inline-block',
              px: 1.5,
              py: 0.25,
              borderRadius: 2,
              mb: 2,
              color: 'text.secondary',
            }}
          >
            {__APP_VERSION__}
          </Typography>

          {/* Description */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {t('about.description')}
          </Typography>

          {/* Links */}
          <Divider sx={{ mb: 2 }} />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 3,
              mb: 2.5,
            }}
          >
            {[
              {
                icon: <MenuBookIcon sx={{ fontSize: 18 }} />,
                label: t('header.documentation'),
                href: '/docs',
              },
            ].map((link) => (
              <Box
                key={link.href}
                component="a"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'grey.50',
                    color: 'primary.main',
                  },
                }}
              >
                {link.icon}
                {link.label}
              </Box>
            ))}
          </Box>

          {/* Copyright */}
          <Typography variant="caption" color="text.disabled">
            © {new Date().getFullYear()} Gatrix. All rights reserved.
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Easter Egg: Gat Runner Game */}
      <GatRunnerGame open={gameOpen} onClose={() => setGameOpen(false)} />
    </Box>
  );
};

export default NavigationRail;
