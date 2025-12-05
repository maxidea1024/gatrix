import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Fab,
  Zoom,
  keyframes,
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
  Mail as MailIcon,
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
  CardGiftcard as CardGiftcardIcon,
  Campaign as CampaignIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Poll as PollIcon,
  SportsEsports as SportsEsportsIcon,
  Storage as StorageIcon,
  Event as EventIcon,
  Whatshot as WhatshotIcon,
  Celebration as CelebrationIcon,
  Dns as DnsIcon,
  ArrowBack as ArrowBackIcon,
  Api as ApiIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme as useCustomTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import TimezoneSelector from '../common/TimezoneSelector';
import EnvironmentSelector from '@/components/EnvironmentSelector';
import { maintenanceService, MaintenanceDetail } from '@/services/maintenanceService';
import { useSSENotifications } from '@/hooks/useSSENotifications';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { computeMaintenanceStatus, getMaintenanceStatusDisplay, MaintenanceStatusType } from '@/utils/maintenanceStatusUtils';
import moment from 'moment';
import { getMenuCategories, MenuItem as NavMenuItem, MenuCategory } from '@/config/navigation';
import mailService from '@/services/mailService';
import { Permission, PERMISSIONS } from '@/types/permissions';

// Sidebar width is now dynamic

// Wiggle animation for floating button
const wiggleAnimation = keyframes`
  0%, 100% { transform: rotate(0deg) scale(1); }
  15% { transform: rotate(-8deg) scale(1.05); }
  30% { transform: rotate(8deg) scale(1.05); }
  45% { transform: rotate(-6deg) scale(1.02); }
  60% { transform: rotate(6deg) scale(1.02); }
  75% { transform: rotate(-3deg) scale(1); }
  90% { transform: rotate(3deg) scale(1); }
`;

