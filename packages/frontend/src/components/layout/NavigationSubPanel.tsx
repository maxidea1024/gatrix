import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Badge,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type {
  MenuCategory,
  MenuItem as NavMenuItem,
} from '@/config/navigation';
import SidebarContextSwitcher from '@/components/layout/SidebarContextSwitcher';
import QuickLinksSection from '@/components/layout/QuickLinksSection';

// Sub-panel width constant - exported for layout calculations
export const SUBPANEL_WIDTH = 220;

interface RecentPageEntry {
  path: string;
  text: string;
  parentText?: string;
  iconName: string;
}

interface NavigationSubPanelProps {
  category: MenuCategory | null;
  isOpen: boolean;
  onClose: () => void;
  // Recent pages
  recentPages: RecentPageEntry[];
  onNavigate: (path: string, options?: { skipRecentUpdate?: boolean }) => void;
  onRemoveRecent: (path: string) => void;
  onClearRecent: () => void;
  // Menu state
  isActivePath: (path: string) => boolean;
  expandedSubmenus: Record<string, boolean>;
  onToggleSubmenu: (key: string, siblings: number[]) => void;
}

/**
 * NavigationSubPanel - Secondary navigation panel (220px)
 *
 * Shows when a rail category is selected.
 * Contains: recent pages section + category menu items with accordion sub-menus.
 */
