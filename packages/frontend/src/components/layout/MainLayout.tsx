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
  Slide,
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
  MenuBook as MenuBookIcon,
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
  Lock as LockIcon,
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/services/auth';
import { useTheme as useCustomTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import TimezoneSelector from '../common/TimezoneSelector';
import SidebarContextSwitcher from '@/components/layout/SidebarContextSwitcher';
import {
  maintenanceService,
  MaintenanceDetail,
} from '@/services/maintenanceService';
import { useSSENotifications } from '@/hooks/useSSENotifications';
import changeRequestService from '@/services/changeRequestService';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import {
  computeMaintenanceStatus,
  getMaintenanceStatusDisplay,
  MaintenanceStatusType,
} from '@/utils/maintenanceStatusUtils';

import {
  getMenuCategories,
  getPathMatchMap,
  MenuItem as NavMenuItem,
  MenuCategory,
} from '@/config/navigation';
import mailService from '@/services/mailService';
import AIChatPanel, { AIChatFloatingButton } from '@/components/ai/AIChatPanel';
import { Permission, P } from '@/types/permissions';

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

// Maintenance banner pulse animation
const maintenancePulseAnimation = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(244, 67, 54, 0);
  }
`;

// Rumble animation for CR floating banner
const crRumbleAnimation = keyframes`
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-3px) rotate(-1deg); }
  20% { transform: translateX(3px) rotate(1deg); }
  30% { transform: translateX(-3px) rotate(-0.5deg); }
  40% { transform: translateX(3px) rotate(0.5deg); }
  50% { transform: translateX(-2px); }
  60% { transform: translateX(2px); }
  70% { transform: translateX(-1px); }
  80% { transform: translateX(1px); }
  90% { transform: translateX(0); }
`;

// Maintenance icon pulse animation
const maintenanceIconPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
`;

