import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Build as BuildIcon,
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
  Label as LabelIcon,
  Schedule as ScheduleIcon,
  Work as JobIcon,
  Monitor as MonitorIcon,
  CloudSync as CloudSyncIcon,
  VpnKey as VpnKeyIcon,
  Chat as ChatIcon,
  BugReport as BugReportIcon,

} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme as useCustomTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import TimezoneSelector from '../common/TimezoneSelector';
import { maintenanceService, MaintenanceDetail } from '@/services/maintenanceService';
import { useSSENotifications } from '@/hooks/useSSENotifications';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import moment from 'moment';

// Sidebar width is now dynamic

interface MainLayoutProps {
  children: React.ReactNode;
}

// 메뉴 데이터
const menuItems = [
  { text: 'sidebar.dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'sidebar.chat', icon: <ChatIcon />, path: '/chat' },
];

const adminMenuItems = [
  { text: 'admin.users.title', icon: <SchoolIcon />, path: '/admin/users' },
  { text: 'clientVersions.title', icon: <WidgetsIcon />, path: '/admin/client-versions' },
  { text: 'admin.gameWorlds.title', icon: <LanguageIcon />, path: '/admin/game-worlds' },
  { text: 'admin.maintenance.title', icon: <BuildIcon />, path: '/admin/maintenance' },
  { text: 'admin.messageTemplates.title', icon: <TextIcon />, path: '/admin/maintenance-templates' },
  { text: 'admin.scheduler.title', icon: <ScheduleIcon />, path: '/admin/scheduler' },

  { text: 'jobs.title', icon: <JobIcon />, path: '/admin/jobs' },
  { text: 'jobs.monitor', icon: <MonitorIcon />, path: '/admin/queue-monitor' },
  { text: 'admin.whitelist.title', icon: <SecurityIcon />, path: '/admin/whitelist' },
  { text: 'navigation.auditLogs', icon: <HistoryIcon />, path: '/admin/audit-logs' },
  { text: 'admin.crashes.title', icon: <BugReportIcon />, path: '/admin/crashes' },
  {
    text: 'admin.remoteConfig.title',
    icon: <CloudSyncIcon />,
    path: '/admin/remote-config'
  },
  {
    text: 'apiTokens.title',
    icon: <VpnKeyIcon />,
    path: '/admin/api-tokens'
  },
];

const settingsMenuItems = [
  { text: 'settings.general.title', icon: <SettingsIcon />, path: '/settings' },
  { text: 'tags.title', icon: <LabelIcon />, path: '/settings/tags', requireAdmin: true },
  // { text: 'advancedSettings.title', icon: <SettingsIcon />, path: '/settings/advanced', requireAdmin: true },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    admin: true,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { toggleTheme, mode, isDark } = useCustomTheme();
  const { t, i18n } = useTranslation();

  // Maintenance banner state
  const [maintenanceStatus, setMaintenanceStatus] = useState<{ active: boolean; detail: MaintenanceDetail | null }>({ active: false, detail: null });

  // 점검 배너 높이 계산
  const bannerHeight = useMemo(() => {
    if (!maintenanceStatus.active) return 0;

    // 기본 높이: 패딩(8px * 2) + 메인 텍스트 라인(24px) = 40px
    // 시간 정보가 있을 때: 추가로 시간 텍스트 라인(18px) + 여백(4px) = 22px
    const baseHeight = 40;
    const hasTimeInfo = maintenanceStatus.detail?.startsAt || maintenanceStatus.detail?.endsAt;
    return hasTimeInfo ? baseHeight + 22 : baseHeight;
  }, [maintenanceStatus.active, maintenanceStatus.detail?.startsAt, maintenanceStatus.detail?.endsAt]);
  // If SSE already updated the status, avoid overwriting with initial fetch result
  const maintenanceUpdatedBySSE = useRef(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    maintenanceService.getStatus().then(({ isUnderMaintenance, detail }) => {
      if (cancelled) return;
      if (maintenanceUpdatedBySSE.current) return; // keep SSE-updated status
      setMaintenanceStatus({ active: !!isUnderMaintenance, detail: detail || null });
    }).catch(() => {
      if (cancelled) return;
      if (maintenanceUpdatedBySSE.current) return;
      setMaintenanceStatus({ active: false, detail: null });
    });
    return () => { cancelled = true; };
  }, []);

  // SSE updates - 백엔드 연결 실패 시 적절히 처리
  const sseConnection = useSSENotifications({
    autoConnect: true, // 자동 연결 활성화
    maxReconnectAttempts: 3, // 재연결 시도 횟수 줄임
    reconnectInterval: 10000, // 재연결 간격 늘림 (10초)
    onEvent: (event) => {
      if (event.type === 'maintenance_status_change') {
        const { isUnderMaintenance, detail } = event.data || {};
        maintenanceUpdatedBySSE.current = true;
        setMaintenanceStatus({ active: !!isUnderMaintenance, detail: detail || null });
      }
    },
    onError: (error) => {
      console.warn('SSE connection error in MainLayout:', error);
    }
  });

  // 사용자가 변경될 때마다 아바타 이미지 에러 상태 초기화
  useEffect(() => {
    setAvatarImageError(false);
  }, [user?.avatarUrl]);

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
    navigate('/logout');
    handleUserMenuClose();
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isActivePath = (path: string) => {
    // 정확한 경로 매칭을 위해 수정
    if (location.pathname === path) {
      return true;
    }
    // 하위 경로인 경우에만 true (단, 정확히 '/'로 구분되는 경우만)
    if (path !== '/' && location.pathname.startsWith(path + '/')) {
      return true;
    }
    return false;
  };

  // 설정 메뉴 전용 활성화 체크 (정확한 매칭만)
  const isActiveSettingsPath = (path: string) => {
    return location.pathname === path;
  };

  const renderMenuItem = (item: any, index: number) => {
    const isAdminItem = typeof index === 'string' && index.startsWith('admin-');
    // 설정 메뉴 항목인지 확인
    const isSettingsItem = settingsMenuItems.some(settingsItem => settingsItem.path === item.path);

    // 서브메뉴가 있는 경우
    if (item.children) {
      const isExpanded = expandedSections[`menu-${index}`];
      const hasActiveChild = item.children.some((child: any) => isActivePath(child.path));

      const menuButton = (
        <ListItemButton
          key={index}
          onClick={() => toggleSection(`menu-${index}`)}
          sx={{
            color: hasActiveChild ? '#ffffff' : '#cbd5e1',
            backgroundColor: hasActiveChild ? 'rgba(91, 106, 208, 0.2)' : 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            px: sidebarCollapsed ? 1 : 2,
            pl: isAdminItem ? 4 : (sidebarCollapsed ? 1 : 2),
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
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </>
          )}
        </ListItemButton>
      );

      if (sidebarCollapsed) {
        return (
          <Tooltip
            key={index}
            title={t(item.text)}
            placement="right"
            arrow
          >
            <Box sx={{ px: 1, py: 0.5 }}>
              {item.children.map((child: any, childIndex: number) => renderMenuItem(child, `${index}-${childIndex}`))}
            </Box>
          </Tooltip>
        );
      }

      return (
        <React.Fragment key={index}>
          {menuButton}
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children.map((child: any, childIndex: number) => (
                <ListItemButton
                  key={childIndex}
                  onClick={() => navigate(child.path)}
                  sx={{
                    pl: 4,
                    color: isActivePath(child.path) ? '#ffffff' : '#cbd5e1',
                    backgroundColor: isActivePath(child.path) ? 'rgba(91, 106, 208, 0.2)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    color: 'inherit',
                    minWidth: 40,
                    justifyContent: 'center'
                  }}>
                    {child.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={t(child.text)}
                    primaryTypographyProps={{ fontSize: '0.875rem' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </React.Fragment>
      );
    }

    // 일반 메뉴 아이템
    const menuButton = (
      <ListItemButton
        key={index}
        onClick={() => navigate(item.path)}
        sx={{
          color: (isSettingsItem ? isActiveSettingsPath(item.path) : isActivePath(item.path)) ? '#ffffff' : '#cbd5e1',
          backgroundColor: (isSettingsItem ? isActiveSettingsPath(item.path) : isActivePath(item.path)) ? 'rgba(91, 106, 208, 0.2)' : 'transparent',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          px: sidebarCollapsed ? 1 : 2,
          pl: isAdminItem ? 4 : (sidebarCollapsed ? 1 : 2),
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
      {/* 사이드바에서는 로고 제거 - AppBar에만 표시 */}

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
                <List component="div" disablePadding>
                  {adminMenuItems.map((item, index) => renderMenuItem(item, `admin-${index}`))}
                </List>
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
                      color: isActiveSettingsPath(item.path) ? '#ffffff' : '#cbd5e1',
                      backgroundColor: isActiveSettingsPath(item.path) ? 'rgba(91, 106, 208, 0.2)' : 'transparent',
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
          zIndex: (theme) => theme.zIndex.drawer + 2,
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

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                },
                borderRadius: 1,
                px: 1,
                py: 0.5,
                transition: 'background-color 0.2s ease'
              }}
              onClick={() => navigate('/dashboard')}
            >
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
                Gatrix
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimezoneSelector />

            {/* 구분선 */}
            <Box
              sx={{
                width: '1px',
                height: '24px',
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                mx: 1
              }}
            />

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
              {user?.avatarUrl && !avatarImageError ? (
                <Avatar
                  src={user.avatarUrl}
                  alt={user.name || user.email}
                  sx={{
                    width: 32,
                    height: 32,
                  }}
                  onError={() => {
                    // 이미지 로드 실패 시 AccountCircle 아이콘으로 대체
                    setAvatarImageError(true);
                  }}
                >
                  {user?.name?.charAt(0) || user?.email?.charAt(0)}
                </Avatar>
              ) : (
                <AccountCircle
                  sx={{
                    width: 32,
                    height: 32,
                    color: 'inherit'
                  }}
                />
              )}
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
      {/* Maintenance banner (full-width under AppBar) */}
      {maintenanceStatus.active && (
        <Box sx={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          minHeight: `${bannerHeight}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 1,
          color: '#fff',
          fontWeight: 700,
          background: (theme) => theme.palette.mode === 'dark'
            ? 'linear-gradient(90deg, #d32f2f, #f44336, #d32f2f)'
            : 'linear-gradient(90deg, #ff4d4f, #ff7875, #ff4d4f)',
          backgroundSize: '200% 100%',

          boxShadow: (theme) => theme.palette.mode === 'dark'
            ? '0 2px 8px rgba(211,47,47,0.4)'
            : '0 2px 8px rgba(255,77,79,0.3)',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          animation: 'maintenancePulse 2s ease-in-out infinite',
          '@keyframes maintenancePulse': {
            '0%': {
              backgroundPosition: '0% 50%',
            },
            '50%': {
              backgroundPosition: '100% 50%',
            },
            '100%': {
              backgroundPosition: '0% 50%',
            }
          }
        }}>
          {/* 점검 상태 및 유형 */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
              🔧 {t('common.maintenance.bannerActive')}
            </Typography>
            {maintenanceStatus.detail?.type && (
              <Typography variant="body2" sx={{
                fontSize: '0.8rem',
                opacity: 0.9,
                backgroundColor: 'rgba(255,255,255,0.2)',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600
              }}>
                {t(`admin.maintenance.types.${maintenanceStatus.detail.type}`)}
              </Typography>
            )}
          </Box>

          {/* 점검 기간 */}
          {(maintenanceStatus.detail?.startsAt || maintenanceStatus.detail?.endsAt) && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.75rem', fontWeight: 600 }}>
                📅 {t('admin.maintenance.maintenancePeriodLabel')}: {(() => {
                  const start = maintenanceStatus.detail?.startsAt;
                  const end = maintenanceStatus.detail?.endsAt;
                  if (start && end) {
                    return `${formatDateTimeDetailed(start)} ~ ${formatDateTimeDetailed(end)}`;
                  } else if (start) {
                    return `${formatDateTimeDetailed(start)} ${t('admin.maintenance.start')}`;
                  } else if (end) {
                    return `${formatDateTimeDetailed(end)} ${t('admin.maintenance.stop')}`;
                  }
                  return t('admin.maintenance.immediateStartLabel');
                })()}
              </Typography>
            </Box>
          )}

          {/* 점검 메시지 */}
          {maintenanceStatus.detail?.message && (
            <Typography variant="body2" sx={{
              fontSize: '0.85rem',
              opacity: 0.95,
              fontStyle: 'italic',
              maxWidth: '600px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              💬 {maintenanceStatus.detail.message}
            </Typography>
          )}
        </Box>
      )}

      {/* 사이드바 */}
      <Box
        component="nav"
        sx={{
          width: { md: sidebarCollapsed ? 64 : sidebarWidth },
          flexShrink: { md: 0 },
          transition: 'width 0.3s ease',
          position: 'fixed',
          top: `${64 + bannerHeight}px`, // AppBar + dynamic banner height
          height: `calc(100vh - ${64 + bannerHeight}px)`,
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
          mt: `${64 + bannerHeight}px`, // AppBar + dynamic banner height
          minHeight: `calc(100vh - ${64 + bannerHeight}px)`,
          height: 'auto',
          backgroundColor: 'background.default',
          width: '100%',
          maxWidth: '100%',
          transition: 'padding-left 0.3s ease',
          overflowX: 'hidden',
          overflow: 'visible', // 스크롤 제거
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Maintenance banner */}



        {children}
      </Box>

    </Box>
  );
};
