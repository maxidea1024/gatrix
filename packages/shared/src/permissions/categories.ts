/**
 * Permission Categories for UI grouping
 *
 * Used by permission editor components to group permissions
 * into logical categories for display.
 *
 * Labels use i18n keys — actual text is in localization files.
 */

import { RESOURCES, RESOURCE_SCOPES, SCOPES, type Resource } from './constants';

export interface PermissionCategory {
  /** i18n key for category label */
  labelKey: string;
  /** Scope this category belongs to */
  scope: string;
  /** Resources in this category */
  resources: Resource[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  // System
  {
    labelKey: 'permissions.category.system',
    scope: SCOPES.SYSTEM,
    resources: [RESOURCES.ORGANISATIONS, RESOURCES.SYSTEM_CONFIG, RESOURCES.SYSTEM_MONITORING],
  },

  // Org - Workspace
  {
    labelKey: 'permissions.category.workspace',
    scope: SCOPES.ORG,
    resources: [
      RESOURCES.USERS,
      RESOURCES.GROUPS,
      RESOURCES.ROLES,
      RESOURCES.INVITATIONS,
      RESOURCES.PROJECTS,
    ],
  },

  // Org - Security
  {
    labelKey: 'permissions.category.security',
    scope: SCOPES.ORG,
    resources: [
      RESOURCES.ADMIN_TOKENS,
      RESOURCES.IP_WHITELIST,
      RESOURCES.ACCOUNT_WHITELIST,
      RESOURCES.INTEGRATIONS,
    ],
  },

  // Org - Monitoring & Tools
  {
    labelKey: 'permissions.category.monitoringTools',
    scope: SCOPES.ORG,
    resources: [
      RESOURCES.AUDIT_LOGS,
      RESOURCES.MONITORING,
      RESOURCES.REALTIME_EVENTS,
      RESOURCES.OPEN_API,
      RESOURCES.CONSOLE,
      RESOURCES.CHAT,
    ],
  },

  // Org - Operations
  {
    labelKey: 'permissions.category.operations',
    scope: SCOPES.ORG,
    resources: [
      RESOURCES.SCHEDULER,
      RESOURCES.EVENT_LENS,
      RESOURCES.SYSTEM_SETTINGS,
      RESOURCES.TRANSLATION,
    ],
  },

  // Project - Feature Management
  {
    labelKey: 'permissions.category.featureManagement',
    scope: SCOPES.PROJECT,
    resources: [
      RESOURCES.FEATURES,
      RESOURCES.SEGMENTS,
      RESOURCES.CONTEXT_FIELDS,
      RESOURCES.RELEASE_FLOWS,
      RESOURCES.UNKNOWN_FLAGS,
      RESOURCES.CRASH_EVENTS,
    ],
  },

  // Project - Data & Integration
  {
    labelKey: 'permissions.category.dataIntegration',
    scope: SCOPES.PROJECT,
    resources: [
      RESOURCES.TAGS,
      RESOURCES.IMPACT_METRICS,
      RESOURCES.SERVICE_ACCOUNTS,
      RESOURCES.SIGNAL_ENDPOINTS,
      RESOURCES.ACTIONS,
      RESOURCES.DATA,
    ],
  },

  // Env - Environment Settings
  {
    labelKey: 'permissions.category.environmentSettings',
    scope: SCOPES.ENV,
    resources: [
      RESOURCES.ENVIRONMENTS,
      RESOURCES.ENV_FEATURES,
      RESOURCES.ENV_KEYS,
      RESOURCES.CHANGE_REQUESTS,
    ],
  },

  // Env - Game Management
  {
    labelKey: 'permissions.category.gameManagement',
    scope: SCOPES.ENV,
    resources: [
      RESOURCES.CLIENT_VERSIONS,
      RESOURCES.GAME_WORLDS,
      RESOURCES.MAINTENANCE,
      RESOURCES.MAINTENANCE_TEMPLATES,
      RESOURCES.SERVICE_NOTICES,
      RESOURCES.BANNERS,
      RESOURCES.SERVERS,
      RESOURCES.MESSAGE_TEMPLATES,
      RESOURCES.VARS,
      RESOURCES.PLANNING_DATA,
    ],
  },

  // Env - Commerce & Events
  {
    labelKey: 'permissions.category.commerceEvents',
    scope: SCOPES.ENV,
    resources: [
      RESOURCES.COUPONS,
      RESOURCES.COUPON_SETTINGS,
      RESOURCES.SURVEYS,
      RESOURCES.STORE_PRODUCTS,
      RESOURCES.REWARD_TEMPLATES,
      RESOURCES.INGAME_POPUPS,
      RESOURCES.OPERATION_EVENTS,
    ],
  },
];

/**
 * Get categories filtered by scope
 */
export function getCategoriesByScope(scope: string): PermissionCategory[] {
  return PERMISSION_CATEGORIES.filter((c) => c.scope === scope);
}

/**
 * Get all resources for a given scope
 */
export function getResourcesByScope(scope: string): Resource[] {
  return (Object.entries(RESOURCE_SCOPES) as [Resource, string][])
    .filter(([, s]) => s === scope)
    .map(([r]) => r);
}
