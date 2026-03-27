/**
 * Entity Label Resolver
 *
 * Central system for generating human-readable labels from entity data.
 * Registry-based design — add new entity types by registering config.
 * Reusable across CR, audit logs, notifications, etc.
 */

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
 * When adding a new entity type, register it here.
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
    compositeLabel: true, // Join all found label fields with space
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
 * Searches through registered labelFields in priority order.
 *
 * @param tableName - DB table name (e.g. 'g_feature_flags')
 * @param data - Entity data object (afterData, beforeData, or draftData)
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
      // Join all found label fields with space
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

  // Fallback: check draftData metadata keys (e.g. _flagName for feature flags)
  if (data._flagName) return String(data._flagName);

  // Generic fallback: try common name fields
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
 * Get the i18n key for a table's display name.
 *
 * @param tableName - DB table name (e.g. 'g_feature_flags')
 * @returns i18n key (e.g. 'tables.featureFlags')
 */
export function getTableNameKey(tableName: string): string {
  const config = ENTITY_LABEL_REGISTRY[tableName];
  if (config) return config.tableNameKey;

  // Fallback: derive from table name
  const cleanName = tableName.startsWith('g_') ? tableName.slice(2) : tableName;
  return `tables.${cleanName}`;
}

/**
 * Get the registry config for a table (for external use if needed).
 */
export function getEntityLabelConfig(
  tableName: string
): EntityLabelConfig | undefined {
  return ENTITY_LABEL_REGISTRY[tableName];
}
