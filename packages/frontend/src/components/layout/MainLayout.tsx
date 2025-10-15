import React, { useState, useEffect, useRef } from 'react';
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
import { useSnackbar } from 'notistack';
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
  Timeline as TimelineIcon,
  Terminal as TerminalIcon,
  MenuOpen as MenuOpenIcon,
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
import { baseMenuItems, adminMenuItems as configAdminMenuItems, settingsMenuItems as configSettingsMenuItems } from '@/config/navigation';

// Sidebar width is now dynamic

interface MainLayoutProps {
  children: React.ReactNode;
}

// 중앙 설정에서 메뉴 가져오기
const menuItems = baseMenuItems;
const adminMenuItems = configAdminMenuItems;
const settingsMenuItems = configSettingsMenuItems.map(item => ({
  ...item,
  requireAdmin: item.path !== '/settings', // settings 페이지는 모든 사용자 접근 가능
}));

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  // Load expanded sections from localStorage
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>(() => {
    try {
      const stored = localStorage.getItem('sidebarExpandedSections');
      return stored ? JSON.parse(stored) : { admin: true, settings: true };
    } catch {
      return { admin: true, settings: true };
    }
  });

  // Load sidebar state from localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const sidebarWidth = 280; // Fixed width
  const [avatarImageError, setAvatarImageError] = useState(false);

  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { toggleTheme, mode, isDark } = useCustomTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Maintenance banner state
  const [maintenanceStatus, setMaintenanceStatus] = useState<{ active: boolean; detail: MaintenanceDetail | null }>({ active: false, detail: null });
  const prevMaintenanceRef = useRef<{ active: boolean; updatedAt?: string | null } | null>(null);
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

        // Toast: started / stopped / updated
        const prev = prevMaintenanceRef.current;
        const nextActive = !!isUnderMaintenance;
        const nextUpdatedAt = detail?.updatedAt || null;
        if (prev) {
          if (prev.active !== nextActive) {
            enqueueSnackbar(nextActive ? t('notifications.maintenance.started') : t('notifications.maintenance.stopped'), {
              variant: nextActive ? 'warning' : 'success'
            });
          } else if (nextActive && prev.updatedAt !== nextUpdatedAt) {
            enqueueSnackbar(t('notifications.maintenance.updated'), { variant: 'info' });
          }
        }
        prevMaintenanceRef.current = { active: nextActive, updatedAt: nextUpdatedAt };

        setMaintenanceStatus({ active: nextActive, detail: detail || null });
      } else if (event.type === 'invitation_created' || event.type === 'invitation_deleted') {
        // 초대링크 이벤트를 다른 컴포넌트에 전달
        window.dispatchEvent(new CustomEvent('invitation-change', { detail: event }));
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
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    try {
      localStorage.setItem('sidebarCollapsed', String(newCollapsed));
    } catch (error) {
      console.warn('Failed to save sidebar collapsed state:', error);
    }
  };

  const handleMaintenanceBannerClick = () => {
    navigate('/admin/maintenance');
  };

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
    setExpandedSections(prev => {
      const newSections = {
        ...prev,
        [section]: !prev[section]
      };
      try {
        localStorage.setItem('sidebarExpandedSections', JSON.stringify(newSections));
      } catch (error) {
        console.warn('Failed to save expanded sections:', error);
      }
      return newSections;
    });
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
            color: hasActiveChild ? theme.palette.text.primary : theme.palette.text.secondary,
            backgroundColor: hasActiveChild ? `${theme.palette.primary.main}20` : 'transparent',
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.08)',
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
                    color: isActivePath(child.path) ? theme.palette.text.primary : theme.palette.text.secondary,
                    backgroundColor: isActivePath(child.path) ? `${theme.palette.primary.main}20` : 'transparent',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)',
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
          color: (isSettingsItem ? isActiveSettingsPath(item.path) : isActivePath(item.path)) ? theme.palette.text.primary : theme.palette.text.secondary,
          backgroundColor: (isSettingsItem ? isActiveSettingsPath(item.path) : isActivePath(item.path)) ? `${theme.palette.primary.main}20` : 'transparent',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.08)',
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
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: sidebarCollapsed ? 'pointer' : 'default',
        transition: 'background-color 0.2s ease',
        '&:hover': sidebarCollapsed ? {
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.05)',
        } : {},
      }}
      onClick={(e) => {
        // Only expand if sidebar is collapsed and click is on background (not on menu items)
        if (sidebarCollapsed && e.target === e.currentTarget) {
          handleSidebarToggle();
        }
      }}
    >
      {/* 로고 및 토글 버튼 영역 - AppBar와 동일한 높이 */}
      <Box
        sx={{
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
        }}
      >
        {!sidebarCollapsed && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
              },
            }}
            onClick={() => navigate('/dashboard')}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                backgroundColor: theme.palette.primary.main,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                G
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              Gatrix
            </Typography>
          </Box>
        )}

        {sidebarCollapsed && (
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
              },
            }}
            onClick={() => navigate('/dashboard')}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                backgroundColor: theme.palette.primary.main,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                G
              </Typography>
            </Box>
          </Box>
        )}

      </Box>

      {/* 메뉴 영역 - 스크롤 가능 */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          minHeight: 0,
          // Dark theme scrollbar (sidebar is always dark)
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255, 255, 255, 0.3)',
          },
          '&::-webkit-scrollbar-thumb:active': {
            background: 'rgba(255, 255, 255, 0.4)',
          },
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
        }}
        onClick={(e) => {
          // Expand sidebar when clicking on empty space in menu area
          if (sidebarCollapsed && e.target === e.currentTarget) {
            handleSidebarToggle();
          }
        }}
      >
        <List
          sx={{ px: 1, flexGrow: 1 }}
          onClick={(e) => {
            // Expand sidebar when clicking on empty space in list
            if (sidebarCollapsed && e.target === e.currentTarget) {
              handleSidebarToggle();
            }
          }}
        >
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
            <Divider sx={{
              my: 2,
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.12)'
            }} />
            {!sidebarCollapsed && (
              <ListItemButton
                onClick={() => toggleSection('admin')}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.08)'
                  }
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
            <Divider sx={{
              my: 2,
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.12)'
            }} />
            {!sidebarCollapsed && (
              <ListItemButton
                onClick={() => toggleSection('settings')}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.08)'
                  }
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
                      color: isActiveSettingsPath(item.path) ? theme.palette.text.primary : theme.palette.text.secondary,
                      backgroundColor: isActiveSettingsPath(item.path) ? `${theme.palette.primary.main}20` : 'transparent',
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.08)',
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
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 사이드바 - 전체 높이 차지 */}
      <Box
        component="nav"
        sx={{
          width: { xs: 0, md: sidebarCollapsed ? 64 : sidebarWidth },
          flexShrink: 0,
          zIndex: (theme) => theme.zIndex.drawer,
        }}
      >
        {/* 모바일 드로어 */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 280,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: 'none',
              borderRight: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* 데스크톱 드로어 - 전체 높이 */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: sidebarCollapsed ? 64 : sidebarWidth,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              position: 'fixed',
              height: '100vh',
              top: 0,
              left: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: 'none',
              borderRight: 'none',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* 오른쪽 영역: AppBar + 메인 컨텐츠 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
        {/* 상단 바 - 사이드바 옆에 위치 */}
        <AppBar
          position="static"
          sx={{
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            boxShadow: 'none',
            borderBottom: 'none',
            zIndex: (theme) => theme.zIndex.appBar,
          }}
        >
          <Toolbar sx={{
            justifyContent: 'space-between',
            minHeight: 64,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isMobile ? (
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 1 }}
                >
                  <MenuIcon />
                </IconButton>
              ) : (
                <IconButton
                  color="inherit"
                  aria-label="toggle sidebar"
                  edge="start"
                  onClick={handleSidebarToggle}
                  sx={{ mr: 1 }}
                >
                  <MenuOpenIcon />
                </IconButton>
              )}
            </Box>

            {/* 점검 배너 - AppBar 내부 */}
            {maintenanceStatus.active && (
              <Tooltip
                title={
                  <Box sx={{ p: 1.5, minWidth: 300 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: '#ff6b6b' }}>
                      🔧 {t('maintenance.tooltipTitle')}
                    </Typography>

                    {/* 상태 */}
                    <Typography variant="body2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                      <strong style={{ minWidth: '60px' }}>{t('maintenance.tooltipStatus')}:</strong>
                      <Box component="span" sx={{
                        ml: 1,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        backgroundColor: maintenanceStatus.active ? '#ff6b6b' : '#ffa726',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {maintenanceStatus.active ? t('maintenance.statusActive') : t('maintenance.statusScheduled')}
                      </Box>
                    </Typography>

                    {/* 유형 */}
                    {maintenanceStatus.detail?.type && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>{t('maintenance.tooltipType')}:</strong> {(() => {
                          switch (maintenanceStatus.detail.type) {
                            case 'scheduled':
                              return t('maintenance.scheduledLabel');
                            case 'emergency':
                              return t('maintenance.emergencyLabel');
                            case 'regular':
                              return t('maintenance.regularLabel');
                            default:
                              return t('maintenance.immediateStartLabel');
                          }
                        })()}
                      </Typography>
                    )}

                    {/* 시작 시간 */}
                    {maintenanceStatus.detail?.startsAt && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>{t('maintenance.tooltipStartTime')}:</strong> {formatDateTimeDetailed(maintenanceStatus.detail.startsAt)}
                      </Typography>
                    )}

                    {/* 종료 시간 */}
                    {maintenanceStatus.detail?.endsAt && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>{t('maintenance.tooltipEndTime')}:</strong> {formatDateTimeDetailed(maintenanceStatus.detail.endsAt)}
                      </Typography>
                    )}

                    {/* 소요 시간 */}
                    {maintenanceStatus.detail?.startsAt && maintenanceStatus.detail?.endsAt && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>{t('maintenance.tooltipDuration')}:</strong> {
                          (() => {
                            const start = new Date(maintenanceStatus.detail.startsAt);
                            const end = new Date(maintenanceStatus.detail.endsAt);
                            const diffMs = end.getTime() - start.getTime();
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                            if (diffHours > 0) {
                              return `${diffHours}${t('maintenance.hoursUnit')} ${diffMinutes}${t('maintenance.minutesUnit')}`;
                            } else {
                              return `${diffMinutes}${t('maintenance.minutesUnit')}`;
                            }
                          })()
                        }
                      </Typography>
                    )}

                    {/* 메시지 */}
                    {maintenanceStatus.detail?.message && (
                      <Typography variant="body2" sx={{ mb: 1.5 }}>
                        <strong style={{ minWidth: '60px' }}>{t('maintenance.tooltipMessage')}:</strong>
                        <Box component="div" sx={{
                          mt: 0.5,
                          p: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: 1,
                          fontStyle: 'italic',
                          maxWidth: '250px',
                          wordBreak: 'break-word'
                        }}>
                          {maintenanceStatus.detail.message}
                        </Box>
                      </Typography>
                    )}

                    <Typography variant="caption" sx={{
                      fontStyle: 'italic',
                      opacity: 0.8,
                      display: 'flex',
                      alignItems: 'center',
                      mt: 1,
                      pt: 1,
                      borderTop: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      💡 {t('maintenance.clickToManageTooltip')}
                    </Typography>
                  </Box>
                }
                arrow
                placement="bottom"
                enterDelay={500}
                leaveDelay={200}
              >
                <Box
                  onClick={handleMaintenanceBannerClick}
                  sx={{
                    flexGrow: 1,
                    mx: 2,
                    px: 2,
                    py: 0.75,
                    borderRadius: 3,
                    backgroundColor: 'rgba(244, 67, 54, 0.15)',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                      backgroundColor: 'rgba(244, 67, 54, 0.25)',
                      borderColor: 'rgba(244, 67, 54, 0.5)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="body2" sx={{
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      color: '#ff6b6b',
                    }}>
                      🔧 {t('common.maintenance.bannerActive')}
                    </Typography>
                    {maintenanceStatus.detail?.type && (
                      <Typography variant="body2" sx={{
                        fontSize: '0.7rem',
                        backgroundColor: 'rgba(244, 67, 54, 0.2)',
                        color: '#ff6b6b',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        fontWeight: 600
                      }}>
                        {t(`maintenance.types.${maintenanceStatus.detail.type}`)}
                      </Typography>
                    )}
                    {(maintenanceStatus.detail?.startsAt || maintenanceStatus.detail?.endsAt) && (
                      <Typography variant="body2" sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                      }}>
                        📅 {(() => {
                          const start = maintenanceStatus.detail?.startsAt;
                          const end = maintenanceStatus.detail?.endsAt;
                          if (start && end) {
                            return `${formatDateTimeDetailed(start)} ~ ${formatDateTimeDetailed(end)}`;
                          } else if (start) {
                            return `${formatDateTimeDetailed(start)} ${t('maintenance.start')}`;
                          } else if (end) {
                            return `${formatDateTimeDetailed(end)} ${t('maintenance.stop')}`;
                          }
                          return t('maintenance.immediateStartLabel');
                        })()}
                      </Typography>
                    )}
                    {maintenanceStatus.detail?.message && (
                      <Typography variant="body2" sx={{
                        fontSize: '0.75rem',
                        color: '#fbbf24',
                        fontStyle: 'italic',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        💬 {maintenanceStatus.detail.message}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Tooltip>
            )}

            {/* 점검 배너 우측 구분선 */}
            {maintenanceStatus.active && (
              <Box
                sx={{
                  width: '1px',
                  height: '24px',
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  mx: 1
                }}
              />
            )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimezoneSelector />

            {/* 구분선 */}
            <Box
              sx={{
                width: '1px',
                height: '24px',
                bgcolor: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.2)',
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

        {/* 메인 컨텐츠 */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            backgroundColor: 'background.default',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
