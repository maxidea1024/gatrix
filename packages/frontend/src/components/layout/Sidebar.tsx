import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Collapse,
  Box,
  Typography,
} from '@mui/material';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import {
  Dashboard,
  People,
  Person,
  Settings,
  ExpandLess,
  ExpandMore,
  AdminPanelSettings,
  Assessment,
  Security,
  CloudSync,
  History,
  VpnKey,
  Chat,
  Mail,
  BugReport,
  Timeline,
  Terminal,
  Widgets,
  Language,
  Build,
  TextFields,
  Schedule,
  Work,
  Monitor,
  Label,
  CardGiftcard,
  Campaign,
  ConfirmationNumber,
  Poll,
  SportsEsports,
  Storage,
  Event,
  Whatshot,
  Celebration,
  Dns,
  Api,
  Notifications,
  Announcement,
  Insights,
  Folder,
  ViewCarousel,
  Layers,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getMenuCategories, MenuItem, MenuCategory } from '@/config/navigation';
import { Permission } from '@/types/permissions';


interface SidebarProps {
  open: boolean;
  onClose: () => void;
  width: number;
}

// Icon mapping - must include all icons used in navigation.tsx
const iconMap: Record<string, React.ReactElement> = {
  Dashboard: <Dashboard />,
  People: <People />,
  Person: <Person />,
  Settings: <Settings />,
  AdminPanelSettings: <AdminPanelSettings />,
  Assessment: <Assessment />,
  Security: <Security />,
  CloudSync: <CloudSync />,
  History: <History />,
  VpnKey: <VpnKey />,
  BugReport: <BugReport />,
  Chat: <Chat />,
  Mail: <Mail />,
  Timeline: <Timeline />,
  Terminal: <Terminal />,
  Widgets: <Widgets />,
  Language: <Language />,
  Build: <Build />,
  TextFields: <TextFields />,
  Schedule: <Schedule />,
  Work: <Work />,
  Monitor: <Monitor />,
  Label: <Label />,
  CardGiftcard: <CardGiftcard />,
  Campaign: <Campaign />,
  ConfirmationNumber: <ConfirmationNumber />,
  Poll: <Poll />,
  SportsEsports: <SportsEsports />,
  Storage: <Storage />,
  Event: <Event />,
  Whatshot: <Whatshot />,
  Celebration: <Celebration />,
  Dns: <Dns />,
  Api: <Api />,
  Notifications: <Notifications />,
  Announcement: <Announcement />,
  Insights: <Insights />,
  Folder: <Folder />,
  ViewCarousel: <ViewCarousel />,
  Layers: <Layers />,
};

