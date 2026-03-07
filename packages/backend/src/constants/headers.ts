/**
 * HTTP Headers 이름 Constants
 * 모든 Headers 이름을 중앙에서 관리하여 하드코딩을 방지합니다.
 */

/**
 * 표준 HTTP Headers
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
   * If-None-Match Headers (ETag용)
   */
  IF_NONE_MATCH: 'if-none-match',
} as const;

/**
 * 커스텀 API Headers
 */
export const API_HEADERS = {
  /**
   * API 토큰 Headers
   */
  X_API_TOKEN: 'x-api-token',

  /**
   * 애플리케이션 이름 Headers
   */
  X_APPLICATION_NAME: 'x-application-name',

  /**
   * Used자 ID Headers (Chat Server용)
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
   * 클라이언트 연결 ID Headers (SDK용)
   */
  X_CONNECTION_ID: 'x-connection-id',

  /**
   * SDK 버전 Headers (SDK 이름/버전)
   */
  X_SDK_VERSION: 'x-sdk-version',

  /**
   * 세션 ID Headers (SDK용)
   */
  X_SESSION_ID: 'x-session-id',

  /**
   * 피처 컨텍스트 Headers (JSON stringified context)
   */
  X_GATRIX_FEATURE_CONTEXT: 'x-gatrix-feature-context',

  /**
   * 컨텍스트 해시 Headers (Context optimization)
   */
  X_GATRIX_CONTEXT_HASH: 'x-gatrix-context-hash',

  /**
   * 클라이언트 버전 Headers
   */
  X_CLIENT_VERSION: 'x-client-version',

  /**
   * 플랫Form Headers
   */
  X_PLATFORM: 'x-platform',
} as const;

/**
 * Cache 관련 Headers
 */
export const CACHE_HEADERS = {
  /**
   * Cache Status Headers (HIT/MISS)
   */
  X_CACHE: 'x-cache',

  /**
   * Cache 키 Headers
   */
  X_CACHE_KEY: 'x-cache-key',
} as const;

/**
 * 보안 Headers
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
 * CORS 관련 Headers
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
 * 모든 Headers를 하나로 합친 객체
 */
export const HEADERS = {
  ...STANDARD_HEADERS,
  ...API_HEADERS,
  ...CACHE_HEADERS,
  ...SECURITY_HEADERS,
  ...CORS_HEADERS,
} as const;

/**
 * Headers 값 Constants
 */
export const HEADER_VALUES = {
  /**
   * Bearer 토큰 접두사
   */
  BEARER_PREFIX: 'Bearer ',

  /**
   * JSON Content-Type
   */
  APPLICATION_JSON: 'application/json',

  /**
   * Cache Status 값
   */
  CACHE_HIT: 'HIT',
  CACHE_MISS: 'MISS',

  /**
   * 보안 Headers Default values
   */
  FRAME_OPTIONS_SAMEORIGIN: 'SAMEORIGIN',
  XSS_PROTECTION_BLOCK: '1; mode=block',
  CONTENT_TYPE_OPTIONS_NOSNIFF: 'nosniff',
  REFERRER_POLICY_NO_REFERRER: 'no-referrer-when-downgrade',
} as const;

/**
 * CORS에서 허용할 Headers 목록
 */
export const ALLOWED_HEADERS: string[] = [
  HEADERS.CONTENT_TYPE,
  HEADERS.AUTHORIZATION,
  HEADERS.X_REQUESTED_WITH,
  HEADERS.X_API_TOKEN,
  HEADERS.X_APPLICATION_NAME,
  HEADERS.X_REQUEST_ID,
  HEADERS.X_SESSION_ID,
  HEADERS.IF_NONE_MATCH,
  HEADERS.X_SDK_VERSION,
  HEADERS.X_GATRIX_FEATURE_CONTEXT,
  HEADERS.X_GATRIX_CONTEXT_HASH,
  HEADERS.X_CLIENT_VERSION,
  HEADERS.X_PLATFORM,
];

export default HEADERS;