const NavigationSubPanel: React.FC<NavigationSubPanelProps> = ({
  category,
  isOpen,
  onClose,
  recentPages,
  onNavigate,
  onRemoveRecent,
  onClearRecent,
  isActivePath,
  expandedSubmenus,
  onToggleSubmenu,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  // Smooth slide-down transition for menu items on category change
  const menuContentRef = useRef<HTMLDivElement>(null);
  const prevCategoryIdRef = useRef<string | null>(category?.id ?? null);

  useEffect(() => {
    const currentId = category?.id ?? null;
    if (currentId !== prevCategoryIdRef.current && currentId !== null) {
      prevCategoryIdRef.current = currentId;
      const el = menuContentRef.current;
      if (el) {
        // Start from invisible + slightly above
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-4px)';
        // Force reflow so the browser registers the starting state
        el.getBoundingClientRect();
        // Transition smoothly to final position
        el.style.transition = 'opacity 250ms ease-out, transform 250ms ease-out';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }
    } else {
      prevCategoryIdRef.current = currentId;
    }
  }, [category?.id]);

  // Recent pages collapsed state
  const [recentCollapsed, setRecentCollapsed] = useState(() => {
    try {
      return localStorage.getItem('railRecentPagesCollapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleRecentCollapsed = useCallback(() => {
    setRecentCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('railRecentPagesCollapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Render a single menu item (leaf node)
  const renderLeafItem = (item: NavMenuItem, depth: number = 0) => {
    if (!item.path) return null;
    const isActive = isActivePath(item.path);

    return (
      <ListItemButton
        key={item.path}
        onClick={() => onNavigate(item.path!)}
        sx={{
          pl: 2 + depth * 2,
          pr: 1.5,
          py: 0.625,
          borderRadius: 1,
          mx: 0.75,
          my: 0.25,
          minHeight: 34,
          color: isActive
            ? theme.palette.primary.main
            : theme.palette.text.secondary,
          bgcolor: isActive
            ? isDark
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.primary.main, 0.08)
            : 'transparent',
          '&:hover': {
            bgcolor: isActive
              ? isDark
                ? alpha(theme.palette.primary.main, 0.18)
                : alpha(theme.palette.primary.main, 0.12)
              : isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        <ListItemIcon
          sx={{
            color: 'inherit',
            minWidth: 30,
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={t(item.text)}
          primaryTypographyProps={{
            fontSize: '0.8125rem',
            fontWeight: isActive ? 600 : 400,
            noWrap: true,
          }}
        />
        {item.badge && (
          <Badge
            badgeContent={item.badge}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem' } }}
          />
        )}
      </ListItemButton>
    );
  };

  // Render a menu item that has children (accordion)
  const renderParentItem = (
    item: NavMenuItem,
    index: number,
    siblings: NavMenuItem[]
  ) => {
    const submenuKey = `submenu-${index}`;
    const isExpanded = expandedSubmenus[submenuKey];
    const hasActive = item.children?.some(
      (child) => child.path && isActivePath(child.path)
    );

    return (
      <React.Fragment key={index}>
        {/* Divider before parent item if previous was a leaf */}
        {item.divider && <Divider sx={{ mx: 1.5, my: 0.5 }} />}

        <ListItemButton
          onClick={() =>
            onToggleSubmenu(
              submenuKey,
              siblings.map((_, i) => i)
            )
          }
          sx={{
            pl: 2,
            pr: 1.5,
            py: 0.625,
            borderRadius: 1,
            mx: 0.75,
            my: 0.25,
            minHeight: 34,
            color: hasActive
              ? theme.palette.text.primary
              : theme.palette.text.secondary,
            '&:hover': {
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: 'inherit',
              minWidth: 30,
              '& .MuiSvgIcon-root': { fontSize: 18 },
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={t(item.text)}
            primaryTypographyProps={{
              fontSize: '0.8125rem',
              fontWeight: hasActive ? 600 : 400,
              noWrap: true,
            }}
          />
          {isExpanded ? (
            <ExpandLess sx={{ fontSize: 18, opacity: 0.5 }} />
          ) : (
            <ExpandMore sx={{ fontSize: 18, opacity: 0.5 }} />
          )}
        </ListItemButton>

        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.children?.map((child) => renderLeafItem(child, 1))}
          </List>
        </Collapse>
      </React.Fragment>
    );
  };

  // Render a menu item (decides leaf vs parent)
  const renderMenuItem = (
    item: NavMenuItem,
    index: number,
    siblings: NavMenuItem[]
  ) => {
    if (item.children && item.children.length > 0) {
      return renderParentItem(item, index, siblings);
    }
    return (
      <React.Fragment key={index}>
        {item.divider && <Divider sx={{ mx: 1.5, my: 0.5 }} />}
        {renderLeafItem(item)}
      </React.Fragment>
    );
  };

  return (
    <Box
      sx={{
        width: isOpen ? SUBPANEL_WIDTH : 0,
        flexShrink: 0,
        height: '100vh',
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRight: isOpen ? `1px solid ${theme.palette.divider}` : 'none',
        bgcolor: theme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: theme.zIndex.drawer,
      }}
    >
      {/* Inner content wrapper - prevents content from being compressed */}
      <Box
        sx={{
          width: SUBPANEL_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header: Context Switcher + Close */}
        <Box
          sx={{
            height: 64,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            gap: 0.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SidebarContextSwitcher collapsed={false} />
          </Box>
          <Tooltip title={t('common.close')} placement="bottom" arrow>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                opacity: 0.5,
                '&:hover': { opacity: 1 },
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Scrollable area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            // Slim scrollbar
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              borderRadius: 2,
            },
          }}
        >
          {/* Recent Pages Section */}
          {recentPages.length > 0 && (
            <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
              <Box
                onClick={toggleRecentCollapsed}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 0.75,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeIcon
                    sx={{ fontSize: 11, color: 'text.disabled', opacity: 0.7 }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: 'text.disabled',
                      fontSize: '0.575rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {t('sidebar.recentPages')}
                  </Typography>
                  {recentCollapsed ? (
                    <ExpandMore
                      sx={{
                        fontSize: 13,
                        color: 'text.disabled',
                        opacity: 0.5,
                      }}
                    />
                  ) : (
                    <ExpandLess
                      sx={{
                        fontSize: 13,
                        color: 'text.disabled',
                        opacity: 0.5,
                      }}
                    />
                  )}
                </Box>
                <Tooltip title={t('sidebar.clearRecentPages')} arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearRecent();
                    }}
                    sx={{
                      p: 0.25,
                      opacity: 0.3,
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Collapse in={!recentCollapsed} timeout={200}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                    mt: 0.5,
                  }}
                >
                  {recentPages.map((page) => {
                    const isActive = isActivePath(page.path);
                    return (
                      <Box
                        key={page.path}
                        onClick={() => onNavigate(page.path, { skipRecentUpdate: true })}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '6px',
                          py: 0.5,
                          px: 1,
                          cursor: 'pointer',
                          color: isActive
                            ? theme.palette.primary.main
                            : theme.palette.text.secondary,
                          bgcolor: isActive
                            ? isDark
                              ? alpha(theme.palette.primary.main, 0.12)
                              : alpha(theme.palette.primary.main, 0.08)
                            : 'transparent',
                          transition: 'background-color 0.15s ease',
                          '&:hover': {
                            bgcolor: isActive
                              ? isDark
                                ? alpha(theme.palette.primary.main, 0.18)
                                : alpha(theme.palette.primary.main, 0.12)
                              : isDark
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(0,0,0,0.03)',
                            '& .recent-close': { opacity: 0.5 },
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: isActive ? 5 : 3,
                            height: isActive ? 5 : 3,
                            borderRadius: '50%',
                            bgcolor: isActive
                              ? theme.palette.primary.main
                              : isDark
                                ? 'rgba(255,255,255,0.15)'
                                : 'rgba(0,0,0,0.1)',
                            mr: 1,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="body2"
                          noWrap
                          title={
                            page.parentText
                              ? `${t(page.parentText)} / ${t(page.text)}`
                              : t(page.text)
                          }
                          sx={{
                            flex: 1,
                            fontSize: '0.75rem',
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {t(page.text)}
                        </Typography>
                        <IconButton
                          className="recent-close"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveRecent(page.path);
                          }}
                          sx={{
                            p: 0.15,
                            opacity: 0,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 10 }} />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>

              <Divider sx={{ mt: 0.75, opacity: 0.5 }} />
            </Box>
          )}

          {/* Category header + Menu items with slide-down animation */}
          {category && (
            <Box
              ref={menuContentRef}
            >
              <Box sx={{ px: 1.75, pt: 1.25, pb: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.disabled',
                    fontSize: '0.6rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {t(category.text)}
                </Typography>
              </Box>

              <List component="nav" disablePadding sx={{ pb: 1 }}>
                {category.children.map((item, index) =>
                  renderMenuItem(item, index, category.children)
                )}
              </List>
            </Box>
          )}
        </Box>

        {/* Quick Links - fixed at bottom, outside scroll area with bottom padding */}
        <Box sx={{ flexShrink: 0, pb: 2.5 }}>
          <Divider sx={{ mx: 1.5, opacity: 0.5 }} />
          <QuickLinksSection />
        </Box>
      </Box>
    </Box>
  );
};

export default NavigationSubPanel;
