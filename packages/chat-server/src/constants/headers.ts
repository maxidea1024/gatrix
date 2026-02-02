/**
 * HTTP 헤더 이름 상수 (Chat Server용)
 * 모든 헤더 이름을 중앙에서 관리하여 하드코딩을 방지합니다.
 */

/**
 * 표준 HTTP 헤더
 */
export const STANDARD_HEADERS = {
  /**
   * Authorization 헤더
   */
  AUTHORIZATION: "authorization",

  /**
   * Content-Type 헤더
   */
  CONTENT_TYPE: "content-type",

  /**
   * User-Agent 헤더
   */
  USER_AGENT: "user-agent",

  /**
   * Accept 헤더
   */
  ACCEPT: "accept",

  /**
   * X-Requested-With 헤더
   */
  X_REQUESTED_WITH: "x-requested-with",
} as const;

/**
 * 커스텀 API 헤더
 */
export const API_HEADERS = {
  /**
   * API 토큰 헤더
   */
  X_API_TOKEN: "x-api-token",

  /**
   * 애플리케이션 이름 헤더
   */
  X_APPLICATION_NAME: "x-application-name",

  /**
   * 사용자 ID 헤더
   */
  X_USER_ID: "x-user-id",

  /**
   * Chat Server ID 헤더
   */
  X_CHAT_SERVER_ID: "x-chat-server-id",
} as const;

/**
 * 모든 헤더를 하나로 합친 객체
 */
export const HEADERS = {
  ...STANDARD_HEADERS,
  ...API_HEADERS,
} as const;

/**
 * 헤더 값 상수
 */
export const HEADER_VALUES = {
  /**
   * Bearer 토큰 접두사
   */
  BEARER_PREFIX: "Bearer ",

  /**
   * JSON Content-Type
   */
  APPLICATION_JSON: "application/json",
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
];

export default HEADERS;
