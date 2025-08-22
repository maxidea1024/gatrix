import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Badge,
  Avatar,
  Divider,
  Collapse,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Widgets as WidgetsIcon,
  School as SchoolIcon,
  CardMembership as MembershipIcon,
  HelpOutline as HelpIcon,
  Receipt as InvoiceIcon,
  TableChart as TableIcon,
  Code as CodeIcon,
  Image as ImageIcon,
  Upload as UploadIcon,
  TextFields as TextIcon,
  Animation as AnimationIcon,
  Extension as ExtensionIcon,
  ExpandLess,
  ExpandMore,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  ShoppingCart as ShoppingCartIcon,
  Menu as MenuIcon,
  AccountCircle,
  Logout as LogoutIcon,
  Person as PersonIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Language as LanguageIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme as useCustomTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';

// Sidebar width is now dynamic

interface MainLayoutProps {
  children: React.ReactNode;
}

// 메뉴 데이터
const menuItems = [
  { text: 'sidebar.dashboard', icon: <DashboardIcon />, path: '/dashboard' },
];

const adminMenuItems = [
  { text: 'admin.dashboard.title', icon: <DashboardIcon />, path: '/admin/dashboard' },
  { text: 'admin.users.title', icon: <SchoolIcon />, path: '/admin/users' },
  { text: 'clientVersions.title', icon: <WidgetsIcon />, path: '/admin/client-versions' },
  { text: 'admin.gameWorlds.title', icon: <LanguageIcon />, path: '/admin/game-worlds' },
  { text: 'admin.whitelist.title', icon: <SecurityIcon />, path: '/admin/whitelist' },
  { text: 'navigation.auditLogs', icon: <HistoryIcon />, path: '/admin/audit-logs' },
];

