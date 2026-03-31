/**
 * Cache Keys Constants
 *
 * Centralized cache key management
 * All cache keys are managed in this file to improve consistency and maintainability.
 */

/**
 * Environment-scoped cache key prefix
 * Used for data that varies by environment (game worlds, whitelists, etc.)
 * Format: env:{ environmentId }:{originalKey}
 */
export const ENV_PREFIX = 'env';

/**
 * Create an environment-scoped cache key
 * @param environment - The environment name (e.g., 'development', 'production')
 * @param key - The original cache key
 * @returns Environment-prefixed cache key
 */
export function withEnvironment(environmentId: string, key: string): string {
  return `${ENV_PREFIX}:${environmentId}:${key}`;
}

/**
 * Create a pattern for matching all environment-scoped keys with a given base pattern
 * @param pattern - The base pattern (e.g., 'game_world*')
 * @returns Pattern that matches all environments
 */
export function allEnvironmentsPattern(pattern: string): string {
  return `${ENV_PREFIX}:*:${pattern}`;
}

/**
 * Create a pattern for matching all keys in a specific environment
 * @param environmentId - The environment ULID
 * @returns Pattern that matches all keys in the environment
 */
export function environmentPattern(environmentId: string): string {
  return `${ENV_PREFIX}:${environmentId}:*`;
}

/**
 * Game world related cache keys
 */
export const GAME_WORLDS = {
  /**
   * Public game world list (for client API)
   * - Visible worlds not under maintenance
   * - TTL: 10 minutes
   */
  PUBLIC: 'game_worlds:public',

  /**
   * Admin game world list
   * - All worlds (including hidden/maintenance)
   * - TTL: 5 minutes
   */
  ADMIN: 'game_worlds:admin',

  /**
   * Specific game world details
   * @param id Game world ID
   */
  DETAIL: (id: string) => `game_world:${id}`,

  /**
   * Look up game world by world ID
   * @param worldId World ID
   */
  BY_WORLD_ID: (worldId: string) => `game_world:world_id:${worldId}`,
} as const;

/**
 * Client version related cache keys
 */
export const CLIENT_VERSION = {
  /**
   * Client version info by channel
   * @param channel Channel name
   * @param subChannel Sub-channel name
   */
  BY_CHANNEL: (channel: string, subChannel: string) =>
    `client_version:${channel}:${subChannel}`,

  /**
   * All client versions list
   */
  ALL: 'client_versions:all',

  /**
   * Active client versions only
   */
  ACTIVE: 'client_versions:active',
} as const;

/**
 * User related cache keys
 */
export const USER = {
  /**
   * User profile info
   * @param userId User ID
   */
  PROFILE: (userId: string) => `user:${userId}:profile`,

  /**
   * User permission info
   * @param userId User ID
   */
  PERMISSIONS: (userId: string) => `user:${userId}:permissions`,

  /**
   * User session info
   * @param sessionId Session ID
   */
  SESSION: (sessionId: string) => `user:session:${sessionId}`,
} as const;

/**
 * Tag related cache keys
 */
export const TAG = {
  /**
   * All tags list
   */
  ALL: 'tags:all',

  /**
   * Tags list by entity
   * @param entityType Entity type (game_world, user, etc.)
   * @param entityId Entity ID
   */
  BY_ENTITY: (entityType: string, entityId: string) =>
    `tags:${entityType}:${entityId}`,
} as const;

/**
 * Whitelist related cache keys
 */
export const WHITELIST = {
  /**
   * All whitelist entries
   */
  ALL: 'whitelist:all',

  /**
   * Active whitelist entries only
   */
  ACTIVE: 'whitelist:active',

  /**
   * Whitelist status for specific IP
   * @param ip IP address
   */
  BY_IP: (ip: string) => `whitelist:ip:${ip}`,
} as const;

/**
 * Maintenance related cache keys
 */
export const MAINTENANCE = {
  /**
   * Current maintenance status
   */
  STATUS: 'maintenance:status',

  /**
   * Maintenance template list
   */
  TEMPLATES: 'maintenance:templates',
} as const;

/**
 * Message template related cache keys
 */
export const MESSAGE_TEMPLATE = {
  /**
   * All message templates
   */
  ALL: 'message_templates:all',

  /**
   * Message templates by type
   * @param type Template type
   */
  BY_TYPE: (type: string) => `message_templates:type:${type}`,
} as const;

/**
 * Translation related cache keys
 */
export const TRANSLATION = {
  /**
   * Translation results by source text hash + target language
   * @param hash Source text sha256 hash
   * @param lang Target language code
   */
  BY_TEXT_LANG: (hash: string, lang: 'ko' | 'en' | 'zh') =>
    `translate:${hash}:${lang}`,

  /**
   * Language detection results (based on source text hash)
   * @param hash Source text sha256 hash
   */
  DETECT: (hash: string) => `translate:detect:${hash}`,
} as const;

