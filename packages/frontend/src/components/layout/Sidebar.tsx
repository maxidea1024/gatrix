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
  BugReport,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { NavItem } from '@/types';
import { useTranslation } from 'react-i18next';


interface SidebarProps {
  open: boolean;
  onClose: () => void;
  width: number;
}

// Navigation configuration
const getNavigationItems = (isAdmin: boolean): NavItem[] => {
  const baseItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'sidebar.dashboard',
      icon: 'Dashboard',
      path: '/dashboard',
    },
    {
      id: 'chat',
      label: 'sidebar.chat',
      icon: 'Chat',
      path: '/chat',
    },


  ];

  const adminItems: NavItem[] = [
    {
      id: 'users',
      label: 'sidebar.userManagement',
      icon: 'People',
      path: '/users',
      roles: ['admin'],
    },
    {
      id: 'audit-logs',
      label: 'sidebar.auditLogs',
      icon: 'Security',
      path: '/admin/audit-logs',
      roles: ['admin'],
    },
    {
      id: 'crashes',
      label: 'sidebar.crashes',
      icon: 'BugReport',
      path: '/admin/crashes',
      roles: ['admin'],
    },
    {
      id: 'admin',
      label: 'navigation.administration',
      icon: 'AdminPanelSettings',
      roles: ['admin'],
      children: [
        {
          id: 'system-stats',
          label: 'sidebar.systemStats',
          icon: 'Assessment',
          path: '/admin/stats',
          roles: ['admin'],
        },
        {
          id: 'api-tokens',
          label: 'sidebar.apiTokens',
          icon: 'VpnKey',
          path: '/admin/api-tokens',
          roles: ['admin'],
        },
      ],
    },
    {
      id: 'remote-config',
      label: 'sidebar.remoteConfig',
      icon: 'CloudSync',
      path: '/admin/remote-config',
      roles: ['admin'],
    },
    {
      id: 'settings',
      label: 'sidebar.settings',
      icon: 'Settings',
      path: '/settings',
      roles: ['admin'],
    },
  ];

  const result = isAdmin ? [...baseItems, ...adminItems] : baseItems;
  console.log('getNavigationItems - isAdmin:', isAdmin, 'result:', result);
  return result;
};

// Icon mapping
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
};

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose, width }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const location = useLocation();
  const { user, isAdmin } = useAuth();

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const navigationItems = getNavigationItems(isAdmin());

  const handleItemClick = (item: NavItem) => {
    if (item.path) {
      navigate(item.path);
      onClose(); // Close sidebar on mobile after navigation
    } else if (item.children) {
      // Toggle expansion for items with children
      setExpandedItems(prev =>
        prev.includes(item.id)
          ? prev.filter(id => id !== item.id)
          : [...prev, item.id]
      );
    }
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.children) {
      return item.children.some(child => child.path === location.pathname);
    }
    return false;
  };

  const isItemExpanded = (item: NavItem): boolean => {
    return expandedItems.includes(item.id);
  };

  const canAccessItem = (item: NavItem): boolean => {
    if (!item.roles || item.roles.length === 0) {
      return true;
    }
    const hasAccess = item.roles.includes(user?.role || '');
    console.log(`canAccessItem - item: ${item.id}, userRole: ${user?.role}, itemRoles:`, item.roles, 'hasAccess:', hasAccess);
    return hasAccess;
  };

  const renderNavItem = (item: NavItem, level: number = 0) => {
    if (!canAccessItem(item)) {
      return null;
    }

    const isActive = isItemActive(item);
    const isExpanded = isItemExpanded(item);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding sx={{ pl: level * 2 }}>
          <ListItemButton
            selected={isActive}
            onClick={() => handleItemClick(item)}
            sx={{
              minHeight: 48,
              borderRadius: 1,
              mx: 1,
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
              {iconMap[item.icon || 'Dashboard']}
            </ListItemIcon>
            <ListItemText
              primary={t(item.label)}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
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
              {item.children!.map(child => renderNavItem(child, level + 1))}
            </List>
          </Collapse>
        )}
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
        <List>
          {navigationItems.map(item => renderNavItem(item))}
        </List>
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
  const { user, isAdmin } = useAuth();

  const { t } = useTranslation();

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const navigationItems = getNavigationItems(isAdmin());

  const handleItemClick = (item: NavItem) => {
    if (item.path) {
      navigate(item.path);
    } else if (item.children) {
      setExpandedItems(prev =>
        prev.includes(item.id)
          ? prev.filter(id => id !== item.id)
          : [...prev, item.id]
      );
    }
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.children) {
      return item.children.some(child => child.path === location.pathname);
    }
    return false;
  };

  const isItemExpanded = (item: NavItem): boolean => {
    return expandedItems.includes(item.id);
  };

  const canAccessItem = (item: NavItem): boolean => {
    if (!item.roles || item.roles.length === 0) {
      return true;
    }
    return item.roles.includes(user?.role || '');
  };

  const renderNavItem = (item: NavItem, level: number = 0) => {
    if (!canAccessItem(item)) {
      return null;
    }

    const isActive = isItemActive(item);
    const isExpanded = isItemExpanded(item);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding sx={{ pl: level * 2 }}>
          <ListItemButton
            selected={isActive}
            onClick={() => handleItemClick(item)}
            sx={{
              minHeight: 48,
              borderRadius: 1,
              mx: 1,
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
              {iconMap[item.icon || 'Dashboard']}
            </ListItemIcon>
            <ListItemText
              primary={t(item.label)}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
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
              {item.children!.map(child => renderNavItem(child, level + 1))}
            </List>
          </Collapse>
        )}
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
        <List>
          {navigationItems.map(item => renderNavItem(item))}
        </List>
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
