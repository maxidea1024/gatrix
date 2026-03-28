/**
 * HTTP Header Name Constants
 * Centrally manage all header names to prevent hardcoding.
 */

/**
 * Standard HTTP Headers
 */
export const STANDARD_HEADERS = {
  /**
   * Authorization Headers
   */
  AUTHORIZATION: 'authorization',

  /**
   * Content-Type Headers
   */
  CONTENT_TYPE: 'content-type',

  /**
   * User-Agent Headers
   */
  USER_AGENT: 'user-agent',

  /**
   * Accept Headers
   */
  ACCEPT: 'accept',

  /**
   * Cache-Control Headers
   */
  CACHE_CONTROL: 'cache-control',

  /**
   * X-Requested-With Headers
   */
  X_REQUESTED_WITH: 'x-requested-with',

  /**
   * If-None-Match Header (for ETag)
   */
  IF_NONE_MATCH: 'if-none-match',
} as const;

/**
 * Custom API Headers
 */
export const API_HEADERS = {
  /**
   * API Token Header
   */
  X_API_TOKEN: 'x-api-token',

  /**
   * Application Name Header
   */
  X_APPLICATION_NAME: 'x-application-name',

  /**
   * User ID Header (for Chat Server)
   */
  X_USER_ID: 'x-user-id',

  /**
   * Chat Server ID Headers
   */
  X_CHAT_SERVER_ID: 'x-chat-server-id',

  /**
   * Request ID Headers
   */
  X_REQUEST_ID: 'x-request-id',

  /**
   * Client Connection ID Header (for SDK)
   */
  X_CONNECTION_ID: 'x-connection-id',

  /**
   * SDK Version Header (SDK name/version)
   */
  X_SDK_VERSION: 'x-sdk-version',

  /**
   * Session ID Header (for SDK)
   */
  X_SESSION_ID: 'x-session-id',

  /**
   * Feature Context Header (JSON stringified context)
   */
  X_GATRIX_FEATURE_CONTEXT: 'x-gatrix-feature-context',

  /**
   * Context Hash Header (Context optimization)
   */
  X_GATRIX_CONTEXT_HASH: 'x-gatrix-context-hash',

  /**
   * Client Version Header
   */
  X_CLIENT_VERSION: 'x-client-version',

  /**
   * Platform Header
   */
  X_PLATFORM: 'x-platform',
} as const;

/**
 * Cache-related Headers
 */
export const CACHE_HEADERS = {
  /**
   * Cache Status Headers (HIT/MISS)
   */
  X_CACHE: 'x-cache',

  /**
   * Cache Key Header
   */
  X_CACHE_KEY: 'x-cache-key',
} as const;

/**
 * Security Headers
 */
export const SECURITY_HEADERS = {
  /**
   * X-Frame-Options Headers
   */
  X_FRAME_OPTIONS: 'x-frame-options',

  /**
   * X-XSS-Protection Headers
   */
  X_XSS_PROTECTION: 'x-xss-protection',

  /**
   * X-Content-Type-Options Headers
   */
  X_CONTENT_TYPE_OPTIONS: 'x-content-type-options',

  /**
   * Referrer-Policy Headers
   */
  REFERRER_POLICY: 'referrer-policy',

  /**
   * Content-Security-Policy Headers
   */
  CONTENT_SECURITY_POLICY: 'content-security-policy',
} as const;

/**
 * CORS-related Headers
 */
export const CORS_HEADERS = {
  /**
   * Access-Control-Allow-Origin Headers
   */
  ACCESS_CONTROL_ALLOW_ORIGIN: 'access-control-allow-origin',

  /**
   * Access-Control-Allow-Methods Headers
   */
  ACCESS_CONTROL_ALLOW_METHODS: 'access-control-allow-methods',

  /**
   * Access-Control-Allow-Headers Headers
   */
  ACCESS_CONTROL_ALLOW_HEADERS: 'access-control-allow-headers',

  /**
   * Access-Control-Allow-Credentials Headers
   */
  ACCESS_CONTROL_ALLOW_CREDENTIALS: 'access-control-allow-credentials',
} as const;

/**
 * Combined object of all headers
 */
export const HEADERS = {
  ...STANDARD_HEADERS,
  ...API_HEADERS,
  ...CACHE_HEADERS,
  ...SECURITY_HEADERS,
  ...CORS_HEADERS,
} as const;

/**
 * Header Value Constants
 */
export const HEADER_VALUES = {
  /**
   * Bearer token prefix
   */
  BEARER_PREFIX: 'Bearer ',

  /**
   * JSON Content-Type
   */
  APPLICATION_JSON: 'application/json',

  /**
   * Cache Status values
   */
  CACHE_HIT: 'HIT',
  CACHE_MISS: 'MISS',

  /**
   * Security Headers Default values
   */
  FRAME_OPTIONS_SAMEORIGIN: 'SAMEORIGIN',
  XSS_PROTECTION_BLOCK: '1; mode=block',
  CONTENT_TYPE_OPTIONS_NOSNIFF: 'nosniff',
  REFERRER_POLICY_NO_REFERRER: 'no-referrer-when-downgrade',
} as const;

/**
 * List of headers allowed in CORS
 */
export const ALLOWED_HEADERS: string[] = [
  HEADERS.CONTENT_TYPE,
  HEADERS.AUTHORIZATION,
  HEADERS.X_REQUESTED_WITH,
  HEADERS.X_API_TOKEN,
  HEADERS.X_APPLICATION_NAME,
  HEADERS.X_REQUEST_ID,
  HEADERS.X_CONNECTION_ID,
  HEADERS.X_SESSION_ID,
  HEADERS.IF_NONE_MATCH,
  HEADERS.X_SDK_VERSION,
  HEADERS.X_GATRIX_FEATURE_CONTEXT,
  HEADERS.X_GATRIX_CONTEXT_HASH,
  HEADERS.X_CLIENT_VERSION,
  HEADERS.X_PLATFORM,
];

export default HEADERS;