// Ripple pulse animation for floating button
const ripplePulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
`;

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Load selected category from localStorage
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('sidebarSelectedCategory');
      return stored ? stored : null;
    } catch {
      return null;
    }
  });

  // Expanded submenu items state
  const [expandedSubmenus, setExpandedSubmenus] = useState<{ [key: string]: boolean }>(() => {
    try {
      const stored = localStorage.getItem('sidebarExpandedSubmenus');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
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

  const sidebarWidth = 240; // Fixed width
  const [avatarImageError, setAvatarImageError] = useState(false);

  const location = useLocation();
  const { user, logout, isAdmin, hasPermission } = useAuth();
  const { toggleTheme, mode, isDark } = useCustomTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { environments, isLoading: environmentsLoading } = useEnvironment();

  // Check if admin user has environment access
  const hasEnvironmentAccess = isAdmin() && !environmentsLoading && environments.length > 0;

  // Filter menu items based on permissions
  const canAccessMenuItem = useCallback((item: NavMenuItem): boolean => {
    // Check admin-only restriction
    if (item.adminOnly && !hasEnvironmentAccess) {
      return false;
    }
    // Check permission-based access
    if (item.requiredPermission) {
      const permissions = Array.isArray(item.requiredPermission)
        ? item.requiredPermission
        : [item.requiredPermission];
      return hasPermission(permissions as Permission[]);
    }
    return true;
  }, [hasEnvironmentAccess, hasPermission]);

  const filterMenuItems = useCallback((items: NavMenuItem[]): NavMenuItem[] => {
    return items.filter(item => {
      if (!canAccessMenuItem(item)) {
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
  }, [canAccessMenuItem]);

  // Get filtered menu categories
  const getFilteredMenuCategories = useCallback((): MenuCategory[] => {
    const categories = getMenuCategories(isAdmin());
    return categories.map(category => ({
      ...category,
      children: filterMenuItems(category.children)
    })).filter(category => category.children.length > 0);
  }, [isAdmin, filterMenuItems]);

  // Mail notification state
  const [unreadMailCount, setUnreadMailCount] = useState(0);

  // Role/Permission change dialog state
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);

  // Handle role/permission change notification
  useEffect(() => {
    const handleRoleChange = (event: CustomEvent) => {
      const { userId } = event.detail || {};
      // Only show dialog if the notification is for the current user
      if (userId && user?.id === userId) {
        setRoleChangeDialogOpen(true);
      }
    };

    window.addEventListener('user-role-changed', handleRoleChange as EventListener);
    return () => {
      window.removeEventListener('user-role-changed', handleRoleChange as EventListener);
    };
  }, [user?.id]);

  // Handle account suspension notification - immediately redirect to suspended page
  useEffect(() => {
    const handleUserSuspended = (event: CustomEvent) => {
      const { userId } = event.detail || {};
      // Only redirect if the notification is for the current user
      if (userId && user?.id === userId) {
        // Clear auth data and redirect to account suspended page
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/account-suspended');
      }
    };

    window.addEventListener('user-suspended', handleUserSuspended as EventListener);
    return () => {
      window.removeEventListener('user-suspended', handleUserSuspended as EventListener);
    };
  }, [user?.id, navigate]);

  // Handle role change dialog confirmation
  const handleRoleChangeConfirm = useCallback(() => {
    setRoleChangeDialogOpen(false);
    // Navigate to dashboard and force a full page reload to refresh auth state
    navigate('/dashboard');
    window.location.reload();
  }, [navigate]);

  // Maintenance banner state
  const [maintenanceStatus, setMaintenanceStatus] = useState<{ isMaintenance: boolean; status: MaintenanceStatusType; detail: MaintenanceDetail | null }>({ isMaintenance: false, status: 'inactive', detail: null });
  const prevMaintenanceRef = useRef<{ isMaintenance: boolean; status: MaintenanceStatusType; updatedAt?: string | null } | null>(null);
  // If SSE already updated the status, avoid overwriting with initial fetch result
  const maintenanceUpdatedBySSE = useRef(false);
  const maintenanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load - only for admin users with environment access
  useEffect(() => {
    // Skip maintenance status check for users without environment access
    if (!hasEnvironmentAccess) {
      return;
    }

    let cancelled = false;
    maintenanceService.getStatus().then(({ isUnderMaintenance, detail }) => {
      if (cancelled) return;
      if (maintenanceUpdatedBySSE.current) return; // keep SSE-updated status
      const status = computeMaintenanceStatus(!!isUnderMaintenance, detail);
      setMaintenanceStatus({ isMaintenance: !!isUnderMaintenance, status, detail: detail || null });
    }).catch(() => {
      if (cancelled) return;
      if (maintenanceUpdatedBySSE.current) return;
      setMaintenanceStatus({ isMaintenance: false, status: 'inactive', detail: null });
    });
    return () => { cancelled = true; };
  }, [hasEnvironmentAccess]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (maintenanceTimerRef.current) {
        clearTimeout(maintenanceTimerRef.current);
        maintenanceTimerRef.current = null;
      }
    };
  }, []);

  // Maintenance status timer - updates UI when maintenance starts/ends
  useEffect(() => {
    // Always clear existing timer first
    if (maintenanceTimerRef.current) {
      clearTimeout(maintenanceTimerRef.current);
      maintenanceTimerRef.current = null;
    }

    const updateMaintenanceStatus = () => {
      const newStatus = computeMaintenanceStatus(maintenanceStatus.isMaintenance, maintenanceStatus.detail);
      if (newStatus !== maintenanceStatus.status) {
        setMaintenanceStatus(prev => ({ ...prev, status: newStatus }));
      }
    };

    // Check if we need to set up a timer
    // Timer is only needed if:
    // 1. Maintenance is enabled (isMaintenance = true)
    // 2. There's maintenance detail with time constraints
    // 3. Start time is in the future OR end time is in the future
    const needsTimer = maintenanceStatus.isMaintenance && maintenanceStatus.detail && (
      (maintenanceStatus.detail.startsAt && new Date(maintenanceStatus.detail.startsAt) > new Date()) ||
      (maintenanceStatus.detail.endsAt && new Date(maintenanceStatus.detail.endsAt) > new Date())
    );

    if (needsTimer) {
      // Calculate next update time (when maintenance starts or ends)
      const now = new Date();
      const startsAt = maintenanceStatus.detail.startsAt ? new Date(maintenanceStatus.detail.startsAt) : null;
      const endsAt = maintenanceStatus.detail.endsAt ? new Date(maintenanceStatus.detail.endsAt) : null;

      let nextUpdateTime: Date | null = null;

      // If maintenance hasn't started yet, update when it starts
      if (startsAt && now < startsAt) {
        nextUpdateTime = startsAt;
      }
      // If maintenance is active and has an end time, update when it ends
      else if (endsAt && now < endsAt) {
        nextUpdateTime = endsAt;
      }

      if (nextUpdateTime) {
        const timeUntilUpdate = nextUpdateTime.getTime() - now.getTime();
        // Add 1 second buffer to ensure the status has actually changed
        const timerDelay = Math.max(1000, timeUntilUpdate + 1000);

        maintenanceTimerRef.current = setTimeout(() => {
          updateMaintenanceStatus();
        }, timerDelay);
      }
    }

    // Cleanup: clear timer when dependencies change or component unmounts
    // This ensures timer is stopped when:
    // - Maintenance is manually stopped (isMaintenance becomes false)
    // - Maintenance detail is updated
    // - Status changes
    return () => {
      if (maintenanceTimerRef.current) {
        clearTimeout(maintenanceTimerRef.current);
        maintenanceTimerRef.current = null;
      }
    };
  }, [maintenanceStatus.isMaintenance, maintenanceStatus.detail, maintenanceStatus.status]);

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
        const nextIsMaintenance = !!isUnderMaintenance;
        const nextStatus = computeMaintenanceStatus(nextIsMaintenance, detail);
        const nextUpdatedAt = detail?.updatedAt || null;
        if (prev) {
          if (prev.isMaintenance !== nextIsMaintenance) {
            enqueueSnackbar(nextIsMaintenance ? t('notifications.maintenance.started') : t('notifications.maintenance.stopped'), {
              variant: nextIsMaintenance ? 'warning' : 'success'
            });
          } else if (nextIsMaintenance && prev.updatedAt !== nextUpdatedAt) {
            enqueueSnackbar(t('notifications.maintenance.updated'), { variant: 'info' });
          }
        }
        prevMaintenanceRef.current = { isMaintenance: nextIsMaintenance, status: nextStatus, updatedAt: nextUpdatedAt };

        setMaintenanceStatus({ isMaintenance: nextIsMaintenance, status: nextStatus, detail: detail || null });
      } else if (event.type === 'invitation_created' || event.type === 'invitation_deleted') {
        // 초대링크 이벤트를 다른 컴포넌트에 전달
        window.dispatchEvent(new CustomEvent('invitation-change', { detail: event }));
      }
    },
    onError: (error) => {
      console.warn('SSE connection error in MainLayout:', error);
    }
  });

  // Load unread mail count
  const loadUnreadMailCount = useCallback(async () => {
    try {
      const count = await mailService.getUnreadCount();
      setUnreadMailCount(count);
    } catch (error) {
      console.error('Failed to load unread mail count:', error);
    }
  }, []);

  // Initial load of unread mail count
  useEffect(() => {
    loadUnreadMailCount();
    // Refresh every 60 seconds
    const interval = setInterval(loadUnreadMailCount, 60000);

    // Listen for mail-read event from MailboxPage
    const handleMailRead = () => {
      loadUnreadMailCount();
    };
    window.addEventListener('mail-read', handleMailRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mail-read', handleMailRead);
    };
  }, [loadUnreadMailCount]);

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



  const isActivePath = (path: string) => {
    // 정확한 경로 매칭
    if (location.pathname === path) {
      return true;
    }
    // /settings 경로들은 정확한 매칭만 사용 (prefix 매칭 안 함)
    if (path.startsWith('/settings')) {
      return false;
    }
    // 하위 경로인 경우에만 true (단, 정확히 '/'로 구분되는 경우만)
    if (path !== '/' && location.pathname.startsWith(path + '/')) {
      return true;
    }
    return false;
  };

  // Check if any child item is active
  const hasActiveChild = (children: any[]) => {
    return children?.some(child => {
      if (child.path) {
        return isActivePath(child.path);
      }
      if (child.children) {
        return hasActiveChild(child.children);
      }
      return false;
    });
  };

  // Open external http(s) links in new tab; otherwise navigate within SPA
  const openOrNavigate = (path: string) => {
    if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
    } else {
      navigate(path);
    }
  };

  const renderMenuItem = (item: any, index: any) => {
    // 서브메뉴가 있는 경우
    if (item.children) {
      const submenuKey = `submenu-${index}`;
      const isExpanded = expandedSubmenus[submenuKey];
      const hasActiveChild = item.children.some((child: any) =>
        isActivePath(child.path)
      );

      const toggleSubmenu = () => {
        setExpandedSubmenus(prev => {
          const newState = {
            ...prev,
            [submenuKey]: !prev[submenuKey]
          };
          try {
            localStorage.setItem('sidebarExpandedSubmenus', JSON.stringify(newState));
          } catch (error) {
            console.warn('Failed to save expanded submenus:', error);
          }
          return newState;
        });
      };

      return (
        <React.Fragment key={index}>
          {/* Parent menu item - only show when sidebar is expanded */}
          {!sidebarCollapsed && (
            <>
              {/* Parent menu item */}
              <ListItemButton
                onClick={toggleSubmenu}
                sx={{
                  pl: 2,
                  borderRadius: 1,
                  py: 0.75,
                  color: theme.palette.text.secondary,
                  backgroundColor: 'transparent',
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
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={t(item.text)}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                />
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            </>
          )}

          {/* Child menu items */}
          {sidebarCollapsed ? (
            // When sidebar is collapsed, show child items as icons
            <List component="div" disablePadding>
              {/* Divider before first child item when sidebar is collapsed */}
              <Divider sx={{ my: 0.5 }} />

              {item.children.map((child: any, childIndex: number) => {
                const isChildActive = isActivePath(child.path);

                return (
                  <Tooltip
                    key={childIndex}
                    title={t(child.text)}
                    placement="right"
                    arrow
                  >
                    <ListItemButton
                      onClick={() => openOrNavigate(child.path)}
                      sx={{
                        pl: 0,
                        pr: 0,
                        borderRadius: 1,
                        py: 0.75,
                        my: 0.5,
                        justifyContent: 'center',
                        color: isChildActive ? theme.palette.text.primary : theme.palette.text.secondary,
                        backgroundColor: isChildActive ? `${theme.palette.primary.main}20` : 'transparent',
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.08)',
                        },
                      }}
                    >
                      <ListItemIcon sx={{
                        color: 'inherit',
                        minWidth: 0,
                        justifyContent: 'center'
                      }}>
                        {child.icon}
                      </ListItemIcon>
                    </ListItemButton>
                  </Tooltip>
                );
              })}
            </List>
          ) : (
            // When sidebar is expanded, show child items with text
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {item.children.map((child: any, childIndex: number) => {
                  const isChildActive = isActivePath(child.path);

                  return (
                    <ListItemButton
                      key={childIndex}
                      onClick={() => openOrNavigate(child.path)}
                      sx={{
                        pl: 2,
                        pr: 2,
                        borderRadius: 1,
                        py: 0.75,
                        my: 0.5,
                        ml: 2,
                        color: isChildActive ? theme.palette.text.primary : theme.palette.text.secondary,
                        backgroundColor: isChildActive ? `${theme.palette.primary.main}20` : 'transparent',
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
                  );
                })}
              </List>
            </Collapse>
          )}
        </React.Fragment>
      );
    }

    // 일반 메뉴 아이템
    const isActive = isActivePath(item.path);
    const menuButton = (
      <ListItemButton
        key={index}
        onClick={() => openOrNavigate(item.path)}
        sx={{
          color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
          backgroundColor: isActive ? `${theme.palette.primary.main}20` : 'transparent',
          borderRadius: 1,
          py: 0.75,
          my: 0.5,
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.08)',
          },
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          px: sidebarCollapsed ? 0 : 2,
          pl: sidebarCollapsed ? 0 : 2,
        }}
      >
        <ListItemIcon sx={{
          color: 'inherit',
          minWidth: sidebarCollapsed ? 0 : 40,
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
            onClick={() => {
              setSelectedCategory(null);
              try {
                localStorage.removeItem('sidebarSelectedCategory');
              } catch (error) {
                console.warn('Failed to clear selected category:', error);
              }
              navigate('/dashboard');
            }}
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
            onClick={() => {
              setSelectedCategory(null);
              try {
                localStorage.removeItem('sidebarSelectedCategory');
              } catch (error) {
                console.warn('Failed to clear selected category:', error);
              }
              navigate('/dashboard');
            }}
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
          <Box
            sx={{
              opacity: selectedCategory ? 0 : 1,
              visibility: selectedCategory ? 'hidden' : 'visible',
              transform: selectedCategory ? 'scale(0.92)' : 'scale(1)',
              transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), visibility 0.35s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: selectedCategory ? 'absolute' : 'relative',
            }}
          >
            {/* Show main categories */}
            {getFilteredMenuCategories().map((category) => {
              const categoryButton = (
                <ListItemButton
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    try {
                      localStorage.setItem('sidebarSelectedCategory', category.id);
                    } catch (error) {
                      console.warn('Failed to save selected category:', error);
                    }
                  }}
                  sx={{
                    color: theme.palette.text.secondary,
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    px: sidebarCollapsed ? 0 : 2,
                    pl: sidebarCollapsed ? 0 : 2,
                    borderRadius: 1,
                    py: 0.75,
                    my: 0.5,
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)'
                    }
                  }}
                >
                  <ListItemIcon sx={{
                    color: 'inherit',
                    minWidth: sidebarCollapsed ? 0 : 40,
                    justifyContent: 'center'
                  }}>
                    {category.icon}
                  </ListItemIcon>
                  {!sidebarCollapsed && (
                    <ListItemText
                      primary={t(category.text)}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    />
                  )}
                </ListItemButton>
              );

              // Show tooltip when sidebar is collapsed
              if (sidebarCollapsed) {
                return (
                  <Tooltip
                    key={category.id}
                    title={t(category.text)}
                    placement="right"
                    arrow
                  >
                    {categoryButton}
                  </Tooltip>
                );
              }

              return categoryButton;
            })}
          </Box>

          <Box
            sx={{
              opacity: selectedCategory ? 1 : 0,
              visibility: selectedCategory ? 'visible' : 'hidden',
              transform: selectedCategory ? 'scale(1)' : 'scale(0.92)',
              transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), visibility 0.35s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: selectedCategory ? 'relative' : 'absolute',
            }}
          >
            {/* Show selected category's submenu */}
            {selectedCategory && (
              <>
                {/* Back to main button */}
                {sidebarCollapsed ? (
                  <Tooltip
                    title={t('sidebar.backToMain')}
                    placement="right"
                    arrow
                  >
                    <ListItemButton
                      onClick={() => {
                        setSelectedCategory(null);
                        try {
                          localStorage.removeItem('sidebarSelectedCategory');
                        } catch (error) {
                          console.warn('Failed to clear selected category:', error);
                        }
                      }}
                      sx={{
                        color: theme.palette.text.secondary,
                        mb: 2,
                        borderRadius: 1,
                        py: 0.75,
                        justifyContent: 'center',
                        px: 0,
                        pl: 0,
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.08)'
                        }
                      }}
                    >
                      <ListItemIcon sx={{
                        color: 'inherit',
                        minWidth: 0,
                        justifyContent: 'center'
                      }}>
                        <ArrowBackIcon />
                      </ListItemIcon>
                    </ListItemButton>
                  </Tooltip>
                ) : (
                  <ListItemButton
                    onClick={() => {
                      setSelectedCategory(null);
                      try {
                        localStorage.removeItem('sidebarSelectedCategory');
                      } catch (error) {
                        console.warn('Failed to clear selected category:', error);
                      }
                    }}
                    sx={{
                      color: theme.palette.text.secondary,
                      mb: 2,
                      borderRadius: 1,
                      py: 0.75,
                      justifyContent: 'flex-start',
                      px: 2,
                      pl: 2,
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.08)'
                      }
                    }}
                  >
                    <ListItemIcon sx={{
                      color: 'inherit',
                      minWidth: 40,
                      justifyContent: 'center'
                    }}>
                      <ArrowBackIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={t('sidebar.backToMain')}
                      primaryTypographyProps={{ fontSize: '0.875rem' }}
                    />
                  </ListItemButton>
                )}

                {/* Divider after back to main button */}
                <Divider sx={{ my: 1 }} />

                {/* Category title */}
                {!sidebarCollapsed && (
                  <Typography
                    variant="caption"
                    sx={{
                      px: 2,
                      py: 1,
                      display: 'block',
                      color: theme.palette.text.secondary,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem'
                    }}
                  >
                    {t(getFilteredMenuCategories().find(c => c.id === selectedCategory)?.text || '')}
                  </Typography>
                )}

                {/* Submenu items */}
                {getFilteredMenuCategories()
                  .find(c => c.id === selectedCategory)
                  ?.children.map((item, index, items) => {
                    // Check if previous item has children (is a submenu group)
                    const prevItem = index > 0 ? items[index - 1] : null;
                    const prevHasChildren = prevItem?.children && prevItem.children.length > 0;
                    const currentHasChildren = item.children && item.children.length > 0;

                    // Add divider if current item is regular (no children) and previous item is a submenu group
                    const showDivider = !currentHasChildren && prevHasChildren && sidebarCollapsed;

                    return (
                      <React.Fragment key={index}>
                        {showDivider && <Divider sx={{ my: 0.5 }} />}
                        {renderMenuItem(item, index)}
                      </React.Fragment>
                    );
                  })}
              </>
            )}
          </Box>
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
            {maintenanceStatus.isMaintenance && (
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
                        backgroundColor: getMaintenanceStatusDisplay(maintenanceStatus.status).color,
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {t(getMaintenanceStatusDisplay(maintenanceStatus.status).label)}
                      </Box>
                    </Typography>

                    {/* 유형 */}
                    {maintenanceStatus.detail?.type && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>{t('maintenance.tooltipType')}:</strong> {(() => {
                          switch (maintenanceStatus.detail.type) {
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
                      color: getMaintenanceStatusDisplay(maintenanceStatus.status).color,
                    }}>
                      {getMaintenanceStatusDisplay(maintenanceStatus.status).icon} {t(getMaintenanceStatusDisplay(maintenanceStatus.status).label)}
                    </Typography>
                    {maintenanceStatus.detail?.type && (
                      <Typography variant="body2" sx={{
                        fontSize: '0.7rem',
                        backgroundColor: getMaintenanceStatusDisplay(maintenanceStatus.status).bgColor,
                        color: getMaintenanceStatusDisplay(maintenanceStatus.status).color,
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
            {maintenanceStatus.isMaintenance && (
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
              {/* Chat button - only visible for admin users with chat permission */}
              {isAdmin() && hasPermission(PERMISSIONS.CHAT_ACCESS) && (
                <Tooltip title={t('sidebar.chat')}>
                  <IconButton
                    color="inherit"
                    onClick={() => navigate('/chat')}
                  >
                    <ChatIcon />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title={t('mailbox.title')}>
                <IconButton
                  color="inherit"
                  onClick={() => navigate('/mailbox')}
                >
                  <Badge badgeContent={unreadMailCount} color="error">
                    <MailIcon />
                  </Badge>
                </IconButton>
              </Tooltip>

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

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                <Typography
                  variant="body2"
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    color: 'inherit',
                    fontWeight: 500,
                    maxWidth: 150,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  onClick={handleUserMenuOpen}
                >
                  {user?.name || user?.email?.split('@')[0] || ''}
                </Typography>
              </Box>

              <LanguageSelector variant="text" size="medium" />

              {/* Environment Selector with Divider - Only for admin users with environments */}
              {hasEnvironmentAccess && (
                <>
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
                  <EnvironmentSelector size="small" />
                </>
              )}

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

      {/* Role/Permission Change Floating Button */}
      <Zoom in={roleChangeDialogOpen}>
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 56,
            height: 56,
          }}
        >
          {/* Ripple pulse effect rings */}
          {[0, 0.5, 1].map((delay, index) => (
            <Box
              key={index}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: 'warning.main',
                animation: `${ripplePulseAnimation} 2s ease-out infinite ${delay}s`,
                pointerEvents: 'none',
              }}
            />
          ))}
          <Tooltip title={t('common.roleChangeMessage')} placement="left" arrow>
            <Fab
              color="warning"
              onClick={handleRoleChangeConfirm}
              sx={{
                animation: `${wiggleAnimation} 1s ease-in-out infinite`,
                boxShadow: '0 4px 20px rgba(237, 108, 2, 0.4)',
                '&:hover': {
                  animation: 'none',
                  transform: 'scale(1.1)',
                },
              }}
            >
              <RefreshIcon />
            </Fab>
          </Tooltip>
        </Box>
      </Zoom>
    </Box>
  );
};

