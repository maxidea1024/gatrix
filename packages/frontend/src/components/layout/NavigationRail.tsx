import React from 'react';
import {
  Box,
  Tooltip,
  Badge,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MenuCategory } from '@/config/navigation';

declare const __APP_VERSION__: string;

// Rail width constant - exported for layout calculations
export const RAIL_WIDTH = 60;

interface NavigationRailProps {
  categories: MenuCategory[];
  activeCategoryId: string | null;
  onCategorySelect: (categoryId: string) => void;
  onDirectNavigate: (path: string) => void;
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
  onCategorySelect,
  onDirectNavigate,
  sseConnectionStatus,
  onLogoClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  // Determine if a category should navigate directly (single child with path)
  const isDirectNav = (cat: MenuCategory): boolean => {
    return !!cat.path && cat.children.length <= 1;
  };

  const handleCategoryClick = (cat: MenuCategory) => {
    if (isDirectNav(cat)) {
      onDirectNavigate(cat.path!);
    } else {
      onCategorySelect(cat.id);
    }
  };

  return (
    <Box
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
      }}
    >
      {/* Logo */}
      <Tooltip title="Dashboard" placement="right" arrow>
        <Box
          onClick={onLogoClick}
          sx={{
            width: 36,
            height: 36,
            backgroundColor:
              sseConnectionStatus === 'error'
                ? theme.palette.error.main
                : theme.palette.primary.main,
            transition: 'background-color 0.3s ease',
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            mb: 1.5,
            '&:hover': { opacity: 0.85, transform: 'scale(1.05)' },
            '&:active': { transform: 'scale(0.95)' },
            transitionProperty: 'background-color, opacity, transform',
            transitionDuration: '0.2s',
          }}
        >
          <Typography
            variant="h6"
            sx={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}
          >
            G
          </Typography>
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
          const isDirect = isDirectNav(cat);

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

      {/* Version at bottom */}
      <Box
        sx={{
          mt: 1,
          opacity: 0.4,
          transition: 'opacity 0.2s',
          '&:hover': { opacity: 0.8 },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.6rem',
            fontWeight: 600,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            letterSpacing: '0.05em',
          }}
        >
          {__APP_VERSION__}
        </Typography>
      </Box>
    </Box>
  );
};

export default NavigationRail;
