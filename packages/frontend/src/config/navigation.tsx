/**
 * Navigation Configuration
 *
 * SINGLE SOURCE OF TRUTH for sidebar menu structure.
 * To add a new menu item, only modify MENU_CONFIG below.
 *
 * Icon names: See menuIcons.ts for available icons
 * Permissions: Use P.* constants from @/types/permissions
 */
import React from 'react';
import { Permission, P } from '@/types/permissions';
import { getIcon } from './menuIcons';

// ==================== Types ====================

export interface MenuItemConfig {
  /** Localization key for menu text */
  text: string;
  /** Icon name (see menuIcons.ts for available icons) */
  icon: string;
  /** Route path (if navigable) */
  path?: string;
  /** Required permissions (P.* constants) */
  requiredPermission?: Permission | Permission[];
  /** Child menu items */
  children?: MenuItemConfig[];
  /** Show divider before this item */
  divider?: boolean;
  /** Badge to display */
  badge?: string | number;
  /** Additional paths that should activate this menu item */
  matchPaths?: string[];
}

export interface MenuCategoryConfig {
  /** Unique identifier */
  id: string;
  /** Localization key for category text */
  text: string;
  /** Icon name */
  icon: string;
  /** Direct navigation path (optional) */
  path?: string;
  /** Child menu items */
  children: MenuItemConfig[];
  /** Badge to display */
  badge?: string | number;
  /** Conditional display based on options */
  condition?: (options: MenuOptions) => boolean;
}

export interface MenuOptions {
  requiresApproval?: boolean;
  badges?: Record<string, string | number>;
}

// ==================== Legacy Types (for compatibility) ====================

export interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path?: string;
  adminOnly?: boolean;
  requiredPermission?: Permission | Permission[];
  children?: MenuItem[];
  divider?: boolean;
  badge?: string | number;
  matchPaths?: string[];
}

export interface MenuCategory {
  id: string;
  text: string;
  icon: React.ReactElement;
  path?: string;
  adminOnly?: boolean;
  children: MenuItem[];
  badge?: string | number;
}

// ==================== Permission Helper ====================

/**
 * Get permissions for a menu item
 */
function getItemPermissions(item: MenuItemConfig): Permission[] | undefined {
  if (item.requiredPermission) {
    return Array.isArray(item.requiredPermission)
      ? item.requiredPermission
      : [item.requiredPermission];
  }
  return undefined;
}

/**
 * Get matchPaths for a menu item
 */
function getMatchPaths(item: MenuItemConfig): string[] | undefined {
  return item.matchPaths;
}

/**
 * Build a map of path -> matchPaths from the MENU_CONFIG.
 * This allows isActivePath to automatically detect alias paths
 * without hardcoding them in the sidebar component.
 */
export function getPathMatchMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  const collectMatchPaths = (items: MenuItemConfig[]) => {
    for (const item of items) {
      if (item.path && item.matchPaths && item.matchPaths.length > 0) {
        map[item.path] = item.matchPaths;
      }
      if (item.children) {
        collectMatchPaths(item.children);
      }
    }
  };

  for (const category of MENU_CONFIG) {
    collectMatchPaths(category.children);
  }

  return map;
}

// ==================== Menu Configuration ====================

