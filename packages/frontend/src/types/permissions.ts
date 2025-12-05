/**
 * RBAC Permission Definitions for Frontend
 * These should match the backend permission definitions
 */

// All available permissions in the system
export const PERMISSIONS = {
  // User Management
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',

  // Client Versions
  CLIENT_VERSIONS_VIEW: 'client-versions.view',
  CLIENT_VERSIONS_MANAGE: 'client-versions.manage',

  // Game Worlds
  GAME_WORLDS_VIEW: 'game-worlds.view',
  GAME_WORLDS_MANAGE: 'game-worlds.manage',

  // Maintenance
  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_MANAGE: 'maintenance.manage',

  // Maintenance Templates
  MAINTENANCE_TEMPLATES_VIEW: 'maintenance-templates.view',
  MAINTENANCE_TEMPLATES_MANAGE: 'maintenance-templates.manage',

  // Scheduler
  SCHEDULER_VIEW: 'scheduler.view',
  SCHEDULER_MANAGE: 'scheduler.manage',

  // Audit Logs
  AUDIT_LOGS_VIEW: 'audit-logs.view',

  // Realtime Events
  REALTIME_EVENTS_VIEW: 'realtime-events.view',

  // Crash Events
  CRASH_EVENTS_VIEW: 'crash-events.view',

  // Remote Config
  REMOTE_CONFIG_VIEW: 'remote-config.view',
  REMOTE_CONFIG_MANAGE: 'remote-config.manage',

  // Security
  SECURITY_VIEW: 'security.view',
  SECURITY_MANAGE: 'security.manage',

  // Server Management
  SERVERS_VIEW: 'servers.view',
  SERVERS_MANAGE: 'servers.manage',

  // Monitoring
  MONITORING_VIEW: 'monitoring.view',

  // Open API
  OPEN_API_VIEW: 'open-api.view',

  // Console
  CONSOLE_ACCESS: 'console.access',

  // Game Management - Service Notices
  SERVICE_NOTICES_VIEW: 'service-notices.view',
  SERVICE_NOTICES_MANAGE: 'service-notices.manage',

  // Game Management - Ingame Popup Notices
  INGAME_POPUP_NOTICES_VIEW: 'ingame-popup-notices.view',
  INGAME_POPUP_NOTICES_MANAGE: 'ingame-popup-notices.manage',

  // Game Management - Coupons
  COUPONS_VIEW: 'coupons.view',
  COUPONS_MANAGE: 'coupons.manage',

  // Game Management - Surveys
  SURVEYS_VIEW: 'surveys.view',
  SURVEYS_MANAGE: 'surveys.manage',

  // Game Management - Operation Events
  OPERATION_EVENTS_VIEW: 'operation-events.view',
  OPERATION_EVENTS_MANAGE: 'operation-events.manage',

  // Game Management - Reward Templates
  REWARD_TEMPLATES_VIEW: 'reward-templates.view',
  REWARD_TEMPLATES_MANAGE: 'reward-templates.manage',

  // Game Management - Banners
  BANNERS_VIEW: 'banners.view',
  BANNERS_MANAGE: 'banners.manage',

  // Game Management - Planning Data
  PLANNING_DATA_VIEW: 'planning-data.view',
  PLANNING_DATA_MANAGE: 'planning-data.manage',

  // Event Lens
  EVENT_LENS_VIEW: 'event-lens.view',
  EVENT_LENS_MANAGE: 'event-lens.manage',

  // Settings - Tags
  TAGS_VIEW: 'tags.view',
  TAGS_MANAGE: 'tags.manage',

  // Settings - Data Management
  DATA_MANAGEMENT_VIEW: 'data-management.view',
  DATA_MANAGEMENT_MANAGE: 'data-management.manage',

  // Settings - Environments
  ENVIRONMENTS_VIEW: 'environments.view',
  ENVIRONMENTS_MANAGE: 'environments.manage',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// All permissions as an array
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// Permission category interface
export interface PermissionCategory {
  label: string;
  permissions: Permission[];
}

// Permission categories for UI grouping
export const PERMISSION_CATEGORIES: Record<string, PermissionCategory> = {
  ADMIN_PANEL: {
    label: 'permissions.categories.adminPanel',
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.CLIENT_VERSIONS_VIEW,
      PERMISSIONS.CLIENT_VERSIONS_MANAGE,
      PERMISSIONS.GAME_WORLDS_VIEW,
      PERMISSIONS.GAME_WORLDS_MANAGE,
      PERMISSIONS.MAINTENANCE_VIEW,
      PERMISSIONS.MAINTENANCE_MANAGE,
      PERMISSIONS.MAINTENANCE_TEMPLATES_VIEW,
      PERMISSIONS.MAINTENANCE_TEMPLATES_MANAGE,
      PERMISSIONS.SCHEDULER_VIEW,
      PERMISSIONS.SCHEDULER_MANAGE,
      PERMISSIONS.AUDIT_LOGS_VIEW,
      PERMISSIONS.REALTIME_EVENTS_VIEW,
      PERMISSIONS.CRASH_EVENTS_VIEW,
      PERMISSIONS.REMOTE_CONFIG_VIEW,
      PERMISSIONS.REMOTE_CONFIG_MANAGE,
      PERMISSIONS.SECURITY_VIEW,
      PERMISSIONS.SECURITY_MANAGE,
      PERMISSIONS.SERVERS_VIEW,
      PERMISSIONS.SERVERS_MANAGE,
      PERMISSIONS.MONITORING_VIEW,
      PERMISSIONS.OPEN_API_VIEW,
      PERMISSIONS.CONSOLE_ACCESS,
    ],
  },
  GAME_MANAGEMENT: {
    label: 'permissions.categories.gameManagement',
    permissions: [
      PERMISSIONS.SERVICE_NOTICES_VIEW,
      PERMISSIONS.SERVICE_NOTICES_MANAGE,
      PERMISSIONS.INGAME_POPUP_NOTICES_VIEW,
      PERMISSIONS.INGAME_POPUP_NOTICES_MANAGE,
      PERMISSIONS.COUPONS_VIEW,
      PERMISSIONS.COUPONS_MANAGE,
      PERMISSIONS.SURVEYS_VIEW,
      PERMISSIONS.SURVEYS_MANAGE,
      PERMISSIONS.OPERATION_EVENTS_VIEW,
      PERMISSIONS.OPERATION_EVENTS_MANAGE,
      PERMISSIONS.REWARD_TEMPLATES_VIEW,
      PERMISSIONS.REWARD_TEMPLATES_MANAGE,
      PERMISSIONS.BANNERS_VIEW,
      PERMISSIONS.BANNERS_MANAGE,
      PERMISSIONS.PLANNING_DATA_VIEW,
      PERMISSIONS.PLANNING_DATA_MANAGE,
    ],
  },
  EVENT_LENS: {
    label: 'permissions.categories.eventLens',
    permissions: [
      PERMISSIONS.EVENT_LENS_VIEW,
      PERMISSIONS.EVENT_LENS_MANAGE,
    ],
  },
  SETTINGS: {
    label: 'permissions.categories.settings',
    permissions: [
      PERMISSIONS.TAGS_VIEW,
      PERMISSIONS.TAGS_MANAGE,
      PERMISSIONS.DATA_MANAGEMENT_VIEW,
      PERMISSIONS.DATA_MANAGEMENT_MANAGE,
      PERMISSIONS.ENVIRONMENTS_VIEW,
      PERMISSIONS.ENVIRONMENTS_MANAGE,
    ],
  },
};

// Helper to get permission label key for i18n
export const getPermissionLabelKey = (permission: Permission): string => {
  return `permissions.${permission.replace('.', '_')}`;
};

