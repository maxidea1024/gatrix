/**
 * HTTP 헤더 이름 상수 (Edge Server)
 */

export const HEADERS = {
  // Standard Headers
  AUTHORIZATION: 'authorization',
  CONTENT_TYPE: 'content-type',
  IF_NONE_MATCH: 'if-none-match',

  // Custom API Headers
  X_API_TOKEN: 'x-api-token',
  X_APPLICATION_NAME: 'x-application-name',
  X_ENVIRONMENT_ID: 'x-environment-id',
  X_SDK_VERSION: 'x-sdk-version',
  X_CLIENT_VERSION: 'x-client-version',
  X_PLATFORM: 'x-platform',
  X_CONNECTION_ID: 'x-connection-id',
  X_SESSION_ID: 'x-session-id',
  X_REQUEST_ID: 'x-request-id',

  // Gatrix Context Headers
  X_GATRIX_FEATURE_CONTEXT: 'x-gatrix-feature-context',
  X_GATRIX_CONTEXT_HASH: 'x-gatrix-context-hash',
} as const;

/**
 * CORS에서 허용할 헤더 목록
 */
export const ALLOWED_HEADERS: string[] = [
  HEADERS.CONTENT_TYPE,
  HEADERS.AUTHORIZATION,
  HEADERS.IF_NONE_MATCH,
  HEADERS.X_API_TOKEN,
  HEADERS.X_APPLICATION_NAME,
  HEADERS.X_ENVIRONMENT_ID,
  HEADERS.X_SDK_VERSION,
  HEADERS.X_CLIENT_VERSION,
  HEADERS.X_PLATFORM,
  HEADERS.X_CONNECTION_ID,
  HEADERS.X_SESSION_ID,
  HEADERS.X_REQUEST_ID,
  HEADERS.X_GATRIX_FEATURE_CONTEXT,
  HEADERS.X_GATRIX_CONTEXT_HASH,
];