export const MENU_CONFIG: MenuCategoryConfig[] = [
  // Navigation (Base menu for all users)
  {
    id: 'navigation',
    text: 'sidebar.navigation',
    icon: 'Dashboard',
    children: [
      { text: 'sidebar.dashboard', icon: 'Dashboard', path: '/dashboard' },
      { text: 'settings.general.title', icon: 'Settings', path: '/settings' },
    ],
  },

  // Workspace
  {
    id: 'workspace',
    text: 'sidebar.workspace',
    icon: 'Workspaces',
    children: [
      {
        text: 'sidebar.workspaceOverview',
        icon: 'Workspaces',
        path: '/admin/workspace',
        requiredPermission: P.PROJECTS_READ,
        matchPaths: [
          '/admin/projects',
          '/admin/environments',
          '/admin/workspace',
        ],
      },
      {
        text: 'sidebar.roles',
        icon: 'Shield',
        path: '/admin/roles',
        requiredPermission: P.ROLES_UPDATE,
        divider: true,
      },
      {
        text: 'sidebar.groups',
        icon: 'Group',
        path: '/admin/groups',
        requiredPermission: P.GROUPS_UPDATE,
      },
      {
        text: 'sidebar.userManagement',
        icon: 'People',
        path: '/admin/users',
        requiredPermission: P.USERS_UPDATE,
      },
      {
        text: 'sidebar.serviceAccounts',
        icon: 'ManageAccounts',
        path: '/admin/service-accounts',
        requiredPermission: P.SERVICE_ACCOUNTS_UPDATE,
      },
    ],
  },

  // Game Management
  {
    id: 'game-management',
    text: 'sidebar.gameManagement',
    icon: 'SportsEsports',
    children: [
      {
        text: 'sidebar.clientVersions',
        icon: 'Widgets',
        path: '/admin/client-versions',
        requiredPermission: P.CLIENT_VERSIONS_READ,
      },
      {
        text: 'sidebar.gameWorlds',
        icon: 'Language',
        path: '/admin/game-worlds',
        requiredPermission: P.GAME_WORLDS_READ,
      },
      {
        text: 'sidebar.serviceControl',
        icon: 'Build',
        requiredPermission: P.MAINTENANCE_READ,
        children: [
          {
            text: 'sidebar.maintenance',
            icon: 'Build',
            path: '/admin/maintenance',
            requiredPermission: P.MAINTENANCE_READ,
          },
          {
            text: 'sidebar.playerConnections',
            icon: 'People',
            path: '/admin/player-connections',
            requiredPermission: P.MAINTENANCE_READ,
          },
        ],
      },
      {
        text: 'sidebar.maintenanceTemplates',
        icon: 'TextFields',
        path: '/admin/maintenance-templates',
        requiredPermission: P.MAINTENANCE_TEMPLATES_READ,
      },
      {
        text: 'sidebar.serviceNotices',
        icon: 'Announcement',
        path: '/game/service-notices',
        requiredPermission: P.SERVICE_NOTICES_READ,
      },
      {
        text: 'sidebar.ingamePopupNotices',
        icon: 'Notifications',
        path: '/game/ingame-popup-notices',
        requiredPermission: P.INGAME_POPUPS_READ,
      },
      {
        text: 'sidebar.coupons',
        icon: 'ConfirmationNumber',
        requiredPermission: P.COUPONS_READ,
        children: [
          {
            text: 'sidebar.couponSettings',
            icon: 'Settings',
            path: '/game/coupon-settings',
            requiredPermission: P.COUPONS_READ,
          },
          {
            text: 'sidebar.couponUsage',
            icon: 'History',
            path: '/game/coupon-usage',
            requiredPermission: P.COUPONS_READ,
          },
        ],
      },
      {
        text: 'sidebar.surveys',
        icon: 'Poll',
        path: '/game/surveys',
        requiredPermission: P.SURVEYS_READ,
      },
      {
        text: 'sidebar.operationEvents',
        icon: 'Event',
        requiredPermission: P.OPERATION_EVENTS_READ,
        children: [
          {
            text: 'sidebar.hotTimeButtonEvent',
            icon: 'Whatshot',
            path: '/game/hot-time-button-event',
            requiredPermission: P.OPERATION_EVENTS_READ,
          },
          {
            text: 'sidebar.liveEvent',
            icon: 'Celebration',
            path: '/game/live-event',
            requiredPermission: P.OPERATION_EVENTS_READ,
          },
        ],
      },
      {
        text: 'sidebar.storeProducts',
        icon: 'Storefront',
        path: '/game/store-products',
        requiredPermission: P.STORE_PRODUCTS_READ,
      },
      {
        text: 'sidebar.rewardTemplates',
        icon: 'CardGiftcard',
        path: '/game/reward-templates',
        requiredPermission: P.REWARD_TEMPLATES_READ,
      },
      {
        text: 'sidebar.banners',
        icon: 'ViewCarousel',
        path: '/game/banners',
        requiredPermission: P.BANNERS_READ,
      },
      {
        text: 'sidebar.planningData',
        icon: 'Storage',
        requiredPermission: P.PLANNING_DATA_READ,
        children: [
          {
            text: 'sidebar.planningDataManagement',
            icon: 'Storage',
            path: '/game/planning-data',
            requiredPermission: P.PLANNING_DATA_READ,
          },
          {
            text: 'sidebar.planningDataHistory',
            icon: 'History',
            path: '/game/planning-data-history',
            requiredPermission: P.PLANNING_DATA_READ,
          },
        ],
      },
    ],
  },

  // Feature Flags
  {
    id: 'feature-flags',
    text: 'sidebar.featureFlagsCategory',
    icon: 'Flag',
    children: [
      {
        text: 'sidebar.featureFlags',
        icon: 'Flag',
        path: '/feature-flags',
        requiredPermission: P.FEATURES_READ,
      },
      {
        text: 'releaseFlow.templates',
        icon: 'Layers',
        path: '/feature-flags/templates',
        requiredPermission: P.RELEASE_FLOWS_READ,
      },
      {
        text: 'sidebar.featureSegments',
        icon: 'People',
        path: '/feature-flags/segments',
        requiredPermission: P.SEGMENTS_READ,
      },
      {
        text: 'sidebar.featureContextFields',
        icon: 'SettingsSuggest',
        path: '/feature-flags/context-fields',
        requiredPermission: P.CONTEXT_FIELDS_READ,
      },
      {
        text: 'sidebar.featureFlagTypes',
        icon: 'Category',
        path: '/feature-flags/types',
        requiredPermission: P.FEATURES_READ,
      },
      {
        text: 'sidebar.actionSets',
        icon: 'SmartToy',
        path: '/admin/actions',
        requiredPermission: P.ACTIONS_READ,
      },
      {
        text: 'sidebar.signalEndpoints',
        icon: 'Sensors',
        path: '/admin/signal-endpoints',
        requiredPermission: P.SIGNAL_ENDPOINTS_READ,
      },
      {
        text: 'sidebar.featureNetwork',
        icon: 'Hub',
        path: '/feature-flags/network',
        requiredPermission: P.FEATURES_READ,
      },
      {
        text: 'sidebar.unknownFlags',
        icon: 'HelpOutline',
        path: '/feature-flags/unknown',
        requiredPermission: P.UNKNOWN_FLAGS_READ,
      },
      {
        text: 'sidebar.impactMetrics',
        icon: 'ShowChart',
        path: '/feature-flags/impact-metrics',
        requiredPermission: P.IMPACT_METRICS_READ,
      },
    ],
  },

  // Change Requests
  {
    id: 'change-requests',
    text: 'sidebar.changeRequests',
    icon: 'Campaign',
    path: '/admin/change-requests',
    children: [
      {
        text: 'sidebar.changeRequests',
        icon: 'Campaign',
        path: '/admin/change-requests',
        requiredPermission: P.CHANGE_REQUESTS_CREATE,
      },
    ],
  },

  // Admin Panel
  {
    id: 'admin-panel',
    text: 'sidebar.adminPanel',
    icon: 'AdminPanelSettings',
    children: [
      {
        text: 'sidebar.scheduleManagement',
        icon: 'Schedule',
        requiredPermission: P.SCHEDULER_READ,
        children: [
          {
            text: 'sidebar.scheduler',
            icon: 'Schedule',
            path: '/admin/scheduler',
            requiredPermission: P.SCHEDULER_READ,
          },
          {
            text: 'sidebar.jobs',
            icon: 'Work',
            path: '/admin/jobs',
            requiredPermission: P.SCHEDULER_READ,
          },
          {
            text: 'sidebar.queueMonitor',
            icon: 'Monitor',
            path: '/admin/queue-monitor',
            requiredPermission: P.SCHEDULER_READ,
          },
        ],
      },
      {
        text: 'sidebar.auditLogs',
        icon: 'History',
        path: '/admin/audit-logs',
        requiredPermission: P.AUDIT_LOGS_READ,
      },
      {
        text: 'sidebar.realtimeEvents',
        icon: 'Timeline',
        path: '/admin/realtime-events',
        requiredPermission: P.REALTIME_EVENTS_READ,
      },
      {
        text: 'sidebar.crashes',
        icon: 'BugReport',
        path: '/admin/crashes',
        requiredPermission: P.CRASH_EVENTS_READ,
      },
      {
        text: 'sidebar.crashEvents',
        icon: 'BugReport',
        path: '/admin/crash-events',
        requiredPermission: P.CRASH_EVENTS_READ,
      },
      {
        text: 'sidebar.security',
        icon: 'Security',
        requiredPermission: P.ADMIN_TOKENS_READ,
        children: [
          {
            text: 'sidebar.apiAccessTokens',
            icon: 'VpnKey',
            path: '/admin/api-tokens',
            requiredPermission: P.ADMIN_TOKENS_READ,
          },
          {
            text: 'sidebar.whitelist',
            icon: 'Security',
            path: '/admin/whitelist',
            requiredPermission: P.IP_WHITELIST_READ,
          },
        ],
      },
      {
        text: 'sidebar.serverManagement',
        icon: 'Dns',
        requiredPermission: P.SERVERS_READ,
        children: [
          {
            text: 'sidebar.serverList',
            icon: 'Storage',
            path: '/admin/server-list',
            requiredPermission: P.SERVERS_READ,
          },
          {
            text: 'sidebar.serverLifecycle',
            icon: 'History',
            path: '/admin/server-lifecycle',
            requiredPermission: P.SERVERS_READ,
          },
          {
            text: 'sidebar.gatrixEdges',
            icon: 'Dns',
            path: '/admin/gatrix-edges',
            requiredPermission: P.SERVERS_READ,
          },
        ],
      },
      {
        text: 'sidebar.monitoring',
        icon: 'Monitor',
        requiredPermission: P.MONITORING_READ,
        children: [
          {
            text: 'sidebar.grafana',
            icon: 'Monitor',
            path: '/admin/grafana-dashboard',
            requiredPermission: P.MONITORING_READ,
          },
          {
            text: 'sidebar.logs',
            icon: 'Monitor',
            path: '/monitoring/logs',
            requiredPermission: P.MONITORING_READ,
          },
          {
            text: 'sidebar.alerts',
            icon: 'Notifications',
            path: '/monitoring/alerts',
            requiredPermission: P.MONITORING_READ,
          },
        ],
      },
      {
        text: 'sidebar.openApi',
        icon: 'Api',
        path: '/admin/open-api',
        requiredPermission: P.OPEN_API_READ,
      },
      {
        text: 'settings.systemSettings',
        icon: 'Settings',
        path: '/settings/system',
        requiredPermission: P.SYSTEM_SETTINGS_READ,
      },
    ],
  },
];

