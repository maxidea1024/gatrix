/**
 * HTTP 헤더 이름 상수
 * 모든 헤더 이름을 중앙에서 관리하여 하드코딩을 방지합니다.
 */

/**
 * 표준 HTTP 헤더
 */
export const STANDARD_HEADERS = {
  /**
   * Authorization 헤더
   */
  AUTHORIZATION: 'authorization',

  /**
   * Content-Type 헤더
   */
  CONTENT_TYPE: 'content-type',

  /**
   * User-Agent 헤더
   */
  USER_AGENT: 'user-agent',

  /**
   * Accept 헤더
   */
  ACCEPT: 'accept',

  /**
   * Cache-Control 헤더
   */
  CACHE_CONTROL: 'cache-control',

  /**
   * X-Requested-With 헤더
   */
  X_REQUESTED_WITH: 'x-requested-with',

  /**
   * If-None-Match 헤더 (ETag용)
   */
  IF_NONE_MATCH: 'if-none-match',
} as const;

/**
 * 커스텀 API 헤더
 */
export const API_HEADERS = {
  /**
   * API 토큰 헤더
   */
  X_API_TOKEN: 'x-api-token',

  /**
   * 애플리케이션 이름 헤더
   */
  X_APPLICATION_NAME: 'x-application-name',


  /**
   * 환경 이름 헤더 (SDK용)
   */
  X_ENVIRONMENT: 'x-environment',

  /**
   * 사용자 ID 헤더 (Chat Server용)
   */
  X_USER_ID: 'x-user-id',

  /**
   * Chat Server ID 헤더
   */
  X_CHAT_SERVER_ID: 'x-chat-server-id',

  /**
   * 요청 ID 헤더
   */
  X_REQUEST_ID: 'x-request-id',

  /**
   * 클라이언트 연결 ID 헤더 (SDK용)
   */
  X_CONNECTION_ID: 'x-connection-id',

  /**
   * 세션 ID 헤더 (SDK용)
   */
  X_SESSION_ID: 'x-session-id',
} as const;

/**
 * 캐시 관련 헤더
 */
export const CACHE_HEADERS = {
  /**
   * 캐시 상태 헤더 (HIT/MISS)
   */
  X_CACHE: 'x-cache',

  /**
   * 캐시 키 헤더
   */
  X_CACHE_KEY: 'x-cache-key',
} as const;

/**
 * 보안 헤더
 */
export const SECURITY_HEADERS = {
  /**
   * X-Frame-Options 헤더
   */
  X_FRAME_OPTIONS: 'x-frame-options',

  /**
   * X-XSS-Protection 헤더
   */
  X_XSS_PROTECTION: 'x-xss-protection',

  /**
   * X-Content-Type-Options 헤더
   */
  X_CONTENT_TYPE_OPTIONS: 'x-content-type-options',

  /**
   * Referrer-Policy 헤더
   */
  REFERRER_POLICY: 'referrer-policy',

  /**
   * Content-Security-Policy 헤더
   */
  CONTENT_SECURITY_POLICY: 'content-security-policy',
} as const;

/**
 * CORS 관련 헤더
 */
export const CORS_HEADERS = {
  /**
   * Access-Control-Allow-Origin 헤더
   */
  ACCESS_CONTROL_ALLOW_ORIGIN: 'access-control-allow-origin',

  /**
   * Access-Control-Allow-Methods 헤더
   */
  ACCESS_CONTROL_ALLOW_METHODS: 'access-control-allow-methods',

  /**
   * Access-Control-Allow-Headers 헤더
   */
  ACCESS_CONTROL_ALLOW_HEADERS: 'access-control-allow-headers',

  /**
   * Access-Control-Allow-Credentials 헤더
   */
  ACCESS_CONTROL_ALLOW_CREDENTIALS: 'access-control-allow-credentials',
} as const;

/**
 * 모든 헤더를 하나로 합친 객체
 */
export const HEADERS = {
  ...STANDARD_HEADERS,
  ...API_HEADERS,
  ...CACHE_HEADERS,
  ...SECURITY_HEADERS,
  ...CORS_HEADERS,
} as const;

/**
 * 헤더 값 상수
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
   * 캐시 상태 값
   */
  CACHE_HIT: 'HIT',
  CACHE_MISS: 'MISS',

  /**
   * 보안 헤더 기본값
   */
  FRAME_OPTIONS_SAMEORIGIN: 'SAMEORIGIN',
  XSS_PROTECTION_BLOCK: '1; mode=block',
  CONTENT_TYPE_OPTIONS_NOSNIFF: 'nosniff',
  REFERRER_POLICY_NO_REFERRER: 'no-referrer-when-downgrade',
} as const;

/**
 * CORS에서 허용할 헤더 목록
 */
export const ALLOWED_HEADERS: string[] = [
  HEADERS.CONTENT_TYPE,
  HEADERS.AUTHORIZATION,
  HEADERS.X_REQUESTED_WITH,
  HEADERS.X_API_TOKEN,
  HEADERS.X_USER_ID,
  HEADERS.X_APPLICATION_NAME,
  HEADERS.X_REQUEST_ID,
  HEADERS.X_ENVIRONMENT,
  HEADERS.X_CONNECTION_ID,
  HEADERS.X_SESSION_ID,
  HEADERS.IF_NONE_MATCH,
];

export default HEADERS;