/**
 * Job related cache keys
 */
export const JOB = {
  /**
   * All jobs list
   */
  ALL: 'jobs:all',

  /**
   * Job types list
   */
  TYPES: 'job_types:all',

  /**
   * Specific job details
   * @param jobId Job ID
   */
  DETAIL: (jobId: string) => `job:${jobId}`,
} as const;

/**
 * Audit log related cache keys
 */
export const AUDIT_LOG = {
  /**
   * Recent audit logs (paginated)
   * @param page Page number
   * @param limit Page size
   */
  RECENT: (page: number, limit: number) => `audit_logs:recent:${page}:${limit}`,

  /**
   * Audit logs by user
   * @param userId User ID
   * @param page Page number
   */
  BY_USER: (userId: string, page: number) =>
    `audit_logs:user:${userId}:${page}`,
} as const;
/**
 * Server SDK endpoint ETag cache keys
 */
export const SERVER_SDK_ETAG = {
  /**
   * Game worlds list for server SDK
   */
  GAME_WORLDS: 'server_sdk:etag:game_worlds',

  /**
   * In-game popup notices for server SDK
   */
  POPUP_NOTICES: 'server_sdk:etag:popup_notices',

  /**
   * Whitelists for server SDK
   */
  WHITELISTS: 'server_sdk:etag:whitelists',

  /**
   * Maintenance status for server SDK
   */
  MAINTENANCE: 'server_sdk:etag:maintenance',

  /**
   * Surveys list for server SDK
   */
  SURVEYS: 'server_sdk:etag:surveys',

  /**
   * Survey settings for server SDK
   */
  SURVEY_SETTINGS: 'server_sdk:etag:survey_settings',

  /**
   * Client versions for server SDK (Edge)
   */
  CLIENT_VERSIONS: 'server_sdk:etag:client_versions',

  /**
   * Service notices for server SDK (Edge)
   */
  SERVICE_NOTICES: 'server_sdk:etag:service_notices',

  /**
   * Banners for server SDK (Edge)
   */
  BANNERS: 'server_sdk:etag:banners',

  /**
   * Store products for server SDK
   */
  STORE_PRODUCTS: 'server_sdk:etag:store_products',

  /**
   * Feature flags for server SDK
   */
  FEATURE_FLAGS: 'server_sdk:etag:feature_flags',

  /**
   * Vars (KV) for server SDK
   */
  VARS: 'server_sdk:etag:vars',
} as const;

/**
 * Environment-scoped cache keys
 * These keys are automatically prefixed with the environment ID
 * Use with withEnvironment() function
 */
export const ENV_SCOPED = {
  /**
   * Game worlds related (environment-specific)
   */
  GAME_WORLDS: {
    PUBLIC: 'game_worlds:public',
    ADMIN: 'game_worlds:admin',
    DETAIL: (id: string) => `game_world:${id}`,
    BY_WORLD_ID: (worldId: string) => `game_world:world_id:${worldId}`,
  },

  /**
   * Client versions (project-scoped, but cached here for legacy compatibility)
   */
  CLIENT_VERSION: {
    BY_CHANNEL: (channel: string, subChannel: string) =>
      `client_version:${channel}:${subChannel}`,
    ALL: 'client_versions:all',
    ACTIVE: 'client_versions:active',
  },

  /**
   * Whitelists (environment-specific)
   */
  WHITELIST: {
    ALL: 'whitelist:all',
    ACTIVE: 'whitelist:active',
    BY_IP: (ip: string) => `whitelist:ip:${ip}`,
  },

  /**
   * Maintenance (environment-specific)
   */
  MAINTENANCE: {
    STATUS: 'maintenance:status',
    TEMPLATES: 'maintenance:templates',
  },

  /**
   * Server SDK ETags (environment-specific)
   */
  SDK_ETAG: {
    GAME_WORLDS: 'server_sdk:etag:game_worlds',
    POPUP_NOTICES: 'server_sdk:etag:popup_notices',
    WHITELISTS: 'server_sdk:etag:whitelists',
    MAINTENANCE: 'server_sdk:etag:maintenance',
    SURVEYS: 'server_sdk:etag:surveys',
    SURVEY_SETTINGS: 'server_sdk:etag:survey_settings',
    FEATURE_FLAGS: 'server_sdk:etag:feature_flags',
  },

  /**
   * Banners (environment-specific)
   */
  BANNERS: {
    ALL: 'banners:all',
    ACTIVE: 'banners:active',
    BY_ID: (id: string) => `banner:${id}`,
  },

  /**
   * Service notices (environment-specific)
   */
  SERVICE_NOTICES: {
    ALL: 'service_notices:all',
    ACTIVE: 'service_notices:active',
  },

  /**
   * Surveys (environment-specific)
   */
  SURVEYS: {
    ALL: 'surveys:all',
    ACTIVE: 'surveys:active',
    SETTINGS: 'surveys:settings',
  },

  /**
   * Ingame popup notices (environment-specific)
   */
  POPUP_NOTICES: {
    ALL: 'popup_notices:all',
    ACTIVE: 'popup_notices:active',
  },

  /**
   * Feature flags (environment-specific)
   */
  FEATURE_FLAGS: {
    ALL: 'feature_flags:all',
    BY_NAME: (flagName: string) => `feature_flag:${flagName}`,
    SEGMENTS: 'feature_segments:all',
    CONTEXT_FIELDS: 'feature_context_fields:all',
  },
} as const;