// Marquee scrolling animation for maintenance message
const marqueeScroll = keyframes`
  0% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(-50%);
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
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  // Expanded submenu items state
  const [expandedSubmenus, setExpandedSubmenus] = useState<{
    [key: string]: boolean;
  }>(() => {
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

  const sidebarWidth = 270; // Fixed width
  const [avatarImageError, setAvatarImageError] = useState(false);

  const location = useLocation();
  const { user, logout, hasPermission, permissions, permissionsLoading } =
    useAuth();
  const { toggleTheme, mode, isDark } = useCustomTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    environments,
    isLoading: environmentsLoading,
    currentEnvironmentId,
    currentEnvironment,
  } = useEnvironment();
  const { getProjectApiPath } = useOrgProject();

  // AI Chat panel state
  const [aiChatOpen, setAIChatOpen] = useState(false);

  // Pending CR count for banner
  const [pendingCRCount, setPendingCRCount] = useState(0);
  // My draft CR count for banner
  const [myDraftCount, setMyDraftCount] = useState(0);
  // My pending review count (open status - edits are locked)
  const [myPendingReviewCount, setMyPendingReviewCount] = useState(0);

  // User has RBAC permissions assigned (regardless of system role)
  const hasAnyPermissions = !permissionsLoading && permissions.length > 0;

  // Check if user has environment access (has permissions + environments loaded)
  const hasEnvironmentAccess =
    hasAnyPermissions && !environmentsLoading && environments.length > 0;

  // Show sidebar when user has any permissions
  const showSidebar = hasAnyPermissions;

  // Filter menu items based on permissions
  const canAccessMenuItem = useCallback(
    (item: NavMenuItem): boolean => {
      // Check admin-only restriction (requires RBAC permissions)
      if (item.adminOnly && !hasAnyPermissions) {
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
    },
    [hasAnyPermissions, hasPermission]
  );

  const filterMenuItems = useCallback(
    (items: NavMenuItem[]): NavMenuItem[] => {
      return items
        .filter((item) => {
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
        })
        .map((item) => {
          if (item.children) {
            return { ...item, children: filterMenuItems(item.children) };
          }
          return item;
        });
    },
    [canAccessMenuItem]
  );

  // Get filtered menu categories
  const getFilteredMenuCategories = useCallback((): MenuCategory[] => {
    const categories = getMenuCategories(
      hasAnyPermissions,
      {
        'sidebar.changeRequests': pendingCRCount,
      },
      {}
    );
    return categories
      .map((category) => ({
        ...category,
        children: filterMenuItems(category.children),
      }))
      .filter((category) => category.children.length > 0);
  }, [hasAnyPermissions, filterMenuItems, pendingCRCount, currentEnvironment]);

  // Flag to track if initial URL sync has been done
  const initialSyncDoneRef = useRef(false);

  // Sync sidebar state (selectedCategory and expandedSubmenus) with current URL path
  // This only runs on initial page load to sync the sidebar with the URL
  useEffect(() => {
    // Only perform sync once on initial load
    if (initialSyncDoneRef.current) return;

    const categories = getFilteredMenuCategories();
    const currentPath = location.pathname;

    // Helper function to find if a path is within an item or its children
    const findPathInItem = (item: NavMenuItem, path: string): boolean => {
      if (item.path === path) return true;
      if (item.children) {
        return item.children.some((child) => findPathInItem(child, path));
      }
      return false;
    };

    // Helper function to find submenu index that contains the path
    const findSubmenuIndex = (items: NavMenuItem[], path: string): number => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (
          item.children &&
          item.children.some((child) => findPathInItem(child, path))
        ) {
          return i;
        }
        if (item.path === path) {
          return -1; // Found at top level, no submenu needed
        }
      }
      return -1;
    };

    // Find which category contains the current path
    for (const category of categories) {
      const hasPath = category.children.some((item) =>
        findPathInItem(item, currentPath)
      );
      if (hasPath) {
        // Skip "navigation" category (dashboard/settings) from auto-expansion
        if (category.id === 'navigation') {
          initialSyncDoneRef.current = true;
          return;
        }

        // Expand the category section
        const categoryKey = `category-${category.id}`;
        if (!expandedSubmenus[categoryKey]) {
          setExpandedSubmenus((prev) => {
            const newState = { ...prev, [categoryKey]: true };
            try {
              localStorage.setItem(
                'sidebarExpandedSubmenus',
                JSON.stringify(newState)
              );
            } catch (error) {
              console.warn('Failed to save expanded submenus:', error);
            }
            return newState;
          });
        }

        // Find and expand the submenu that contains this path
        const submenuIndex = findSubmenuIndex(category.children, currentPath);
        if (submenuIndex >= 0) {
          const submenuKey = `submenu-${submenuIndex}`;
          if (!expandedSubmenus[submenuKey]) {
            setExpandedSubmenus((prev) => {
              const newState = { ...prev, [submenuKey]: true };
              try {
                localStorage.setItem(
                  'sidebarExpandedSubmenus',
                  JSON.stringify(newState)
                );
              } catch (error) {
                console.warn('Failed to save expanded submenus:', error);
              }
              return newState;
            });
          }
        }

        initialSyncDoneRef.current = true;
        return; // Found the category, no need to continue
      }
    }

    initialSyncDoneRef.current = true;
  }, [location.pathname, getFilteredMenuCategories, expandedSubmenus]);

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

    window.addEventListener(
      'user-role-changed',
      handleRoleChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'user-role-changed',
        handleRoleChange as EventListener
      );
    };
  }, [user?.id]);

  // Handle 403 Forbidden - show global snackbar
  useEffect(() => {
    const handleForbidden = () => {
      enqueueSnackbar(t('errors.insufficientPermissions'), {
        variant: 'warning',
        autoHideDuration: 5000,
        preventDuplicate: true,
      });
    };

    window.addEventListener('gatrix:forbidden', handleForbidden);
    return () => {
      window.removeEventListener('gatrix:forbidden', handleForbidden);
    };
  }, [enqueueSnackbar, t]);

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

    window.addEventListener(
      'user-suspended',
      handleUserSuspended as EventListener
    );
    return () => {
      window.removeEventListener(
        'user-suspended',
        handleUserSuspended as EventListener
      );
    };
  }, [user?.id, navigate]);

  // Handle change request notifications
  useEffect(() => {
    const handleCRNotification = (event: CustomEvent) => {
      const { action, title, requesterName, approverName, rejectorName } =
        event.detail || {};

      switch (action) {
        case 'submitted':
          enqueueSnackbar(
            t('notifications.changeRequest.submitted', {
              title,
              requester: requesterName || 'Unknown',
            }),
            {
              variant: 'info',
              autoHideDuration: 8000,
              action: () => (
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => navigate('/admin/change-requests?status=open')}
                >
                  <ArrowBackIcon sx={{ transform: 'rotate(180deg)' }} />
                </IconButton>
              ),
            }
          );
          break;
        case 'approved':
          enqueueSnackbar(
            t('notifications.changeRequest.approved', {
              title,
              approver: approverName || 'Unknown',
            }),
            {
              variant: 'success',
              autoHideDuration: 5000,
            }
          );
          break;
        case 'rejected':
          enqueueSnackbar(
            t('notifications.changeRequest.rejected', {
              title,
              rejector: rejectorName || 'Unknown',
            }),
            {
              variant: 'warning',
              autoHideDuration: 5000,
            }
          );
          break;
        case 'executed':
          enqueueSnackbar(
            t('notifications.changeRequest.executed', { title }),
            {
              variant: 'success',
              autoHideDuration: 5000,
            }
          );
          break;
      }
      // Refresh pending CR count when CR is submitted
      if (
        action === 'submitted' ||
        action === 'approved' ||
        action === 'rejected' ||
        action === 'executed'
      ) {
        loadPendingCRCount();
      }
    };

    window.addEventListener(
      'change-request-notification',
      handleCRNotification as EventListener
    );
    return () => {
      window.removeEventListener(
        'change-request-notification',
        handleCRNotification as EventListener
      );
    };
  }, [enqueueSnackbar, t, navigate]);

  // Load pending CR count and my draft count
  const loadPendingCRCount = useCallback(async () => {
    // Skip if user doesn't have change request permission
    if (!hasPermission([P.CHANGE_REQUESTS_CREATE])) return;
    try {
      const projectApiPath = getProjectApiPath();
      const response = await changeRequestService.getMyRequests(projectApiPath);
      setPendingCRCount(response?.pendingApproval?.length || 0);
      // Count total change items across all drafts (not CR count, which is always 1)
      const totalDraftItems = (response?.myDrafts || []).reduce(
        (sum: number, cr: any) => sum + (cr.changeItems?.length || 0),
        0
      );
      setMyDraftCount(totalDraftItems);
      // Count my own CRs that are in 'open' status (pending review)
      const myOpenCount = (response?.myRequests || []).filter(
        (cr: any) => cr.status === 'open'
      ).length;
      setMyPendingReviewCount(myOpenCount);
    } catch (error) {
      // Silently fail - don't spam errors for optional feature
    }
  }, [hasPermission]);

  // Load pending CR count on mount and environment change
  useEffect(() => {
    // Only load when environment is properly selected
    if (hasEnvironmentAccess && currentEnvironmentId) {
      loadPendingCRCount();
    }
  }, [hasEnvironmentAccess, currentEnvironmentId, loadPendingCRCount]);

  // Listen for cr-draft-changed events from feature flag pages
  useEffect(() => {
    const handleCRDraftChanged = () => {
      loadPendingCRCount();
    };
    window.addEventListener('cr-draft-changed', handleCRDraftChanged);
    return () => {
      window.removeEventListener('cr-draft-changed', handleCRDraftChanged);
    };
  }, [loadPendingCRCount]);

  // Handle role change dialog confirmation
  const handleRoleChangeConfirm = useCallback(async () => {
    setRoleChangeDialogOpen(false);
    try {
      // Fetch latest user profile to update localStorage before reload
      // This ensures the new role/permissions are reflected after page refresh
      await AuthService.getProfile();
    } catch (error) {
      // Continue with reload even if profile fetch fails
      console.error('Failed to refresh profile:', error);
    }
    // Navigate to dashboard and force a full page reload to refresh auth state
    navigate('/dashboard');
    window.location.reload();
  }, [navigate]);

  // Maintenance banner state
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    isMaintenance: boolean;
    status: MaintenanceStatusType;
    detail: MaintenanceDetail | null;
  }>({ isMaintenance: false, status: 'inactive', detail: null });
  const prevMaintenanceRef = useRef<{
    isMaintenance: boolean;
    status: MaintenanceStatusType;
    updatedAt?: string | null;
  } | null>(null);
  // If SSE already updated the status, avoid overwriting with initial fetch result
  const maintenanceUpdatedBySSE = useRef(false);
  const maintenanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load - only for admin users with environment access
  useEffect(() => {
    // Skip maintenance status check for users without environment access or no environment selected
    if (!hasEnvironmentAccess || !currentEnvironmentId) {
      return;
    }

    // Reset refs when environment changes to avoid stale state from previous environment
    maintenanceUpdatedBySSE.current = false;
    prevMaintenanceRef.current = null;

    // Reset maintenance status immediately when environment changes
    setMaintenanceStatus({
      isMaintenance: false,
      status: 'inactive',
      detail: null,
    });

    let cancelled = false;
    const projectApiPath = getProjectApiPath();
    maintenanceService
      .getStatus(projectApiPath)
      .then(({ isUnderMaintenance, detail }) => {
        if (cancelled) return;
        if (maintenanceUpdatedBySSE.current) return; // keep SSE-updated status
        const status = computeMaintenanceStatus(!!isUnderMaintenance, detail);
        setMaintenanceStatus({
          isMaintenance: !!isUnderMaintenance,
          status,
          detail: detail || null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (maintenanceUpdatedBySSE.current) return;
        setMaintenanceStatus({
          isMaintenance: false,
          status: 'inactive',
          detail: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [hasEnvironmentAccess, currentEnvironmentId]);

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
      const newStatus = computeMaintenanceStatus(
        maintenanceStatus.isMaintenance,
        maintenanceStatus.detail
      );
      if (newStatus !== maintenanceStatus.status) {
        setMaintenanceStatus((prev) => ({ ...prev, status: newStatus }));
      }
    };

    // Check if we need to set up a timer
    // Timer is only needed if:
    // 1. Maintenance is enabled (isMaintenance = true)
    // 2. There's maintenance detail with time constraints
    // 3. Start time is in the future OR end time is in the future
    const needsTimer =
      maintenanceStatus.isMaintenance &&
      maintenanceStatus.detail &&
      ((maintenanceStatus.detail.startsAt &&
        new Date(maintenanceStatus.detail.startsAt) > new Date()) ||
        (maintenanceStatus.detail.endsAt &&
          new Date(maintenanceStatus.detail.endsAt) > new Date()));

    if (needsTimer) {
      // Calculate next update time (when maintenance starts or ends)
      const now = new Date();
      const startsAt = maintenanceStatus.detail.startsAt
        ? new Date(maintenanceStatus.detail.startsAt)
        : null;
      const endsAt = maintenanceStatus.detail.endsAt
        ? new Date(maintenanceStatus.detail.endsAt)
        : null;

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
  }, [
    maintenanceStatus.isMaintenance,
    maintenanceStatus.detail,
    maintenanceStatus.status,
  ]);

  // SSE updates - Handle backend connection failures appropriately
  const sseConnection = useSSENotifications({
    autoConnect: true, // Activate auto-connect
    maxReconnectAttempts: 3, // Reduce reconnect attempt limit
    reconnectInterval: 10000, // Increase reconnect interval (10s)
    onEvent: (event) => {
      if (event.type === 'maintenance_status_change') {
        const { isUnderMaintenance, detail } = event.data || {};
        maintenanceUpdatedBySSE.current = true;

        // Toast: started / scheduled / stopped / updated
        const prev = prevMaintenanceRef.current;
        const nextIsMaintenance = !!isUnderMaintenance;
        const nextStatus = computeMaintenanceStatus(nextIsMaintenance, detail);
        const nextUpdatedAt = detail?.updatedAt || null;
        if (prev) {
          if (prev.isMaintenance !== nextIsMaintenance) {
            if (nextIsMaintenance) {
              // Check if it's scheduled (start time is in the future)
              const isScheduled =
                detail?.startsAt && new Date(detail.startsAt) > new Date();
              enqueueSnackbar(
                isScheduled
                  ? t('notifications.maintenance.scheduled')
                  : t('notifications.maintenance.started'),
                {
                  variant: 'warning',
                }
              );
            } else {
              enqueueSnackbar(t('notifications.maintenance.stopped'), {
                variant: 'success',
              });
            }
          } else if (nextIsMaintenance && prev.updatedAt !== nextUpdatedAt) {
            enqueueSnackbar(t('notifications.maintenance.updated'), {
              variant: 'info',
            });
          }
        }
        prevMaintenanceRef.current = {
          isMaintenance: nextIsMaintenance,
          status: nextStatus,
          updatedAt: nextUpdatedAt,
        };

        setMaintenanceStatus({
          isMaintenance: nextIsMaintenance,
          status: nextStatus,
          detail: detail || null,
        });

        // Dispatch custom event for other components (e.g., DashboardPage) to listen
        window.dispatchEvent(
          new CustomEvent('maintenance-status-change', {
            detail: {
              isUnderMaintenance: nextIsMaintenance,
              detail: detail || null,
            },
          })
        );
      } else if (
        event.type === 'invitation_created' ||
        event.type === 'invitation_deleted'
      ) {
        // Dispatch invitation link event to other components
        window.dispatchEvent(
          new CustomEvent('invitation-change', { detail: event })
        );
      }
    },
    onError: (error) => {
      console.warn('SSE connection error in MainLayout:', error);
    },
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

  // Initialize avatar image error status whenever user changes
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
    // Exact path match
    if (location.pathname === path) {
      return true;
    }
    // Check alias paths from navigation config (e.g., workspace matches projects/environments)
    const pathMatchMap = getPathMatchMap();
    const aliases = pathMatchMap[path];
    if (aliases?.some((p) => location.pathname.startsWith(p))) {
      return true;
    }
    // /settings, /feature-flags use exact match only (no prefix matching)
    if (path.startsWith('/settings') || path.startsWith('/feature-flags')) {
      return false;
    }
    // Sub-path match (only when separated by '/')
    if (path !== '/' && location.pathname.startsWith(path + '/')) {
      return true;
    }
    return false;
  };

  // Check if any child item is active
  const hasActiveChild = (children: any[]) => {
    return children?.some((child) => {
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
    if (path === '/logout') {
      handleLogoutClick();
    } else if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
    } else {
      navigate(path);
    }
  };

  const renderMenuItem = (item: any, index: any) => {
    // If there are submenus
    if (item.children) {
      const submenuKey = `submenu-${index}`;
      const isExpanded = expandedSubmenus[submenuKey];
      const hasActiveChild = item.children.some((child: any) =>
        isActivePath(child.path)
      );

      const toggleSubmenu = () => {
        setExpandedSubmenus((prev) => {
          const newState = {
            ...prev,
            [submenuKey]: !prev[submenuKey],
          };
          try {
            localStorage.setItem(
              'sidebarExpandedSubmenus',
              JSON.stringify(newState)
            );
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
                  pl: 4,
                  borderRadius: 1,
                  py: 0.75,
                  color: theme.palette.text.secondary,
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'inherit',
                    minWidth: 40,
                    justifyContent: 'center',
                  }}
                >
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
                        color: isChildActive
                          ? theme.palette.text.primary
                          : theme.palette.text.secondary,
                        backgroundColor: isChildActive
                          ? `${theme.palette.primary.main}20`
                          : 'transparent',
                        '&:hover': {
                          backgroundColor:
                            theme.palette.mode === 'dark'
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(0,0,0,0.08)',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color: 'inherit',
                          minWidth: 0,
                          justifyContent: 'center',
                        }}
                      >
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
              <List
                component="div"
                disablePadding
                sx={{
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.025)'
                      : 'rgba(0,0,0,0.02)',
                  borderRadius: 1,
                  mx: 0.5,
                  mb: 0.5,
                }}
              >
                {item.children.map((child: any, childIndex: number) => {
                  const isChildActive = isActivePath(child.path);

                  return (
                    <React.Fragment key={childIndex}>
                      {child.divider && <Divider sx={{ mx: 2, my: 0.5 }} />}
                      <ListItemButton
                        onClick={() => openOrNavigate(child.path)}
                        sx={{
                          pl: 6,
                          pr: 2,
                          borderRadius: 1,
                          py: 0.75,
                          my: 0.5,
                          color: isChildActive
                            ? theme.palette.text.primary
                            : theme.palette.text.secondary,
                          backgroundColor: isChildActive
                            ? `${theme.palette.primary.main}20`
                            : 'transparent',
                          '&:hover': {
                            backgroundColor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(0,0,0,0.08)',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: 'inherit',
                            minWidth: 40,
                            justifyContent: 'center',
                          }}
                        >
                          {sidebarCollapsed ? (
                            <Badge badgeContent={child.badge} color="primary">
                              {child.icon}
                            </Badge>
                          ) : (
                            child.icon
                          )}
                        </ListItemIcon>
                        {!sidebarCollapsed && (
                          <>
                            <ListItemText
                              primary={t(child.text)}
                              primaryTypographyProps={{ fontSize: '0.875rem' }}
                            />
                            {child.badge && (
                              <Badge
                                badgeContent={child.badge}
                                color="primary"
                                sx={{
                                  ml: 1,
                                  '& .MuiBadge-badge': { fontSize: '0.625rem' },
                                }}
                              />
                            )}
                          </>
                        )}
                      </ListItemButton>
                    </React.Fragment>
                  );
                })}
              </List>
            </Collapse>
          )}
        </React.Fragment>
      );
    }

    // Regular menu item
    const isActive = isActivePath(item.path);
    const menuButton = (
      <ListItemButton
        key={index}
        onClick={() => openOrNavigate(item.path)}
        sx={{
          color: isActive
            ? theme.palette.text.primary
            : theme.palette.text.secondary,
          backgroundColor: isActive
            ? `${theme.palette.primary.main}20`
            : 'transparent',
          borderRadius: 1,
          py: 0.75,
          my: 0.5,
          '&:hover': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.08)',
          },
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          px: sidebarCollapsed ? 0 : 2,
          pl: sidebarCollapsed ? 0 : 4,
        }}
      >
        <ListItemIcon
          sx={{
            color: 'inherit',
            minWidth: sidebarCollapsed ? 0 : 40,
            justifyContent: 'center',
          }}
        >
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

    // Show tooltip only when sidebar is collapsed
    if (sidebarCollapsed) {
      return (
        <Tooltip key={index} title={t(item.text)} placement="right" arrow>
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
        '&:hover': sidebarCollapsed
          ? {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.05)',
            }
          : {},
      }}
      onClick={(e) => {
        // Only expand if sidebar is collapsed and click is on background (not on menu items)
        if (sidebarCollapsed && e.target === e.currentTarget) {
          handleSidebarToggle();
        }
      }}
    >
      {/* Logo and toggle button area - Same height as AppBar */}
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
              flex: 1,
              minWidth: 0,
            }}
          >
            <Tooltip
              title={
                sseConnection.connectionStatus === 'error'
                  ? t('common.connectionLost')
                  : ''
              }
              placement="bottom"
              arrow
            >
              <Box
                onClick={() => navigate('/dashboard')}
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor:
                    sseConnection.connectionStatus === 'error'
                      ? theme.palette.error.main
                      : theme.palette.primary.main,
                  transition: 'background-color 0.3s ease',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  '&:hover': { opacity: 0.8 },
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ color: 'white', fontWeight: 'bold' }}
                >
                  G
                </Typography>
              </Box>
            </Tooltip>
            <SidebarContextSwitcher collapsed={sidebarCollapsed} />
          </Box>
        )}

        {sidebarCollapsed && (
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <SidebarContextSwitcher collapsed={sidebarCollapsed} />
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
          {/* Menu Categories */}
          {getFilteredMenuCategories().map((category) => {
            const categoryKey = `category-${category.id}`;
            const isExpanded = expandedSubmenus[categoryKey];

            const toggleCategory = () => {
              if (sidebarCollapsed) {
                handleSidebarToggle();
                if (!isExpanded) {
                  setExpandedSubmenus((prev) => {
                    const newState = { ...prev, [categoryKey]: true };
                    try {
                      localStorage.setItem(
                        'sidebarExpandedSubmenus',
                        JSON.stringify(newState)
                      );
                    } catch (e) {}
                    return newState;
                  });
                }
              } else {
                setExpandedSubmenus((prev) => {
                  const newState = {
                    ...prev,
                    [categoryKey]: !prev[categoryKey],
                  };
                  try {
                    localStorage.setItem(
                      'sidebarExpandedSubmenus',
                      JSON.stringify(newState)
                    );
                  } catch (e) {}
                  return newState;
                });
              }
            };

            const hasActiveChild = category.children.some((child) => {
              if (child.path && isActivePath(child.path)) return true;
              if (child.children) {
                return child.children.some(
                  (c) => c.path && isActivePath(c.path)
                );
              }
              return false;
            });

            // For navigation group (dashboard/settings) it acts as a normal menu, no collapsing
            const categoryButton = (
              <ListItemButton
                key={category.id}
                onClick={
                  category.path
                    ? () => navigate(category.path!)
                    : toggleCategory
                }
                sx={{
                  color: hasActiveChild
                    ? theme.palette.text.primary
                    : theme.palette.text.secondary,
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  px: sidebarCollapsed ? 0 : 2,
                  pl: sidebarCollapsed ? 0 : 2,
                  borderRadius: 1,
                  py: 0.75,
                  my: 0.5,
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'inherit',
                    minWidth: sidebarCollapsed ? 0 : 40,
                    justifyContent: 'center',
                  }}
                >
                  {sidebarCollapsed ? (
                    <Badge badgeContent={category.badge} color="primary">
                      {category.icon}
                    </Badge>
                  ) : (
                    category.icon
                  )}
                </ListItemIcon>
                {!sidebarCollapsed && (
                  <>
                    <ListItemText
                      primary={t(category.text)}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    />
                    {category.badge && (
                      <Badge
                        badgeContent={category.badge}
                        color="primary"
                        sx={{
                          ml: 1,
                          '& .MuiBadge-badge': { fontSize: '0.625rem' },
                        }}
                      />
                    )}
                    {!category.path &&
                      (isExpanded ? <ExpandLess /> : <ExpandMore />)}
                  </>
                )}
              </ListItemButton>
            );

            return (
              <React.Fragment key={category.id}>
                {sidebarCollapsed ? (
                  <Tooltip title={t(category.text)} placement="right" arrow>
                    {categoryButton}
                  </Tooltip>
                ) : (
                  categoryButton
                )}

                {/* Submenu items */}
                {!category.path && !sidebarCollapsed && (
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <List
                      component="div"
                      disablePadding
                      sx={{
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.025)'
                            : 'rgba(0,0,0,0.02)',
                        borderRadius: 1,
                        mx: 0.5,
                        mb: 0.5,
                      }}
                    >
                      {category.children.map((item, index, items) => {
                        const prevItem = index > 0 ? items[index - 1] : null;
                        const prevHasChildren =
                          prevItem?.children && prevItem.children.length > 0;
                        const currentHasChildren =
                          item.children && item.children.length > 0;
                        const showDivider =
                          !currentHasChildren &&
                          prevHasChildren &&
                          sidebarCollapsed;

                        return (
                          <React.Fragment key={index}>
                            {showDivider && <Divider sx={{ my: 0.5 }} />}
                            {renderMenuItem(item, index)}
                          </React.Fragment>
                        );
                      })}
                    </List>
                  </Collapse>
                )}
              </React.Fragment>
            );
          })}
        </List>
      </Box>

      {/* Version display - Balanced Minimal */}
      <Box
        sx={{
          p: 2,
          textAlign: 'center',
          borderTop: `1px solid ${theme.palette.divider}`,
          opacity: 0.7,
          transition: 'all 0.2s',
          '&:hover': {
            opacity: 1,
            bgcolor: 'action.hover',
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'block',
          }}
        >
          {sidebarCollapsed
            ? `${__APP_VERSION__}`
            : `Gatrix ${__APP_VERSION__}`}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar - Occupies full height (admin only) */}
      {showSidebar && (
        <Box
          component="nav"
          sx={{
            width: { xs: 0, md: sidebarCollapsed ? 64 : sidebarWidth },
            flexShrink: 0,
            zIndex: (theme) => theme.zIndex.drawer,
          }}
        >
          {/* Mobile drawer */}
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

          {/* Desktop drawer - Full height */}
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: sidebarCollapsed ? 64 : sidebarWidth,
                transition: 'width 0.3s ease',
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
      )}

      {/* Right area: AppBar + Main content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          overflow: 'hidden',
        }}
      >
        {/* Top bar - Positioned next to sidebar */}
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
          <Toolbar
            sx={{
              justifyContent: 'space-between',
              minHeight: 64,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showSidebar &&
                (isMobile ? (
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
                ))}
            </Box>

            {/* Maintenance banner - Inside AppBar */}
            {maintenanceStatus.isMaintenance && (
              <Tooltip
                title={
                  <Box sx={{ p: 1.5, minWidth: 300 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 'bold', mb: 1.5, color: '#ff6b6b' }}
                    >
                      🔧 {t('maintenance.tooltipTitle')}
                    </Typography>

                    {/* Status */}
                    <Typography
                      variant="body2"
                      sx={{ mb: 1, display: 'flex', alignItems: 'center' }}
                    >
                      <strong style={{ minWidth: '60px' }}>
                        {t('maintenance.tooltipStatus')}:
                      </strong>
                      <Box
                        component="span"
                        sx={{
                          ml: 1,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          backgroundColor: getMaintenanceStatusDisplay(
                            maintenanceStatus.status
                          ).color,
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {t(
                          getMaintenanceStatusDisplay(maintenanceStatus.status)
                            .label
                        )}
                      </Box>
                    </Typography>

                    {/* Type */}
                    {maintenanceStatus.detail?.type && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>
                          {t('maintenance.tooltipType')}:
                        </strong>{' '}
                        {(() => {
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

                    {/* Start time */}
                    {maintenanceStatus.detail?.startsAt && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>
                          {t('maintenance.tooltipStartTime')}:
                        </strong>{' '}
                        {formatDateTimeDetailed(
                          maintenanceStatus.detail.startsAt
                        )}
                      </Typography>
                    )}

                    {/* End time */}
                    {maintenanceStatus.detail?.endsAt && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong style={{ minWidth: '60px' }}>
                          {t('maintenance.tooltipEndTime')}:
                        </strong>{' '}
                        {formatDateTimeDetailed(
                          maintenanceStatus.detail.endsAt
                        )}
                      </Typography>
                    )}

                    {/* Duration */}
                    {maintenanceStatus.detail?.startsAt &&
                      maintenanceStatus.detail?.endsAt && (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong style={{ minWidth: '60px' }}>
                            {t('maintenance.tooltipDuration')}:
                          </strong>{' '}
                          {(() => {
                            const start = new Date(
                              maintenanceStatus.detail.startsAt
                            );
                            const end = new Date(
                              maintenanceStatus.detail.endsAt
                            );
                            const diffMs = end.getTime() - start.getTime();
                            const diffHours = Math.floor(
                              diffMs / (1000 * 60 * 60)
                            );
                            const diffMinutes = Math.floor(
                              (diffMs % (1000 * 60 * 60)) / (1000 * 60)
                            );

                            if (diffHours > 0) {
                              return `${diffHours}${t('maintenance.hoursUnit')} ${diffMinutes}${t('maintenance.minutesUnit')}`;
                            } else {
                              return `${diffMinutes}${t('maintenance.minutesUnit')}`;
                            }
                          })()}
                        </Typography>
                      )}

                    {/* Message */}
                    {maintenanceStatus.detail?.message && (
                      <Typography variant="body2" sx={{ mb: 1.5 }}>
                        <strong style={{ minWidth: '60px' }}>
                          {t('maintenance.tooltipMessage')}:
                        </strong>
                        <Box
                          component="div"
                          sx={{
                            mt: 0.5,
                            p: 1,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 1,
                            fontStyle: 'italic',
                            maxWidth: '250px',
                            wordBreak: 'break-word',
                          }}
                        >
                          {maintenanceStatus.detail.message}
                        </Box>
                      </Typography>
                    )}

                    <Typography
                      variant="caption"
                      onClick={handleMaintenanceBannerClick}
                      sx={{
                        fontStyle: 'italic',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        mt: 1,
                        pt: 1,
                        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                        cursor: 'pointer',
                        '&:hover': {
                          opacity: 1,
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      💡 {t('maintenance.clickToManageTooltip')}
                    </Typography>
                  </Box>
                }
                arrow
                placement="bottom"
                enterDelay={500}
                leaveDelay={300}
              >
                <Box
                  onClick={handleMaintenanceBannerClick}
                  sx={{
                    mx: 2,
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    height: 34,
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border:
                      maintenanceStatus.status === 'active'
                        ? '1.5px solid #ef5350'
                        : '1.5px solid #ffa726',
                    background:
                      maintenanceStatus.status === 'active'
                        ? 'linear-gradient(135deg, #ef5350 0%, #e53935 100%)'
                        : 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)',
                    boxShadow:
                      maintenanceStatus.status === 'active'
                        ? '0 2px 12px rgba(239, 83, 80, 0.4)'
                        : '0 2px 12px rgba(255, 167, 38, 0.4)',
                    transition: 'all 0.3s ease',
                    animation:
                      maintenanceStatus.status === 'active'
                        ? `${maintenancePulseAnimation} 2s ease-in-out infinite`
                        : 'none',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow:
                        maintenanceStatus.status === 'active'
                          ? '0 4px 16px rgba(239, 83, 80, 0.5)'
                          : '0 4px 16px rgba(255, 167, 38, 0.5)',
                    },
                  }}
                >
                  {/* Icon + Status */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.5,
                      height: '100%',
                      flexShrink: 0,
                      bgcolor: '#424242',
                      borderRight: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <Box
                      sx={{
                        fontSize: '1rem',
                        animation: `${maintenanceIconPulse} 1.5s ease-in-out infinite`,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
                      }}
                    >
                      {maintenanceStatus.status === 'active' ? '🔧' : '📅'}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#fff',
                          lineHeight: 1.2,
                          textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        }}
                      >
                        {t(
                          getMaintenanceStatusDisplay(maintenanceStatus.status)
                            .label
                        )}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          color: 'rgba(255,255,255,0.85)',
                          lineHeight: 1.1,
                          textTransform: 'uppercase',
                        }}
                      >
                        {maintenanceStatus.detail?.type === 'emergency'
                          ? t('maintenance.types.emergency')
                          : t('maintenance.types.regular')}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Message - Marquee scrolling */}
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      position: 'relative',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      '&::before, &::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: 20,
                        zIndex: 1,
                        pointerEvents: 'none',
                      },
                      '&::before': {
                        left: 0,
                        background:
                          maintenanceStatus.status === 'active'
                            ? 'linear-gradient(90deg, #e53935 0%, transparent 100%)'
                            : 'linear-gradient(90deg, #fb8c00 0%, transparent 100%)',
                      },
                      '&::after': {
                        right: 0,
                        background:
                          maintenanceStatus.status === 'active'
                            ? 'linear-gradient(90deg, transparent 0%, #e53935 100%)'
                            : 'linear-gradient(90deg, transparent 0%, #fb8c00 100%)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                        animation: `${marqueeScroll} 15s linear infinite`,
                        '&:hover': { animationPlayState: 'paused' },
                      }}
                    >
                      {[0, 1].map((idx) => (
                        <Typography
                          key={idx}
                          sx={{
                            fontSize: '0.8rem',
                            color: '#fff',
                            fontWeight: 600,
                            px: 4,
                            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          }}
                        >
                          {maintenanceStatus.detail?.message
                            ? maintenanceStatus.detail.message
                            : maintenanceStatus.detail?.startsAt &&
                                maintenanceStatus.detail?.endsAt
                              ? `${formatDateTimeDetailed(maintenanceStatus.detail.startsAt)} → ${formatDateTimeDetailed(maintenanceStatus.detail.endsAt)}`
                              : t('maintenance.clickToManageTooltip')}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Tooltip>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Chat button - visible for users with chat permission */}
              {hasPermission(P.CHAT_ACCESS) && (
                <Tooltip title={t('sidebar.chat')}>
                  <IconButton color="inherit" onClick={() => navigate('/chat')}>
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

              {/* Divider */}
              <Box
                sx={{
                  width: '1px',
                  height: '24px',
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.2)',
                  mx: 1,
                }}
              />

              <TimezoneSelector />

              {/* Divider */}
              <Box
                sx={{
                  width: '1px',
                  height: '24px',
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.2)',
                  mx: 1,
                }}
              />

              {/* Documentation button */}
              <Tooltip title={t('header.documentation')}>
                <IconButton
                  color="inherit"
                  onClick={() => window.open('/docs', '_blank')}
                >
                  <MenuBookIcon />
                </IconButton>
              </Tooltip>

              <IconButton onClick={toggleTheme} color="inherit">
                {isDark ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>

              <LanguageSelector variant="text" size="medium" />

              {/* Divider */}
              <Box
                sx={{
                  width: '1px',
                  height: '24px',
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.2)',
                  mx: 1,
                }}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton onClick={handleUserMenuOpen} color="inherit">
                  {user?.avatarUrl && !avatarImageError ? (
                    <Avatar
                      src={user.avatarUrl}
                      alt={user.name || user.email}
                      sx={{
                        width: 32,
                        height: 32,
                      }}
                      onError={() => {
                        // Replace with AccountCircle icon when image load fails
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
                        color: 'inherit',
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
            </Box>
          </Toolbar>
        </AppBar>

        {/* Floating CR notification - DraftBanner-style top pill */}
        <Slide
          direction="down"
          in={
            !!(
              !location.pathname.startsWith('/admin/change-requests') &&
              (myPendingReviewCount > 0 ||
                pendingCRCount > 0 ||
                myDraftCount > 0)
            )
          }
          mountOnEnter
          unmountOnExit
        >
          <Box
            sx={{
              position: 'fixed',
              top: 72,
              left: { xs: 0, md: sidebarCollapsed ? 64 : sidebarWidth },
              right: 0,
              zIndex: (theme) => theme.zIndex.appBar - 1,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 0.75,
                px: 2,
                borderRadius: 3,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 167, 38, 0.25)'
                    : 'rgba(255, 152, 0, 0.22)',
                backdropFilter: 'blur(12px)',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
                    : '0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
                pointerEvents: 'auto',
                maxWidth: 640,
                animation: `${crRumbleAnimation} 0.6s ease-in-out`,
              }}
            >
              {/* Lock warning */}
              {myPendingReviewCount > 0 && (
                <Box
                  onClick={() => navigate('/admin/change-requests?status=open')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    cursor: 'pointer',
                    px: 1,
                    py: 0.25,
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <LockIcon sx={{ fontSize: 14, color: 'error.main' }} />
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      color: 'error.main',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('changeRequest.pendingReviewLockBanner')}
                  </Typography>
                </Box>
              )}

              {/* Separator */}
              {myPendingReviewCount > 0 &&
                (myDraftCount > 0 || pendingCRCount > 0) && (
                  <Box
                    sx={{
                      width: '1px',
                      height: 16,
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.12)',
                    }}
                  />
                )}

              {/* My drafts */}
              {myDraftCount > 0 && (
                <Box
                  onClick={() =>
                    navigate('/admin/change-requests?status=draft')
                  }
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    cursor: 'pointer',
                    px: 1,
                    py: 0.25,
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'warning.main',
                      animation: 'crPulse 2s infinite',
                      '@keyframes crPulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                        '100%': { opacity: 1 },
                      },
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      color: 'text.primary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('changeRequest.myDraftsBanner', {
                      count: myDraftCount,
                    })}
                  </Typography>
                  <ArrowBackIcon
                    sx={{
                      transform: 'rotate(180deg)',
                      fontSize: 12,
                      color: 'text.secondary',
                    }}
                  />
                </Box>
              )}

              {/* Separator */}
              {myDraftCount > 0 && pendingCRCount > 0 && (
                <Box
                  sx={{
                    width: '1px',
                    height: 16,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.12)',
                  }}
                />
              )}

              {/* Pending approvals */}
              {pendingCRCount > 0 && (
                <Box
                  onClick={() => navigate('/admin/change-requests?status=open')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    cursor: 'pointer',
                    px: 1,
                    py: 0.25,
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      color: 'text.primary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('changeRequest.pendingReviewBanner', {
                      count: pendingCRCount,
                    })}
                  </Typography>
                  <ArrowBackIcon
                    sx={{
                      transform: 'rotate(180deg)',
                      fontSize: 12,
                      color: 'text.secondary',
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Slide>

        {/* Main content */}
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

      {/* AI Chat Floating Button & Panel */}
      <AIChatFloatingButton
        onClick={() => setAIChatOpen(true)}
        visible={!aiChatOpen && hasAnyPermissions}
      />
      <AIChatPanel open={aiChatOpen} onClose={() => setAIChatOpen(false)} />

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
      {/* SSE Notifications */}
      {/* SSE connection status is shown via G logo color */}

      {/* Shared User Menu */}
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
        PaperProps={{
          sx: {
            mt: 0.5,
            minWidth: 200,
            boxShadow: '0px 5px 15px rgba(0,0,0,0.1)',
            borderRadius: 2,
            '& .MuiMenuItem-root': {
              px: 2,
              py: 1,
              fontSize: '0.875rem',
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid ' + theme.palette.divider,
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            {user?.name || user?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
        <MenuItem
          onClick={() => {
            navigate('/profile');
            handleUserMenuClose();
          }}
        >
          <PersonIcon sx={{ mr: 1.5, fontSize: 20 }} />
          {t('sidebar.profile')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate('/settings');
            handleUserMenuClose();
          }}
        >
          <SettingsIcon sx={{ mr: 1.5, fontSize: 20 }} />
          {t('sidebar.settings')}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogoutClick} sx={{ color: 'error.main' }}>
          <LogoutIcon sx={{ mr: 1.5, fontSize: 20 }} />
          {t('sidebar.logout')}
        </MenuItem>
      </Menu>
    </Box>
  );
};