const settingsMenuItems = [
  { text: 'settings.general.title', icon: <SettingsIcon />, path: '/settings' },
  // { text: 'advancedSettings.title', icon: <SettingsIcon />, path: '/settings/advanced', requireAdmin: true },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    admin: true,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { toggleTheme, mode, isDark } = useCustomTheme();
  const { t, i18n } = useTranslation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 400) {
      setSidebarWidth(newWidth);
      if (newWidth < 240) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    }
  }, [isResizing]);

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
    handleUserMenuClose();
  };

  const handleLogoutConfirm = async () => {
    setLogoutDialogOpen(false);
    await logout();
    navigate('/login');
  };

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isActivePath = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const renderMenuItem = (item: any, index: number) => {
    const menuButton = (
      <ListItemButton
        key={index}
        onClick={() => navigate(item.path)}
        sx={{
          color: isActivePath(item.path) ? '#ffffff' : '#cbd5e1',
          backgroundColor: isActivePath(item.path) ? 'rgba(91, 106, 208, 0.2)' : 'transparent',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          px: sidebarCollapsed ? 1 : 2,
        }}
      >
        <ListItemIcon sx={{
          color: 'inherit',
          minWidth: sidebarCollapsed ? 'auto' : 40,
          justifyContent: 'center'
        }}>
          {item.icon}
        </ListItemIcon>
        {!sidebarCollapsed && (
          <>
            <ListItemText
              primary={t(item.text)}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
            />
            {item.badge && (
              <Badge
                badgeContent={item.badge}
                color={item.badge === 'New' ? 'secondary' : 'primary'}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
              />
            )}
          </>
        )}
      </ListItemButton>
    );

    // 사이드바가 접혀있을 때만 툴팁 표시
    if (sidebarCollapsed) {
      return (
        <Tooltip
          key={index}
          title={t(item.text)}
          placement="right"
          arrow
        >
          {menuButton}
        </Tooltip>
      );
    }

    return menuButton;
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 로고 영역 */}
      <Box sx={{
        p: sidebarCollapsed ? 2 : 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
      }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            backgroundColor: '#5b6ad0',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: sidebarCollapsed ? 0 : 2
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            G
          </Typography>
        </Box>
        {!sidebarCollapsed && (
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Gate
          </Typography>
        )}
      </Box>
      
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      
      {/* 메뉴 영역 */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <List sx={{ px: 1, flexGrow: 1 }}>
        {/* 기본 메뉴 */}
        {!sidebarCollapsed && (
          <Typography
            variant="overline"
            sx={{
              px: 2,
              py: 1,
              color: '#94a3b8',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.05em'
            }}
          >
            {t('sidebar.navigation')}
          </Typography>
        )}
        {menuItems.map((item, index) => renderMenuItem(item, index))}
        
        {/* 관리자 메뉴 */}
        {isAdmin() && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
            {!sidebarCollapsed && (
              <ListItemButton
                onClick={() => toggleSection('admin')}
                sx={{
                  color: '#94a3b8',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                <ListItemText
                  primary={t('sidebar.adminPanel')}
                  primaryTypographyProps={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                />
                {expandedSections.admin ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            )}
            {sidebarCollapsed && (
              <Box sx={{ px: 1, py: 0.5 }}>
                {adminMenuItems.map((item, index) => renderMenuItem(item, index))}
              </Box>
            )}
            {!sidebarCollapsed && (
              <Collapse in={expandedSections.admin} timeout="auto" unmountOnExit>
                {adminMenuItems.map((item, index) => (
                  <ListItemButton
                    key={index}
                    onClick={() => navigate(item.path)}
                    sx={{
                      pl: 4,
                      color: isActivePath(item.path) ? '#ffffff' : '#cbd5e1',
                      backgroundColor: isActivePath(item.path) ? 'rgba(91, 106, 208, 0.2)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={t(item.text)}
                      primaryTypographyProps={{ fontSize: '0.875rem' }}
                    />
                  </ListItemButton>
                ))}
              </Collapse>
            )}

            {/* Settings Panel */}
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
            {!sidebarCollapsed && (
              <ListItemButton
                onClick={() => toggleSection('settings')}
                sx={{
                  color: '#94a3b8',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                <ListItemText
                  primary={t('sidebar.settingsPanel')}
                  primaryTypographyProps={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                />
                {expandedSections.settings ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            )}
            {sidebarCollapsed && (
              <Box sx={{ px: 1, py: 0.5 }}>
                {settingsMenuItems
                  .filter(item => !item.requireAdmin || user?.role === 'admin')
                  .map((item, index) => renderMenuItem(item, index))}
              </Box>
            )}
            {!sidebarCollapsed && (
              <Collapse in={expandedSections.settings} timeout="auto" unmountOnExit>
                {settingsMenuItems
                  .filter(item => !item.requireAdmin || user?.role === 'admin')
                  .map((item, index) => (
                  <ListItemButton
                    key={index}
                    onClick={() => navigate(item.path)}
                    sx={{
                      pl: 4,
                      color: isActivePath(item.path) ? '#ffffff' : '#cbd5e1',
                      backgroundColor: isActivePath(item.path) ? 'rgba(91, 106, 208, 0.2)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={t(item.text)}
                      primaryTypographyProps={{ fontSize: '0.875rem' }}
                    />
                  </ListItemButton>
                ))}
              </Collapse>
            )}
          </>
        )}
        </List>

        {/* 토글 버튼 영역 */}
        <Box sx={{ mt: 'auto' }}>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)', my: 1 }} />
          <ListItemButton
            onClick={handleSidebarToggle}
            sx={{
              color: '#94a3b8',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              px: sidebarCollapsed ? 1 : 2,
            }}
          >
            <ListItemIcon sx={{
              color: 'inherit',
              minWidth: sidebarCollapsed ? 'auto' : 40,
              justifyContent: 'center'
            }}>
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </ListItemIcon>
            {!sidebarCollapsed && (
              <ListItemText
                primary={sidebarCollapsed ? t('common.expand') : t('common.collapse')}
                primaryTypographyProps={{ fontSize: '0.875rem' }}
              />
            )}
          </ListItemButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* 상단 바 */}
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: '#1e293b',
          color: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          borderBottom: 'none',
        }}
      >
        <Toolbar sx={{
          justifyContent: 'space-between',
          pl: {
            xs: 2,
            md: 2
          },
          transition: 'padding-left 0.3s ease',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: '#5b6ad0',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1
                }}
              >
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                  G
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#ffffff' }}>
                Gate Platform
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={toggleTheme} color="inherit">
              {isDark ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>

            <IconButton color="inherit">
              <Badge badgeContent={4} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            <IconButton
              onClick={handleUserMenuOpen}
              color="inherit"
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: 'primary.main',
                  fontSize: '0.875rem'
                }}
              >
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>

            <LanguageSelector variant="text" size="medium" />
            
            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={handleUserMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={() => { navigate('/profile'); handleUserMenuClose(); }}>
                <PersonIcon sx={{ mr: 1 }} />
                {t('sidebar.profile')}
              </MenuItem>
              <MenuItem onClick={handleLogoutClick}>
                <LogoutIcon sx={{ mr: 1 }} />
                {t('sidebar.logout')}
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* 사이드바 */}
      <Box
        component="nav"
        sx={{
          width: { md: sidebarCollapsed ? 64 : sidebarWidth },
          flexShrink: { md: 0 },
          transition: 'width 0.3s ease',
          position: 'fixed',
          height: '100vh',
          zIndex: (theme) => theme.zIndex.drawer,
        }}
      >
        {/* 모바일 드로어 */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 280,
              backgroundColor: '#1e293b',
              color: '#ffffff',
              borderRight: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
        
        {/* 데스크톱 드로어 */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: sidebarCollapsed ? 64 : sidebarWidth,
              backgroundColor: '#1e293b',
              color: '#ffffff',
              borderRight: 'none',
              transition: 'width 0.3s ease',
              position: 'relative',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
          open
        >
          {drawerContent}
          {/* 리사이즈 핸들 */}
          {!sidebarCollapsed && (
            <Box
              onMouseDown={handleMouseDown}
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 4,
                height: '100%',
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
                zIndex: 1000,
              }}
            />
          )}
        </Drawer>
      </Box>
      
      {/* 메인 컨텐츠 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pl: {
            xs: 3,
            md: `${(sidebarCollapsed ? 64 : sidebarWidth) + 24}px`
          },
          mt: 8, // AppBar height
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: 'background.default',
          width: '100%',
          maxWidth: '100%',
          transition: 'padding-left 0.3s ease',
        }}
      >
        {children}
      </Box>

      {/* 로그아웃 확인 다이얼로그 */}
      <Dialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
      >
        <DialogTitle id="logout-dialog-title">
          {t('auth.confirmLogout')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="logout-dialog-description">
            {t('auth.confirmLogoutMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogoutCancel} color="primary">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleLogoutConfirm} color="primary" variant="contained">
            {t('auth.logout')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
