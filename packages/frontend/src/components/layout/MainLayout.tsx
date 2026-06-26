import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
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
  Menu as MenuIcon,
  MenuBook as MenuBookIcon,
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
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/services/auth';
import { useTranslation } from 'react-i18next';
import {
  usePageHeaderContext,
  PageHeaderProvider,
} from '@/contexts/PageHeaderContext';
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
import aiChatService from '@/services/aiChatService';
import AIChatPanel, { AIChatFloatingButton } from '@/components/ai/AIChatPanel';
import { Permission, P } from '@/types/permissions';
import NavigationRail, { RAIL_WIDTH } from '@/components/layout/NavigationRail';
import NavigationSubPanel, {
  SUBPANEL_WIDTH,
} from '@/components/layout/NavigationSubPanel';

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

/**
 * AppBarPageHeader - Renders page header content from PageHeaderContext inside the AppBar.
 * This replaces the old standalone PageHeader row, saving ~48px of vertical space.
 */
const AppBarPageHeader: React.FC<{
  showSidebar: boolean;
  isMobile: boolean;
  onDrawerToggle: () => void;
  subPanelOpen?: boolean;
}> = ({ showSidebar, isMobile, onDrawerToggle, subPanelOpen }) => {
  const { headerProps } = usePageHeaderContext();

  const showRightSection = headerProps
    ? headerProps.tabs || headerProps.actions || headerProps.headerActions
    : false;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
        gap: 1,
        pl: showSidebar && !isMobile && subPanelOpen ? 1.5 : 0,
        transition: 'padding-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Mobile hamburger */}
      {showSidebar && isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onDrawerToggle}
          sx={{ mr: 0.5 }}
        >
          <MenuIcon />
        </IconButton>
      )}

      {/* PageHeader left: icon + title + subtitle */}
      {headerProps && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
              flexShrink: 1,
              overflow: 'hidden',
            }}
          >
            {headerProps.icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: '6px',
                  background: (theme: any) =>
                    `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  color: '#fff',
                  '& .MuiSvgIcon-root': { fontSize: '0.95rem' },
                }}
              >
                {headerProps.icon}
              </Box>
            )}
            {typeof headerProps.title === 'string' ? (
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {headerProps.title}
              </Typography>
            ) : (
              headerProps.title
            )}
            {headerProps.subtitle && (
              <>
                <Box
                  sx={{
                    width: '1px',
                    height: 16,
                    bgcolor: 'divider',
                    flexShrink: 0,
                    mx: 0.5,
                  }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '0.8rem',
                  }}
                >
                  {headerProps.subtitle}
                </Typography>
              </>
            )}
          </Box>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* PageHeader right: tabs + actions + context menu */}
          {showRightSection && (
            <Box
              sx={{
                display: 'flex',
                gap: 0.75,
                alignItems: 'center',
                flexShrink: 0,
                ml: 2,
                // Compact action buttons globally
                '& .MuiButton-root': {
                  textTransform: 'none',
                  fontWeight: '600 !important',
                  fontSize: '0.78rem !important',
                  minHeight: '28px !important',
                  maxHeight: '28px !important',
                  height: '28px !important',
                  lineHeight: '1 !important',
                  padding: '2px 10px !important',
                  '& .MuiButton-startIcon': {
                    mr: 0.5,
                    '& .MuiSvgIcon-root': {
                      fontSize: '0.85rem !important',
                    },
                  },
                  '& .MuiButton-endIcon': {
                    ml: 0.25,
                    '& .MuiSvgIcon-root': {
                      fontSize: '0.85rem !important',
                    },
                  },
                },
                '& .MuiButton-root:not(.MuiButtonGroup-grouped)': {},
                '& .MuiIconButton-root': {
                  width: '28px !important',
                  height: '28px !important',
                  padding: '4px !important',
                  '& .MuiSvgIcon-root': { fontSize: '1rem !important' },
                },
              }}
            >
              {headerProps.headerActions}
              {headerProps.tabs}
              {headerProps.actions}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Recent pages state
  const RECENT_PAGES_KEY = 'sidebarRecentPages';
  const MAX_RECENT_PAGES = 5;
  const EXCLUDED_RECENT_PATHS = ['/dashboard', '/settings', '/logout'];

  interface RecentPageEntry {
    path: string;
    text: string; // i18n key for the leaf menu item
    parentText?: string; // i18n key for parent context (category or parent menu)
    iconName: string; // icon component name for lookup
  }

  const [recentPages, setRecentPages] = useState<RecentPageEntry[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_PAGES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Recent page confirm dialog state
  const [recentPageConfirm, setRecentPageConfirm] = useState<{
    open: boolean;
    type: 'clearAll' | 'remove';
    path?: string;
    text?: string;
  }>({ open: false, type: 'clearAll' });

  // === Two-Level Rail state ===
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem('railActiveCategoryId') || null;
      } catch {
        return null;
      }
    }
  );
  const [subPanelOpen, setSubPanelOpen] = useState(() => {
    try {
      return localStorage.getItem('railSubPanelOpen') !== 'false';
    } catch {
      return true;
    }
  });

  // Computed sidebar width for offset calculations
  const sidebarCollapsed = !subPanelOpen;
  const sidebarWidth = subPanelOpen ? RAIL_WIDTH + SUBPANEL_WIDTH : RAIL_WIDTH;

  const location = useLocation();
  const { user, logout, hasPermission, permissions, permissionsLoading } =
    useAuth();
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
  const [aiEnabled, setAiEnabled] = useState(false);

  // Check AI availability on mount
  useEffect(() => {
    let cancelled = false;
    aiChatService
      .getStatus()
      .then((status) => {
        if (!cancelled) setAiEnabled(status.available);
      })
      .catch(() => {
        if (!cancelled) setAiEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

        // Expand the category section (accordion: close others)
        const categoryKey = `category-${category.id}`;
        setExpandedSubmenus((prev) => {
          const newState = { ...prev };
          // Close all other categories
          for (const cat of categories) {
            const key = `category-${cat.id}`;
            if (key !== categoryKey) {
              newState[key] = false;
            }
          }
          newState[categoryKey] = true;
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

        // Find and expand the submenu that contains this path
        const submenuIndex = findSubmenuIndex(category.children, currentPath);
        if (submenuIndex >= 0) {
          const submenuKey = `submenu-${submenuIndex}`;
          // Always enforce accordion: close sibling submenus
          setExpandedSubmenus((prev) => {
            const newState = { ...prev };
            // Close all sibling submenus in this category
            category.children.forEach((_, sibIdx) => {
              const sibKey = `submenu-${sibIdx}`;
              if (sibKey !== submenuKey) {
                newState[sibKey] = false;
              }
            });
            newState[submenuKey] = true;
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

        initialSyncDoneRef.current = true;
        return; // Found the category, no need to continue
      }
    }

    initialSyncDoneRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, getFilteredMenuCategories]);

  // Expand the sidebar category and submenu for a given path (used by recent pages)
  const expandSidebarForPath = useCallback(
    (targetPath: string) => {
      const categories = getFilteredMenuCategories();

      const findPathInItem = (item: NavMenuItem, path: string): boolean => {
        if (item.path === path) return true;
        if (item.children) {
          return item.children.some((child) => findPathInItem(child, path));
        }
        return false;
      };

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
            return -1;
          }
        }
        return -1;
      };

      for (const category of categories) {
        // Check if this category directly has the path
        if (category.path === targetPath) return;

        const hasPath = category.children.some((item) =>
          findPathInItem(item, targetPath)
        );
        if (!hasPath) continue;

        if (category.id === 'navigation') return;

        const categoryKey = `category-${category.id}`;

        setExpandedSubmenus((prev) => {
          const newState = { ...prev };
          // Accordion: close other categories
          for (const cat of categories) {
            const key = `category-${cat.id}`;
            if (key !== categoryKey) {
              newState[key] = false;
            }
          }
          newState[categoryKey] = true;

          // Find and expand the submenu, close siblings
          const submenuIndex = findSubmenuIndex(category.children, targetPath);
          if (submenuIndex >= 0) {
            const submenuKey = `submenu-${submenuIndex}`;
            category.children.forEach((_, sibIdx) => {
              const sibKey = `submenu-${sibIdx}`;
              if (sibKey !== submenuKey) {
                newState[sibKey] = false;
              }
            });
            newState[submenuKey] = true;
          }

          try {
            localStorage.setItem(
              'sidebarExpandedSubmenus',
              JSON.stringify(newState)
            );
          } catch (e) {
            console.warn('Failed to save expanded submenus:', e);
          }
          return newState;
        });

        return;
      }
    },
    [getFilteredMenuCategories]
  );

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

  // Maintenance banner state - restore from sessionStorage to survive MainLayout remounts
  // (remounts happen when navigating between routes using MainLayout vs EnvironmentAwareLayout)
  const MAINT_CACHE_KEY = 'gatrix_maintenance_status';
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    isMaintenance: boolean;
    status: MaintenanceStatusType;
    detail: MaintenanceDetail | null;
  }>(() => {
    try {
      const cached = sessionStorage.getItem(MAINT_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.isMaintenance === 'boolean') {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    return { isMaintenance: false, status: 'inactive', detail: null };
  });
  const [maintenanceTooltipOpen, setMaintenanceTooltipOpen] = useState(false);
  const prevMaintenanceRef = useRef<{
    isMaintenance: boolean;
    status: MaintenanceStatusType;
    updatedAt?: string | null;
  } | null>(null);
  // If SSE already updated the status, avoid overwriting with initial fetch result
  const maintenanceUpdatedBySSE = useRef(false);
  const maintenanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Persist maintenance status to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem(
        MAINT_CACHE_KEY,
        JSON.stringify(maintenanceStatus)
      );
    } catch {
      /* ignore */
    }
  }, [maintenanceStatus]);

  // Track previous environment to detect actual changes
  const prevEnvironmentIdRef = useRef<string | null>(null);
  const maintenanceInitialFetchDone = useRef(false);

  // Initial load - only for admin users with environment access
  useEffect(() => {
    // Skip maintenance status check for users without environment access or no environment selected
    if (!hasEnvironmentAccess || !currentEnvironmentId) {
      return;
    }

    const isSameEnvironment =
      prevEnvironmentIdRef.current === currentEnvironmentId;

    // Skip re-fetch if same environment already loaded (SSE keeps it up-to-date)
    if (isSameEnvironment && maintenanceInitialFetchDone.current) {
      return;
    }

    // Reset state only when switching to a different environment
    if (prevEnvironmentIdRef.current !== null && !isSameEnvironment) {
      maintenanceUpdatedBySSE.current = false;
      prevMaintenanceRef.current = null;
      setMaintenanceStatus({
        isMaintenance: false,
        status: 'inactive',
        detail: null,
      });
    }
    prevEnvironmentIdRef.current = currentEnvironmentId;

    let cancelled = false;
    const projectApiPath = getProjectApiPath();
    maintenanceService
      .getStatus(projectApiPath)
      .then(({ isUnderMaintenance, detail }) => {
        if (cancelled) return;
        if (maintenanceUpdatedBySSE.current) return;
        maintenanceInitialFetchDone.current = true;
        const nextIsMaintenance = !!isUnderMaintenance;
        const status = computeMaintenanceStatus(nextIsMaintenance, detail);
        const nextDetail = detail || null;
        setMaintenanceStatus((prev) => {
          if (
            prev.isMaintenance === nextIsMaintenance &&
            prev.status === status &&
            JSON.stringify(prev.detail) === JSON.stringify(nextDetail)
          ) {
            return prev;
          }
          return {
            isMaintenance: nextIsMaintenance,
            status,
            detail: nextDetail,
          };
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (maintenanceUpdatedBySSE.current) return;
        maintenanceInitialFetchDone.current = true;
        // Keep existing state on error - don't reset a visible banner
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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Rail: category select (toggle sub-panel or switch category)
  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      if (activeCategoryId === categoryId && subPanelOpen) {
        // Same category clicked again ??close sub-panel
        setSubPanelOpen(false);
        try {
          localStorage.setItem('railSubPanelOpen', 'false');
        } catch {}
      } else {
        // New category or panel was closed ??open sub-panel for this category
        setActiveCategoryId(categoryId);
        setSubPanelOpen(true);
        try {
          localStorage.setItem('railActiveCategoryId', categoryId);
          localStorage.setItem('railSubPanelOpen', 'true');
        } catch {}
      }
    },
    [activeCategoryId, subPanelOpen]
  );

  // Rail: toggle sub-panel (from SubPanel close button)
  const handleSubPanelClose = useCallback(() => {
    setSubPanelOpen(false);
    try {
      localStorage.setItem('railSubPanelOpen', 'false');
    } catch {}
  }, []);

  // Rail: sub-menu accordion toggle (inside SubPanel)
  const handleRailToggleSubmenu = useCallback(
    (key: string, siblingIndices: number[]) => {
      setExpandedSubmenus((prev) => {
        const newState = { ...prev };
        siblingIndices.forEach((i) => {
          const sibKey = `submenu-${i}`;
          if (sibKey !== key) newState[sibKey] = false;
        });
        newState[key] = !prev[key];
        try {
          localStorage.setItem(
            'sidebarExpandedSubmenus',
            JSON.stringify(newState)
          );
        } catch {}
        return newState;
      });
    },
    []
  );

  const handleSidebarToggle = () => {
    // Toggle sub-panel open/close (for AppBar hamburger button compat)
    const newOpen = !subPanelOpen;
    setSubPanelOpen(newOpen);
    try {
      localStorage.setItem('railSubPanelOpen', String(newOpen));
    } catch {}
  };

  const handleMaintenanceBannerClick = () => {
    setMaintenanceTooltipOpen(false);
    navigate('/admin/maintenance');
  };

  const handleLogoutClick = () => {
    navigate('/logout');
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

    // Special handling for /feature-flags to prevent it from being highlighted
    // when we are inside a distinct sub-menu (like /feature-flags/segments).
    // However, it SHOULD be highlighted if we are in a feature flag detail page.
    if (path === '/feature-flags') {
      const subMenus = [
        '/feature-flags/segments',
        '/feature-flags/context-fields',
        '/feature-flags/types',
        '/feature-flags/templates',
        '/feature-flags/actions',
        '/feature-flags/network',
        '/feature-flags/impact-metrics',
        '/feature-flags/unknown',
        '/feature-flags/bulk-operations',
      ];
      if (subMenus.some((sub) => location.pathname.startsWith(sub))) {
        return false;
      }
      if (location.pathname.startsWith('/feature-flags/')) {
        return true;
      }
      return false;
    }

    // Special handling for /argus/analytics: prevent highlighting when we are
    // inside a distinct sub-menu (like /argus/analytics/cohorts).
    // Only the original tab pages (insights/funnels/retention/flows) should
    // keep the parent highlighted.
    if (path === '/argus/analytics') {
      const analyticsSubMenus = [
        '/argus/analytics/users',
        '/argus/analytics/cohorts',
        '/argus/analytics/realtime',
        '/argus/analytics/impact',
        '/argus/analytics/monetization',
        '/argus/analytics/lifecycle',
        '/argus/analytics/kpi-alerts',
        '/argus/analytics/data-governance',
      ];
      if (analyticsSubMenus.some((sub) => location.pathname.startsWith(sub))) {
        return false;
      }
    }

    // /settings uses exact match only to prevent /settings matching /settings/members
    if (path === '/settings') {
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

  // Find menu item info by path for recent pages tracking
  const findMenuItemByPath = useCallback(
    (
      path: string
    ): { text: string; parentText?: string; iconName: string } | null => {
      const categories = getFilteredMenuCategories();
      for (const category of categories) {
        // Check category-level path (e.g., change requests, dashboard)
        if (category.path === path) {
          return { text: category.text, iconName: category.text };
        }
        for (const item of category.children) {
          if (item.path === path) {
            return {
              text: item.text,
              parentText: category.text,
              iconName: item.text,
            };
          }
          if (item.children) {
            for (const child of item.children) {
              if (child.path === path) {
                return {
                  text: child.text,
                  parentText: item.text,
                  iconName: child.text,
                };
              }
            }
          }
        }
      }
      return null;
    },
    [getFilteredMenuCategories]
  );

  // Add a page to recent pages list
  const addRecentPage = useCallback(
    (path: string) => {
      if (EXCLUDED_RECENT_PATHS.some((p) => path.startsWith(p))) return;
      if (/^https?:\/\//i.test(path)) return;

      const menuInfo = findMenuItemByPath(path);
      if (!menuInfo) return;

      setRecentPages((prev) => {
        // Already at the top — skip re-render entirely
        if (prev.length > 0 && prev[0].path === path) return prev;

        // Remove if already in list (will be re-inserted at top)
        const filtered = prev.filter((p) => p.path !== path);

        // Insert at top, trim to max
        const updated = [
          {
            path,
            text: menuInfo.text,
            parentText: menuInfo.parentText,
            iconName: menuInfo.iconName,
          },
          ...filtered,
        ].slice(0, MAX_RECENT_PAGES);
        try {
          localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save recent pages:', e);
        }
        return updated;
      });
    },
    [findMenuItemByPath]
  );

  // Remove a single page from recent pages
  const removeRecentPage = useCallback((path: string) => {
    setRecentPages((prev) => {
      const updated = prev.filter((p) => p.path !== path);
      try {
        localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent pages:', e);
      }
      return updated;
    });
  }, []);

  // Clear all recent pages
  const clearRecentPages = useCallback(() => {
    setRecentPages([]);
    try {
      localStorage.removeItem(RECENT_PAGES_KEY);
    } catch (e) {
      console.warn('Failed to clear recent pages:', e);
    }
  }, []);

  // Open external http(s) links in new tab; otherwise navigate within SPA

  // Filter recent pages by current permissions (hide pages user no longer has access to)
  const filteredRecentPages = useMemo(() => {
    return recentPages.filter((page) => findMenuItemByPath(page.path) !== null);
  }, [recentPages, findMenuItemByPath]);

  const openOrNavigate = (
    path: string,
    options?: { skipRecentUpdate?: boolean }
  ) => {
    if (path === '/logout') {
      handleLogoutClick();
    } else if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
    } else {
      if (!options?.skipRecentUpdate) {
        flushSync(() => addRecentPage(path));
      }
      navigate(path, { state: { fromSidebar: true } });
    }
  };

  // Auto-select rail category based on current URL
  useEffect(() => {
    const categories = getFilteredMenuCategories();
    for (const cat of categories) {
      // Check category-level path
      if (cat.path && isActivePath(cat.path)) {
        setActiveCategoryId(cat.id);
        try {
          localStorage.setItem('railActiveCategoryId', cat.id);
        } catch {}
        // Direct-nav categories (no children, e.g. dashboard/settings) should close the sub-panel
        const isDirectNav = !!cat.path && cat.children.length === 0;
        if (isDirectNav) {
          setSubPanelOpen(false);
          try {
            localStorage.setItem('railSubPanelOpen', 'false');
          } catch {}
        }
        return;
      }
      // Check children paths
      for (const item of cat.children) {
        if (item.path && isActivePath(item.path)) {
          setActiveCategoryId(cat.id);
          try {
            localStorage.setItem('railActiveCategoryId', cat.id);
          } catch {}
          return;
        }
        if (item.children) {
          for (const child of item.children) {
            if (child.path && isActivePath(child.path)) {
              setActiveCategoryId(cat.id);
              try {
                localStorage.setItem('railActiveCategoryId', cat.id);
              } catch {}
              return;
            }
          }
        }
      }
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get the currently selected category for the sub-panel
  const selectedCategory = useMemo(() => {
    if (!activeCategoryId) return null;
    const categories = getFilteredMenuCategories();
    return categories.find((c) => c.id === activeCategoryId) || null;
  }, [activeCategoryId, getFilteredMenuCategories]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Two-Level Rail Navigation (desktop) */}
      {showSidebar && !isMobile && (
        <Box
          component="nav"
          sx={{
            display: 'flex',
            flexShrink: 0,
            height: '100vh',
            zIndex: (theme) => theme.zIndex.drawer,
          }}
        >
          <NavigationRail
            categories={getFilteredMenuCategories()}
            activeCategoryId={activeCategoryId}
            subPanelOpen={subPanelOpen}
            onCategorySelect={handleCategorySelect}
            onDirectNavigate={openOrNavigate}
            onRailClick={handleSidebarToggle}
            sseConnectionStatus={sseConnection.connectionStatus}
            onLogoClick={() => navigate('/dashboard')}
          />
          <NavigationSubPanel
            category={selectedCategory}
            isOpen={subPanelOpen}
            onClose={handleSubPanelClose}
            recentPages={filteredRecentPages}
            onNavigate={openOrNavigate}
            onRemoveRecent={(path) =>
              setRecentPageConfirm({
                open: true,
                type: 'remove',
                path,
                text: filteredRecentPages.find((p) => p.path === path)?.text,
              })
            }
            onClearRecent={() =>
              setRecentPageConfirm({ open: true, type: 'clearAll' })
            }
            isActivePath={isActivePath}
            expandedSubmenus={expandedSubmenus}
            onToggleSubmenu={handleRailToggleSubmenu}
          />
        </Box>
      )}

      {/* Mobile drawer fallback */}
      {showSidebar && isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: SUBPANEL_WIDTH + RAIL_WIDTH,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: 'none',
            },
          }}
        >
          <Box sx={{ display: 'flex', height: '100%' }}>
            <NavigationRail
              categories={getFilteredMenuCategories()}
              activeCategoryId={activeCategoryId}
              subPanelOpen={true}
              onCategorySelect={handleCategorySelect}
              onDirectNavigate={(path) => {
                openOrNavigate(path);
                setMobileOpen(false);
              }}
              onRailClick={() => {}}
              sseConnectionStatus={sseConnection.connectionStatus}
              onLogoClick={() => {
                navigate('/dashboard');
                setMobileOpen(false);
              }}
            />
            <NavigationSubPanel
              category={selectedCategory}
              isOpen={true}
              onClose={() => setMobileOpen(false)}
              recentPages={filteredRecentPages}
              onNavigate={(path, options) => {
                openOrNavigate(path, options);
                setMobileOpen(false);
              }}
              onRemoveRecent={(path) =>
                setRecentPageConfirm({
                  open: true,
                  type: 'remove',
                  path,
                  text: filteredRecentPages.find((p) => p.path === path)?.text,
                })
              }
              onClearRecent={() =>
                setRecentPageConfirm({ open: true, type: 'clearAll' })
              }
              isActivePath={isActivePath}
              expandedSubmenus={expandedSubmenus}
              onToggleSubmenu={handleRailToggleSubmenu}
            />
          </Box>
        </Drawer>
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
        <PageHeaderProvider>
          {/* Top bar - Positioned next to sidebar */}
          <AppBar
            position="static"
            sx={{
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              boxShadow: 'none',
              borderBottom: '1px solid',
              borderColor: 'divider',
              zIndex: (theme) => theme.zIndex.appBar,
            }}
          >
            <Toolbar
              sx={{
                justifyContent: 'space-between',
                minHeight: '63px !important',
                px: { xs: 1, sm: 2 },
              }}
            >
              {/* Left: Mobile hamburger + PageHeader content from context */}
              <AppBarPageHeader
                showSidebar={showSidebar}
                isMobile={isMobile}
                onDrawerToggle={handleDrawerToggle}
                subPanelOpen={subPanelOpen}
              />
            </Toolbar>
          </AppBar>

          {/* Maintenance banner - Outside AppBar, only when active */}
          <Slide
            direction="down"
            in={maintenanceStatus.isMaintenance}
            mountOnEnter
            unmountOnExit
          >
            <Tooltip
              title={
                <Box sx={{ minWidth: 280, maxWidth: 320 }}>
                  {/* Header with accent bar */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      pb: 1,
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
                    >
                      {t('maintenance.tooltipTitle')}
                    </Typography>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 0.75,
                        bgcolor: getMaintenanceStatusDisplay(
                          maintenanceStatus.status
                        ).color,
                        color: '#fff',
                        fontSize: '0.675rem',
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {t(
                        getMaintenanceStatusDisplay(maintenanceStatus.status)
                          .label
                      )}
                    </Box>
                  </Box>

                  {/* Info rows */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: '6px 12px',
                      p: 1.5,
                      fontSize: '0.8rem',
                    }}
                  >
                    {maintenanceStatus.detail?.type && (
                      <>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255,255,255,0.5)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('maintenance.tooltipType')}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
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
                      </>
                    )}
                    {maintenanceStatus.detail?.startsAt && (
                      <>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255,255,255,0.5)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('maintenance.tooltipStartTime')}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
                          {formatDateTimeDetailed(
                            maintenanceStatus.detail.startsAt
                          )}
                        </Typography>
                      </>
                    )}
                    {maintenanceStatus.detail?.endsAt && (
                      <>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(255,255,255,0.5)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('maintenance.tooltipEndTime')}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
                          {formatDateTimeDetailed(
                            maintenanceStatus.detail.endsAt
                          )}
                        </Typography>
                      </>
                    )}
                    {maintenanceStatus.detail?.startsAt &&
                      maintenanceStatus.detail?.endsAt && (
                        <>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255,255,255,0.5)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t('maintenance.tooltipDuration')}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 500 }}
                          >
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
                              }
                              return `${diffMinutes}${t('maintenance.minutesUnit')}`;
                            })()}
                          </Typography>
                        </>
                      )}
                  </Box>

                  {maintenanceStatus.detail?.message && (
                    <Box
                      sx={{
                        mx: 1.5,
                        mb: 1,
                        p: 1,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        borderRadius: 1,
                        borderLeft: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          wordBreak: 'break-word',
                          lineHeight: 1.5,
                          display: 'block',
                        }}
                      >
                        {maintenanceStatus.detail.message}
                      </Typography>
                    </Box>
                  )}

                  <Box
                    onClick={handleMaintenanceBannerClick}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      py: 1,
                      mx: 1.5,
                      mb: 1,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                    >
                      {t('maintenance.clickToManageTooltip')}
                    </Typography>
                  </Box>
                </Box>
              }
              arrow
              placement="bottom"
              enterDelay={500}
              leaveDelay={300}
              open={maintenanceTooltipOpen}
              onOpen={() => setMaintenanceTooltipOpen(true)}
              onClose={() => setMaintenanceTooltipOpen(false)}
            >
              <Box
                onClick={handleMaintenanceBannerClick}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 34,
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
                    {maintenanceStatus.status === 'active' ? '🔧' : '⏳'}
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
          </Slide>

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
                left: { xs: 0, md: sidebarWidth },
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
                    onClick={() =>
                      navigate('/admin/change-requests?status=open')
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
                    onClick={() =>
                      navigate('/admin/change-requests?status=open')
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
            id="main-scroll-container"
            sx={{
              flexGrow: 1,
              p: 2,
              backgroundColor: 'background.default',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {children}
          </Box>
        </PageHeaderProvider>
      </Box>

      {/* AI Chat Floating Button & Panel */}
      <AIChatFloatingButton
        onClick={() => setAIChatOpen(true)}
        visible={!aiChatOpen && hasAnyPermissions && aiEnabled}
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

      {/* Recent Page Confirm Dialog */}
      <Dialog
        open={recentPageConfirm.open}
        onClose={() => setRecentPageConfirm({ open: false, type: 'clearAll' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {recentPageConfirm.type === 'clearAll'
            ? t('sidebar.clearRecentPages')
            : t('sidebar.removeRecentPage')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {recentPageConfirm.type === 'clearAll'
              ? t('sidebar.clearRecentPagesConfirm')
              : t('sidebar.removeRecentPageConfirm', {
                  name: recentPageConfirm.text ? t(recentPageConfirm.text) : '',
                })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() =>
              setRecentPageConfirm({ open: false, type: 'clearAll' })
            }
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (recentPageConfirm.type === 'clearAll') {
                clearRecentPages();
              } else if (recentPageConfirm.path) {
                removeRecentPage(recentPageConfirm.path);
              }
              setRecentPageConfirm({ open: false, type: 'clearAll' });
            }}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