/**
 * Cache patterns (for pattern-based deletion)
 */
export const PATTERNS = {
  /**
   * All game world related cache
   */
  GAME_WORLDS: 'game_world*',

  /**
   * All client version related cache
   */
  CLIENT_VERSIONS: 'client_version*',

  /**
   * All cache for specific user
   * @param userId User ID
   */
  USER: (userId: string) => `user:${userId}*`,

  /**
   * All tag related cache
   */
  TAGS: 'tags*',

  /**
   * All whitelist related cache
   */
  WHITELIST: 'whitelist*',

  /**
   * All maintenance related cache
   */
  MAINTENANCE: 'maintenance*',

  /**
   * All message template related cache
   */
  MESSAGE_TEMPLATES: 'message_template*',

  /**
   * All job related cache
   */
  JOBS: 'job*',

  /**
   * All audit log related cache
   */
  AUDIT_LOGS: 'audit_log*',

  /**
   * All translation related cache
   */
  TRANSLATION: 'translate*',

  /**
   * All cache for specific environment
   * @param environmentId Environment ULID
   */
  ENVIRONMENT: (environmentId: string) => `${ENV_PREFIX}:${environmentId}:*`,

  /**
   * Specific pattern cache for all environments
   * @param pattern Cache pattern
   */
  ALL_ENVIRONMENTS: (pattern: string) => `${ENV_PREFIX}:*:${pattern}`,
} as const;

/**
 * Cache TTL Constants (milliseconds)
 */
export const TTL = {
  /**
   * 1 minute
   */
  ONE_MINUTE: 60 * 1000,

  /**
   * 5 minutes
   */
  FIVE_MINUTES: 5 * 60 * 1000,

  /**
   * 10 minutes
   */
  TEN_MINUTES: 10 * 60 * 1000,

  /**
   * 30 minutes
   */
  THIRTY_MINUTES: 30 * 60 * 1000,

  /**
   * 1 hour
   */
  ONE_HOUR: 60 * 60 * 1000,

  /**
   * 1 day
   */
  ONE_DAY: 24 * 60 * 60 * 1000,
} as const;

/**
 * Default cache settings
 */
export const DEFAULT_CONFIG = {
  /**
   * Game world public list TTL
   */
  GAME_WORLDS_PUBLIC_TTL: TTL.TEN_MINUTES,

  /**
   * Client version TTL
   */
  CLIENT_VERSION_TTL: TTL.FIVE_MINUTES,

  /**
   * User profile TTL
   */
  USER_PROFILE_TTL: TTL.THIRTY_MINUTES,

  /**
   * Tag list TTL
   */
  TAGS_TTL: TTL.ONE_HOUR,

  /**
   * Whitelist TTL
   */
  WHITELIST_TTL: TTL.FIVE_MINUTES,

  /**
   * Maintenance status TTL
   */
  MAINTENANCE_TTL: TTL.ONE_MINUTE,

  /**
   * In-game popup notice TTL (for Server SDK)
   */
  POPUP_NOTICE_TTL: TTL.ONE_MINUTE,

  /**
   * Survey list TTL (for Server SDK)
   */
  SURVEYS_TTL: TTL.ONE_MINUTE,

  /**
   * Survey settings TTL (for Server SDK)
   */
  SURVEY_SETTINGS_TTL: TTL.ONE_MINUTE,

  /**
   * Translation result/language detection TTL
   */
  TRANSLATION_TTL: TTL.ONE_DAY,

  /**
   * Service notice TTL (for Server SDK - Edge)
   */
  SERVICE_NOTICE_TTL: TTL.ONE_MINUTE,

  /**
   * Banner TTL (for Server SDK - Edge)
   */
  BANNER_TTL: TTL.FIVE_MINUTES,

  /**
   * Store product TTL (for Server SDK)
   */
  STORE_PRODUCT_TTL: TTL.FIVE_MINUTES,

  /**
   * Vars (KV) TTL for server SDK
   */
  VARS_TTL: TTL.FIVE_MINUTES,
} as const;