// Helper to get icon name from React element
const getIconName = (icon: React.ReactElement): string => {
  const typeName = (icon.type as any)?.type?.render?.displayName ||
                   (icon.type as any)?.displayName ||
                   (icon.type as any)?.name ||
                   'Dashboard';
  return typeName.replace('Icon', '');
};

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose, width }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const location = useLocation();
  const { user, isAdmin, hasPermission } = useAuth();
  const { environments, isLoading: environmentsLoading } = useEnvironment();

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  // Admin users without any environment access should see only base menu (like regular users)
  const hasEnvironmentAccess = environmentsLoading || environments.length > 0;
  const effectiveIsAdmin = isAdmin() && hasEnvironmentAccess;
  const menuCategories = getMenuCategories(effectiveIsAdmin);

  // Debug logging - will be removed after fix is confirmed
  React.useEffect(() => {
    console.log('[Sidebar] Debug state:', {
      isAdmin: isAdmin(),
      environmentsLoading,
      environmentsCount: environments.length,
      hasEnvironmentAccess,
      effectiveIsAdmin,
      menuCategoriesCount: menuCategories.length,
      menuCategoryIds: menuCategories.map(c => c.id),
    });
  }, [isAdmin, environmentsLoading, environments.length, hasEnvironmentAccess, effectiveIsAdmin, menuCategories]);

  const handleItemClick = (item: MenuItem) => {
    if (item.path) {
      // Open external links in a new tab
      if (/^https?:\/\//i.test(item.path)) {
        window.open(item.path, '_blank', 'noopener,noreferrer');
        onClose();
        return;
      }
      navigate(item.path);
      onClose(); // Close sidebar on mobile after navigation
    } else if (item.children) {
      // Toggle expansion for items with children
      const itemId = item.text;
      setExpandedItems(prev =>
        prev.includes(itemId)
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      );
    }
  };

  const isItemActive = (item: MenuItem): boolean => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.children) {
      return false;
    }
    return false;
  };

  const hasActiveChild = (item: MenuItem): boolean => {
    if (!item.children) {
      return false;
    }
    return item.children.some(child => {
      if (child.path === location.pathname) {
        return true;
      }
      return hasActiveChild(child);
    });
  };

  const isItemExpanded = (item: MenuItem): boolean => {
    return expandedItems.includes(item.text);
  };

  // Check if user can access a menu item based on permissions
  const canAccessItem = (item: MenuItem): boolean => {
    // Check admin-only restriction
    if (item.adminOnly && !effectiveIsAdmin) {
      console.log(`[Sidebar] ${item.text} - adminOnly but not effectiveIsAdmin`);
      return false;
    }

    // Check permission-based access
    if (item.requiredPermission) {
      const permissions = Array.isArray(item.requiredPermission)
        ? item.requiredPermission
        : [item.requiredPermission];
      const result = hasPermission(permissions as Permission[]);
      console.log(`[Sidebar] ${item.text} - requiredPermission: ${JSON.stringify(permissions)}, hasPermission: ${result}`);
      return result;
    }

    console.log(`[Sidebar] ${item.text} - no requiredPermission, returning true`);
    return true;
  };

  // Filter menu items based on permissions
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.filter(item => {
      if (!canAccessItem(item)) {
        return false;
      }
      // If item has children, filter them too
      if (item.children) {
        const filteredChildren = filterMenuItems(item.children);
        // Only show parent if it has accessible children
        return filteredChildren.length > 0;
      }
      return true;
    }).map(item => {
      if (item.children) {
        return { ...item, children: filterMenuItems(item.children) };
      }
      return item;
    });
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = isItemActive(item);
    const isExpanded = isItemExpanded(item);
    const hasChildren = item.children && item.children.length > 0;
    const childActive = hasActiveChild(item);
    const iconName = getIconName(item.icon);

    return (
      <React.Fragment key={item.text}>
        {item.divider && <Divider sx={{ my: 1 }} />}

        <ListItem disablePadding sx={{ pl: level * 2 }}>
          <ListItemButton
            selected={isActive && !hasChildren}
            onClick={() => handleItemClick(item)}
            sx={{
              minHeight: 48,
              borderRadius: 1,
              mx: 1,
              backgroundColor: childActive && hasChildren ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {iconMap[iconName] || item.icon}
            </ListItemIcon>
            <ListItemText
              primary={t(item.text)}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: isActive || childActive ? 600 : 400,
              }}
            />
            {hasChildren && (
              isExpanded ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const renderCategory = (category: MenuCategory) => {
    const filteredItems = filterMenuItems(category.children);
    if (filteredItems.length === 0) {
      return null;
    }

    return (
      <React.Fragment key={category.id}>
        <Typography
          variant="overline"
          sx={{
            px: 3,
            pt: 2,
            pb: 1,
            display: 'block',
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          {t(category.text)}
        </Typography>
        <List disablePadding>
          {filteredItems.map(item => renderMenuItem(item))}
        </List>
      </React.Fragment>
    );
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AdminPanelSettings color="primary" />
          <Typography variant="h6" noWrap component="div">
            {t('sidebar.adminPanel')}
          </Typography>
        </Box>
      </Toolbar>

      <Divider />

      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {menuCategories.map(category => renderCategory(category))}
      </Box>

      {user && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('common.loggedInAs')}
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {user.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
      sx={{
        display: { xs: 'block', sm: 'none' },
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: width,
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

// Desktop sidebar (permanent)
export const DesktopSidebar: React.FC<{ width: number }> = ({ width }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, hasPermission } = useAuth();
  const { environments, isLoading: environmentsLoading } = useEnvironment();

  const { t } = useTranslation();

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  // Admin users without any environment access should see only base menu (like regular users)
  const hasEnvironmentAccess = environmentsLoading || environments.length > 0;
  const effectiveIsAdmin = isAdmin() && hasEnvironmentAccess;
  const menuCategories = getMenuCategories(effectiveIsAdmin);

  const handleItemClick = (item: MenuItem) => {
    if (item.path) {
      if (/^https?:\/\//i.test(item.path)) {
        window.open(item.path, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(item.path);
    } else if (item.children) {
      const itemId = item.text;
      setExpandedItems(prev =>
        prev.includes(itemId)
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      );
    }
  };

  const isItemActive = (item: MenuItem): boolean => {
    if (item.path) {
      return location.pathname === item.path;
    }
    return false;
  };

  const hasActiveChild = (item: MenuItem): boolean => {
    if (!item.children) {
      return false;
    }
    return item.children.some(child => {
      if (child.path === location.pathname) {
        return true;
      }
      return hasActiveChild(child);
    });
  };

  const isItemExpanded = (item: MenuItem): boolean => {
    return expandedItems.includes(item.text);
  };

  const canAccessItem = (item: MenuItem): boolean => {
    if (item.adminOnly && !effectiveIsAdmin) {
      return false;
    }
    if (item.requiredPermission) {
      const permissions = Array.isArray(item.requiredPermission)
        ? item.requiredPermission
        : [item.requiredPermission];
      return hasPermission(permissions as Permission[]);
    }
    return true;
  };

  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.filter(item => {
      if (!canAccessItem(item)) {
        return false;
      }
      if (item.children) {
        const filteredChildren = filterMenuItems(item.children);
        return filteredChildren.length > 0;
      }
      return true;
    }).map(item => {
      if (item.children) {
        return { ...item, children: filterMenuItems(item.children) };
      }
      return item;
    });
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = isItemActive(item);
    const isExpanded = isItemExpanded(item);
    const hasChildren = item.children && item.children.length > 0;
    const childActive = hasActiveChild(item);
    const iconName = getIconName(item.icon);

    return (
      <React.Fragment key={item.text}>
        {item.divider && <Divider sx={{ my: 1 }} />}

        <ListItem disablePadding sx={{ pl: level * 2 }}>
          <ListItemButton
            selected={isActive && !hasChildren}
            onClick={() => handleItemClick(item)}
            sx={{
              minHeight: 48,
              borderRadius: 1,
              mx: 1,
              backgroundColor: childActive && hasChildren ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {iconMap[iconName] || item.icon}
            </ListItemIcon>
            <ListItemText
              primary={t(item.text)}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: isActive || childActive ? 600 : 400,
              }}
            />
            {hasChildren && (
              isExpanded ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const renderCategory = (category: MenuCategory) => {
    const filteredItems = filterMenuItems(category.children);
    if (filteredItems.length === 0) {
      return null;
    }

    return (
      <React.Fragment key={category.id}>
        <Typography
          variant="overline"
          sx={{
            px: 3,
            pt: 2,
            pb: 1,
            display: 'block',
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          {t(category.text)}
        </Typography>
        <List disablePadding>
          {filteredItems.map(item => renderMenuItem(item))}
        </List>
      </React.Fragment>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', sm: 'block' },
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: width,
        },
      }}
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AdminPanelSettings color="primary" />
          <Typography variant="h6" noWrap component="div">
            {t('sidebar.adminPanel')}
          </Typography>
        </Box>
      </Toolbar>

      <Divider />

      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {menuCategories.map(category => renderCategory(category))}
      </Box>

      {user && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('common.loggedInAs')}
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {user.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        </>
      )}
    </Drawer>
  );
};