// ==================== Config to Runtime Conversion ====================

/**
 * Convert MenuItemConfig to MenuItem (with React.ReactElement icons)
 */
function convertMenuItem(config: MenuItemConfig): MenuItem {
  const permissions = getItemPermissions(config);

  return {
    text: config.text,
    icon: getIcon(config.icon),
    path: config.path,
    adminOnly: !!config.requiredPermission,
    requiredPermission: permissions,
    children: config.children?.map(convertMenuItem),
    divider: config.divider,
    badge: config.badge,
    matchPaths: getMatchPaths(config),
  };
}

/**
 * Convert MenuCategoryConfig to MenuCategory
 */
function convertCategory(
  config: MenuCategoryConfig,
  badges?: Record<string, string | number>
): MenuCategory {
  // A category is admin-only if any of its children require permissions
  const hasPermissionChild = config.children.some(
    (c) => !!c.requiredPermission
  );
  return {
    id: config.id,
    text: config.text,
    icon: getIcon(config.icon),
    path: config.path,
    adminOnly: hasPermissionChild,
    children: config.children.map(convertMenuItem),
    badge: badges?.[config.text] || config.badge,
  };
}

// ==================== Public API (Legacy Compatible) ====================

/**
 * Get menu categories for sidebar
 * This is the main function used by MainLayout
 */
