/**
 * Navigation Configuration
 *
 * SINGLE SOURCE OF TRUTH for sidebar menu structure.
 * To add a new menu item, only modify MENU_CONFIG below.
 *
 * Icon names: See menuIcons.ts for available icons
 * Permission shorthand: 'users' auto-expands to ['users.view', 'users.manage']
 */
import React from 'react';
import { Permission, PERMISSIONS } from '@/types/permissions';
import { getIcon } from './menuIcons';

// ==================== Types ====================

export interface MenuItemConfig {
  /** Localization key for menu text */
  text: string;
  /** Icon name (see menuIcons.ts for available icons) */
  icon: string;
  /** Route path (if navigable) */
  path?: string;
  /** Permission shorthand (e.g., 'users' -> 'users.view', 'users.manage') */
  permission?: string;
  /** Explicit permissions (overrides permission shorthand) */
  requiredPermission?: Permission | Permission[];
  /** Child menu items */
  children?: MenuItemConfig[];
  /** Show divider before this item */
  divider?: boolean;
  /** Badge to display */
  badge?: string | number;
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
  /** Admin-only category */
  adminOnly?: boolean;
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
 * Expand permission shorthand to full permission array
 * e.g., 'users' -> [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]
 */
function expandPermission(shorthand: string): Permission[] {
  const key = shorthand.toUpperCase().replace(/-/g, '_');
  const viewKey = `${key}_VIEW` as keyof typeof PERMISSIONS;
  const manageKey = `${key}_MANAGE` as keyof typeof PERMISSIONS;

  const permissions: Permission[] = [];
  if (PERMISSIONS[viewKey]) permissions.push(PERMISSIONS[viewKey]);
  if (PERMISSIONS[manageKey]) permissions.push(PERMISSIONS[manageKey]);

  // If no view/manage, try direct key (e.g., AUDIT_LOGS_VIEW)
  if (permissions.length === 0) {
    const directKey = key as keyof typeof PERMISSIONS;
    if (PERMISSIONS[directKey]) permissions.push(PERMISSIONS[directKey]);
  }

  return permissions;
}

/**
 * Get permissions for a menu item
 */
function getItemPermissions(item: MenuItemConfig): Permission[] | undefined {
  if (item.requiredPermission) {
    return Array.isArray(item.requiredPermission)
      ? item.requiredPermission
      : [item.requiredPermission];
  }
  if (item.permission) {
    return expandPermission(item.permission);
  }
  return undefined;
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

  // Admin Panel
  {
    id: 'admin-panel',
    text: 'sidebar.adminPanel',
    icon: 'AdminPanelSettings',
    adminOnly: true,
    children: [
      {
        text: 'sidebar.userManagement',
        icon: 'People',
        path: '/admin/users',
        permission: 'users',
      },
      {
        text: 'sidebar.clientVersions',
        icon: 'Widgets',
        path: '/admin/client-versions',
        permission: 'client-versions',
      },
      {
        text: 'sidebar.gameWorlds',
        icon: 'Language',
        path: '/admin/game-worlds',
        permission: 'game-worlds',
      },
      {
        text: 'sidebar.serviceControl',
        icon: 'Build',
        permission: 'maintenance',
        children: [
          {
            text: 'sidebar.maintenance',
            icon: 'Build',
            path: '/admin/maintenance',
            permission: 'maintenance',
          },
          {
            text: 'sidebar.playerConnections',
            icon: 'People',
            path: '/admin/player-connections',
            permission: 'maintenance',
          },
        ],
      },
      {
        text: 'sidebar.maintenanceTemplates',
        icon: 'TextFields',
        path: '/admin/maintenance-templates',
        permission: 'maintenance-templates',
      },
      {
        text: 'sidebar.scheduleManagement',
        icon: 'Schedule',
        permission: 'scheduler',
        children: [
          {
            text: 'sidebar.scheduler',
            icon: 'Schedule',
            path: '/admin/scheduler',
            permission: 'scheduler',
          },
          {
            text: 'sidebar.jobs',
            icon: 'Work',
            path: '/admin/jobs',
            permission: 'scheduler',
          },
          {
            text: 'sidebar.queueMonitor',
            icon: 'Monitor',
            path: '/admin/queue-monitor',
            permission: 'scheduler',
          },
        ],
      },
      {
        text: 'sidebar.auditLogs',
        icon: 'History',
        path: '/admin/audit-logs',
        requiredPermission: PERMISSIONS.AUDIT_LOGS_VIEW,
      },
      {
        text: 'sidebar.realtimeEvents',
        icon: 'Timeline',
        path: '/admin/realtime-events',
        requiredPermission: PERMISSIONS.REALTIME_EVENTS_VIEW,
      },
      {
        text: 'sidebar.crashEvents',
        icon: 'BugReport',
        path: '/admin/crash-events',
        requiredPermission: PERMISSIONS.CRASH_EVENTS_VIEW,
      },
      {
        text: 'sidebar.security',
        icon: 'Security',
        permission: 'security',
        children: [
          {
            text: 'sidebar.apiAccessTokens',
            icon: 'VpnKey',
            path: '/admin/api-tokens',
            permission: 'security',
          },
          {
            text: 'sidebar.whitelist',
            icon: 'Security',
            path: '/admin/whitelist',
            permission: 'security',
          },
        ],
      },
      {
        text: 'sidebar.serverManagement',
        icon: 'Dns',
        permission: 'servers',
        children: [
          {
            text: 'sidebar.serverList',
            icon: 'Storage',
            path: '/admin/server-list',
            permission: 'servers',
          },
          {
            text: 'sidebar.serverLifecycle',
            icon: 'History',
            path: '/admin/server-lifecycle',
            requiredPermission: PERMISSIONS.SERVERS_VIEW,
          },
          {
            text: 'sidebar.gatrixEdges',
            icon: 'Dns',
            path: '/admin/gatrix-edges',
            requiredPermission: PERMISSIONS.SERVERS_VIEW,
          },
        ],
      },
      {
        text: 'sidebar.monitoring',
        icon: 'Monitor',
        requiredPermission: PERMISSIONS.MONITORING_VIEW,
        children: [
          {
            text: 'sidebar.grafana',
            icon: 'Monitor',
            path: '/admin/grafana-dashboard',
            requiredPermission: PERMISSIONS.MONITORING_VIEW,
          },
          {
            text: 'sidebar.logs',
            icon: 'Monitor',
            path: '/monitoring/logs',
            requiredPermission: PERMISSIONS.MONITORING_VIEW,
          },
          {
            text: 'sidebar.alerts',
            icon: 'Notifications',
            path: '/monitoring/alerts',
            requiredPermission: PERMISSIONS.MONITORING_VIEW,
          },
        ],
      },
      {
        text: 'sidebar.openApi',
        icon: 'Api',
        path: '/admin/open-api',
        requiredPermission: PERMISSIONS.OPEN_API_VIEW,
      },
      {
        text: 'sidebar.console',
        icon: 'Terminal',
        path: '/admin/console',
        requiredPermission: PERMISSIONS.CONSOLE_ACCESS,
      },
    ],
  },

  // Game Management
  {
    id: 'game-management',
    text: 'sidebar.gameManagement',
    icon: 'SportsEsports',
    adminOnly: true,
    children: [
      {
        text: 'sidebar.serviceNotices',
        icon: 'Announcement',
        path: '/game/service-notices',
        permission: 'service-notices',
      },
      {
        text: 'sidebar.ingamePopupNotices',
        icon: 'Notifications',
        path: '/game/ingame-popup-notices',
        permission: 'ingame-popup-notices',
      },
      {
        text: 'sidebar.coupons',
        icon: 'ConfirmationNumber',
        permission: 'coupons',
        children: [
          {
            text: 'sidebar.couponSettings',
            icon: 'Settings',
            path: '/game/coupon-settings',
            permission: 'coupons',
          },
          {
            text: 'sidebar.couponUsage',
            icon: 'History',
            path: '/game/coupon-usage',
            permission: 'coupons',
          },
        ],
      },
      {
        text: 'sidebar.surveys',
        icon: 'Poll',
        path: '/game/surveys',
        permission: 'surveys',
      },
      {
        text: 'sidebar.operationEvents',
        icon: 'Event',
        permission: 'operation-events',
        children: [
          {
            text: 'sidebar.hotTimeButtonEvent',
            icon: 'Whatshot',
            path: '/game/hot-time-button-event',
            permission: 'operation-events',
          },
          {
            text: 'sidebar.liveEvent',
            icon: 'Celebration',
            path: '/game/live-event',
            permission: 'operation-events',
          },
        ],
      },
      {
        text: 'sidebar.storeProducts',
        icon: 'Storefront',
        path: '/game/store-products',
        permission: 'store-products',
      },
      {
        text: 'sidebar.rewardTemplates',
        icon: 'CardGiftcard',
        path: '/game/reward-templates',
        permission: 'reward-templates',
      },
      {
        text: 'sidebar.banners',
        icon: 'ViewCarousel',
        path: '/game/banners',
        permission: 'banners',
      },
      {
        text: 'sidebar.planningData',
        icon: 'Storage',
        permission: 'planning-data',
        children: [
          {
            text: 'sidebar.planningDataManagement',
            icon: 'Storage',
            path: '/game/planning-data',
            permission: 'planning-data',
          },
          {
            text: 'sidebar.planningDataHistory',
            icon: 'History',
            path: '/game/planning-data-history',
            permission: 'planning-data',
          },
        ],
      },
    ],
  },

  // Event Lens
  {
    id: 'event-lens',
    text: 'sidebar.eventLens',
    icon: 'Insights',
    adminOnly: true,
    children: [
      {
        text: 'sidebar.projects',
        icon: 'Folder',
        path: '/admin/event-lens/projects',
        permission: 'event-lens',
      },
    ],
  },

  // Feature Flags
  {
    id: 'feature-flags',
    text: 'sidebar.featureFlagsCategory',
    icon: 'Flag',
    adminOnly: true,
    children: [
      {
        text: 'sidebar.featureFlags',
        icon: 'Flag',
        path: '/feature-flags',
        permission: 'feature-flags',
      },
      {
        text: 'sidebar.featureSegments',
        icon: 'People',
        path: '/feature-flags/segments',
        permission: 'feature-flags',
      },
      {
        text: 'sidebar.featureContextFields',
        icon: 'SettingsSuggest',
        path: '/feature-flags/context-fields',
        permission: 'feature-flags',
      },
      {
        text: 'sidebar.featureFlagTypes',
        icon: 'Category',
        path: '/feature-flags/types',
        permission: 'feature-flags',
      },
      {
        text: 'sidebar.featureNetwork',
        icon: 'Hub',
        path: '/feature-flags/network',
        permission: 'feature-flags',
      },
      {
        text: 'sidebar.unknownFlags',
        icon: 'HelpOutline',
        path: '/feature-flags/unknown',
        permission: 'feature-flags',
      },
    ],
  },

  // Change Requests (conditional)
  {
    id: 'change-requests',
    text: 'sidebar.changeRequests',
    icon: 'Campaign',
    path: '/admin/change-requests',
    adminOnly: true,
    condition: (options) => options.requiresApproval !== false,
    children: [
      {
        text: 'sidebar.changeRequests',
        icon: 'Campaign',
        path: '/admin/change-requests',
        permission: 'change-requests',
      },
    ],
  },

  // Settings
  {
    id: 'settings',
    text: 'sidebar.settings',
    icon: 'Settings',
    adminOnly: true,
    children: [
      {
        text: 'settings.systemSettings',
        icon: 'Settings',
        path: '/settings/system',
        permission: 'system-settings',
      },
      {
        text: 'tags.title',
        icon: 'Label',
        path: '/settings/tags',
        permission: 'tags',
      },
      {
        text: 'sidebar.dataManagement',
        icon: 'CloudSync',
        path: '/admin/data-management',
        permission: 'data-management',
      },
      {
        text: 'environments.title',
        icon: 'Layers',
        path: '/settings/environments',
        permission: 'environments',
      },
      {
        text: 'integrations.title',
        icon: 'Extension',
        path: '/settings/integrations',
        permission: 'security',
      },
      {
        text: 'integrations.sdks.title',
        icon: 'Code',
        path: '/settings/integrations/sdks',
        permission: 'security',
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
    adminOnly: !!config.permission || !!config.requiredPermission,
    requiredPermission: permissions,
    children: config.children?.map(convertMenuItem),
    divider: config.divider,
    badge: config.badge,
  };
}

/**
 * Convert MenuCategoryConfig to MenuCategory
 */
function convertCategory(
  config: MenuCategoryConfig,
  badges?: Record<string, string | number>
): MenuCategory {
  return {
    id: config.id,
    text: config.text,
    icon: getIcon(config.icon),
    path: config.path,
    adminOnly: config.adminOnly,
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
    // Check admin requirement
    if (config.adminOnly && !isAdmin) return false;
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

export const menuItemToNavItem = (item: MenuItem, _parentPath?: string): NavItem => {
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
    children: item.children?.map((child) => menuItemToNavItem(child, item.path)),
  };
};

export const getNavigationItems = (isAdmin: boolean): NavItem[] => {
  const items = getAllMenuItems(isAdmin);
  return items.map((item) => menuItemToNavItem(item));
};
