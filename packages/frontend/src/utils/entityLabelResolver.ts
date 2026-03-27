/**
 * Entity Label Resolver (Frontend)
 *
 * Central system for generating human-readable labels from entity data.
 * Mirrors backend entity-label-resolver.ts for consistent label resolution.
 * Used in CR detail views, audit logs, notifications, etc.
 */

import { TFunction } from 'i18next';

export interface EntityLabelConfig {
  // Fields to use as label, in priority order (first non-empty wins)
  labelFields: string[];
  // i18n key for the table display name
  tableNameKey: string;
  // If true, join all found label fields with space instead of using first match
  compositeLabel?: boolean;
}

/**
 * Registry of entity label configurations per table.
 * Keep in sync with backend entity-label-resolver.ts.
 */
const ENTITY_LABEL_REGISTRY: Record<string, EntityLabelConfig> = {
  g_feature_flags: {
    labelFields: ['flagName', 'name'],
    tableNameKey: 'tables.featureFlags',
  },
  g_game_worlds: {
    labelFields: ['name', 'worldId'],
    tableNameKey: 'tables.gameWorlds',
  },
  g_service_notices: {
    labelFields: ['title', 'name'],
    tableNameKey: 'tables.serviceNotices',
  },
  g_ingame_popup_notices: {
    labelFields: ['title', 'name'],
    tableNameKey: 'tables.ingamePopupNotices',
  },
  g_client_versions: {
    labelFields: ['platform', 'clientVersion'],
    tableNameKey: 'tables.clientVersions',
    compositeLabel: true,
  },
  g_store_products: {
    labelFields: ['productName', 'nameKo', 'nameEn', 'name'],
    tableNameKey: 'tables.storeProducts',
  },
  g_coupons: {
    labelFields: ['title', 'code'],
    tableNameKey: 'tables.coupons',
  },
  g_events: {
    labelFields: ['title', 'name'],
    tableNameKey: 'tables.events',
  },
  g_reward_templates: {
    labelFields: ['name', 'title'],
    tableNameKey: 'tables.rewardTemplates',
  },
  g_banners: {
    labelFields: ['title', 'name'],
    tableNameKey: 'tables.banners',
  },
  g_surveys: {
    labelFields: ['title', 'name'],
    tableNameKey: 'tables.surveys',
  },
  g_remote_configs: {
    labelFields: ['configKey', 'name'],
    tableNameKey: 'tables.remoteConfigs',
  },
  g_server_lifecycle_events: {
    labelFields: ['title', 'name'],
    tableNameKey: 'tables.serverLifecycleEvents',
  },
};

/**
 * Resolve a human-readable label for an entity.
 *
 * @param tableName - DB table name (e.g. 'g_feature_flags')
 * @param data - Entity data object (afterData, draftData, etc.)
 * @returns Human-readable label, or null if not resolvable
 */
export function resolveEntityLabel(
  tableName: string,
  data: Record<string, any> | null
): string | null {
  if (!data || typeof data !== 'object') return null;

  const config = ENTITY_LABEL_REGISTRY[tableName];

  if (config) {
    if (config.compositeLabel) {
      const parts: string[] = [];
      for (const field of config.labelFields) {
        const value = data[field];
        if (value && (typeof value === 'string' || typeof value === 'number')) {
          parts.push(String(value));
        }
      }
      if (parts.length > 0) return parts.join(' ');
    } else {
      for (const field of config.labelFields) {
        const value = data[field];
        if (value && (typeof value === 'string' || typeof value === 'number')) {
          return String(value);
        }
      }
    }
  }

  // Fallback: check draftData metadata keys
  if (data._flagName) return String(data._flagName);

  // Generic fallback
  const fallbackFields = ['title', 'name', 'displayName', 'code'];
  for (const field of fallbackFields) {
    const value = data[field];
    if (value && (typeof value === 'string' || typeof value === 'number')) {
      return String(value);
    }
  }

  return null;
}

/**
 * Get localized table display name.
 *
 * @param tableName - DB table name
 * @param t - i18n translate function
 * @returns Localized display name
 */
export function resolveTableDisplayName(
  tableName: string,
  t: TFunction
): string {
  const config = ENTITY_LABEL_REGISTRY[tableName];
  const key = config?.tableNameKey || `tables.${tableName.replace(/^g_/, '')}`;
  return t(key, { defaultValue: tableName.replace(/^g_/, '') });
}

/**
 * Format a change item display string: "테이블명: 엔티티 레이블"
 * Falls back to targetId if no label can be resolved.
 *
 * @param tableName - DB table name
 * @param targetId - Target entity ID (fallback)
 * @param data - Entity data for label resolution (afterData)
 * @param displayName - Pre-resolved display name from backend (highest priority)
 * @param t - i18n translate function
 * @param beforeData - Optional beforeData as fallback for label resolution
 */
export function formatChangeItemLabel(
  tableName: string,
  targetId: string,
  data: Record<string, any> | null,
  displayName: string | null | undefined,
  t: TFunction,
  beforeData?: Record<string, any> | null
): string {
  const tableLabel = resolveTableDisplayName(tableName, t);
  const entityLabel =
    displayName || resolveEntityLabel(tableName, data) || resolveEntityLabel(tableName, beforeData || null) || targetId;
  return `${tableLabel}: ${entityLabel}`;
}