export const getMenuCategories = (
  isAdmin: boolean,
  badges?: Record<string, string | number>,
  options?: MenuOptions
): MenuCategory[] => {
  const mergedOptions: MenuOptions = { ...options, badges };

  // Filter and convert categories
  const categories = MENU_CONFIG.filter((config) => {
    // Check if category has permission-gated children (admin-only)
    const hasPermissionChild = config.children.some(
      (c) => !!c.requiredPermission
    );
    if (hasPermissionChild && !isAdmin) return false;
    // Check condition
    if (config.condition && !config.condition(mergedOptions)) return false;
    return true;
  }).map((config) => convertCategory(config, badges));

  // Apply badges recursively
  if (badges) {
    categories.forEach((category) => {
      const applyBadges = (items: MenuItem[]): void => {
        items.forEach((item) => {
          if (badges[item.text]) item.badge = badges[item.text];
          if (item.children) applyBadges(item.children);
        });
      };
      applyBadges(category.children);

      // Sum badges for category
      const sumBadges = (items: MenuItem[]): number => {
        return items.reduce((sum, item) => {
          const itemBadge = typeof item.badge === 'number' ? item.badge : 0;
          const childrenSum = item.children ? sumBadges(item.children) : 0;
          return sum + itemBadge + childrenSum;
        }, 0);
      };
      const total = sumBadges(category.children);
      if (total > 0) category.badge = total;
    });
  }

  return categories;
};

/**
 * Get all menu items (flat list for compatibility)
 */
export const getAllMenuItems = (isAdmin: boolean): MenuItem[] => {
  if (!isAdmin) {
    // Return only navigation items for non-admin
    const navConfig = MENU_CONFIG.find((c) => c.id === 'navigation');
    return navConfig ? navConfig.children.map(convertMenuItem) : [];
  }

  // Return all items for admin
  return MENU_CONFIG.flatMap((config) => config.children.map(convertMenuItem));
};

// ==================== Legacy Exports (for Sidebar.tsx compatibility) ====================

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  children?: NavItem[];
  roles?: string[];
  divider?: boolean;
}

export const menuItemToNavItem = (
  item: MenuItem,
  _parentPath?: string
): NavItem => {
  const iconName = (() => {
    const type = item.icon.type as any;
    if (type) {
      return (type.displayName || type.name || 'Dashboard').replace('Icon', '');
    }
    return 'Dashboard';
  })();

  const id = item.path
    ? item.path.replace(/\//g, '-').replace(/^-/, '')
    : item.text.replace(/\./g, '-').toLowerCase();

  return {
    id,
    label: item.text,
    icon: iconName,
    path: item.path,
    roles: item.adminOnly ? ['admin'] : undefined,
    divider: item.divider,
    children: item.children?.map((child) =>
      menuItemToNavItem(child, item.path)
    ),
  };
};

export const getNavigationItems = (isAdmin: boolean): NavItem[] => {
  const items = getAllMenuItems(isAdmin);
  return items.map((item) => menuItemToNavItem(item));
};
