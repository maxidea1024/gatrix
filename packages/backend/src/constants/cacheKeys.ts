/**
 * Cache Keys Constants
 *
 * 중앙 집중식 캐시 키 관리
 * 모든 캐시 키는 이 파일에서 관리하여 일관성과 유지보수성을 향상시킵니다.
 */

import {
  getCurrentEnvironmentId,
  isDefaultEnvironmentInitialized
} from '../utils/environmentContext';

/**
 * Environment-scoped cache key prefix
 * Used for data that varies by environment (game worlds, client versions, etc.)
 * Format: env:{environmentId}:{originalKey}
 */
export const ENV_PREFIX = 'env';

/**
 * Create an environment-scoped cache key
 * @param environmentId - The environment ULID
 * @param key - The original cache key
 * @returns Environment-prefixed cache key
 */
export function withEnvironment(environmentId: string, key: string): string {
  return `${ENV_PREFIX}:${environmentId}:${key}`;
}

/**
 * Create an environment-scoped cache key using current context
 * Falls back to the original key if environment context is not initialized
 * @param key - The original cache key
 * @returns Environment-prefixed cache key if context available, otherwise original key
 */
export function withCurrentEnvironment(key: string): string {
  if (!isDefaultEnvironmentInitialized()) {
    // During initialization, return the key without environment prefix
    return key;
  }
  const envId = getCurrentEnvironmentId();
  return `${ENV_PREFIX}:${envId}:${key}`;
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
 * 게임월드 관련 캐시 키
 */
export const GAME_WORLDS = {
  /**
   * 공개 게임월드 목록 (클라이언트 API용)
   * - 표시 가능하고 점검 중이 아닌 월드들
   * - TTL: 10분
   */
  PUBLIC: 'game_worlds:public',

  /**
   * 관리자용 게임월드 목록
   * - 모든 월드 (숨김/점검 포함)
   * - TTL: 5분
   */
  ADMIN: 'game_worlds:admin',

  /**
   * 특정 게임월드 상세 정보
   * @param id 게임월드 ID
   */
  DETAIL: (id: number) => `game_world:${id}`,

  /**
   * 월드 ID로 게임월드 조회
   * @param worldId 월드 ID
   */
  BY_WORLD_ID: (worldId: string) => `game_world:world_id:${worldId}`,
} as const;

/**
 * 클라이언트 버전 관련 캐시 키
 */
export const CLIENT_VERSION = {
  /**
   * 채널별 클라이언트 버전 정보
   * @param channel 채널명
   * @param subChannel 서브채널명
   */
  BY_CHANNEL: (channel: string, subChannel: string) => `client_version:${channel}:${subChannel}`,

  /**
   * 모든 클라이언트 버전 목록
   */
  ALL: 'client_versions:all',

  /**
   * 활성화된 클라이언트 버전만
   */
  ACTIVE: 'client_versions:active',
} as const;

/**
 * 사용자 관련 캐시 키
 */
export const USER = {
  /**
   * 사용자 프로필 정보
   * @param userId 사용자 ID
   */
  PROFILE: (userId: number) => `user:${userId}:profile`,

  /**
   * 사용자 권한 정보
   * @param userId 사용자 ID
   */
  PERMISSIONS: (userId: number) => `user:${userId}:permissions`,

  /**
   * 사용자 세션 정보
   * @param sessionId 세션 ID
   */
  SESSION: (sessionId: string) => `user:session:${sessionId}`,
} as const;

/**
 * 태그 관련 캐시 키
 */
export const TAG = {
  /**
   * 모든 태그 목록
   */
  ALL: 'tags:all',

  /**
   * 엔티티별 태그 목록
   * @param entityType 엔티티 타입 (game_world, user 등)
   * @param entityId 엔티티 ID
   */
  BY_ENTITY: (entityType: string, entityId: number) => `tags:${entityType}:${entityId}`,
} as const;

/**
 * 화이트리스트 관련 캐시 키
 */
export const WHITELIST = {
  /**
   * 모든 화이트리스트 항목
   */
  ALL: 'whitelist:all',

  /**
   * 활성화된 화이트리스트 항목만
   */
  ACTIVE: 'whitelist:active',

  /**
   * 특정 IP의 화이트리스트 상태
   * @param ip IP 주소
   */
  BY_IP: (ip: string) => `whitelist:ip:${ip}`,
} as const;

/**
 * 점검 관련 캐시 키
 */
export const MAINTENANCE = {
  /**
   * 현재 점검 상태
   */
  STATUS: 'maintenance:status',

  /**
   * 점검 템플릿 목록
   */
  TEMPLATES: 'maintenance:templates',
} as const;

/**
 * 메시지 템플릿 관련 캐시 키
 */
export const MESSAGE_TEMPLATE = {
  /**
   * 모든 메시지 템플릿
   */
  ALL: 'message_templates:all',

  /**
   * 타입별 메시지 템플릿
   * @param type 템플릿 타입
   */
  BY_TYPE: (type: string) => `message_templates:type:${type}`,
} as const;

/**
 * 번역 관련 캐시 키
 */
export const TRANSLATION = {
  /**
   * 원문 텍스트 해시 + 대상 언어별 번역 결과
   * @param hash 원문 텍스트 sha256 해시
   * @param lang 대상 언어 코드
   */
  BY_TEXT_LANG: (hash: string, lang: 'ko' | 'en' | 'zh') => `translate:${hash}:${lang}`,

  /**
   * 언어 감지 결과 (원문 텍스트 해시 기반)
   * @param hash 원문 텍스트 sha256 해시
   */
  DETECT: (hash: string) => `translate:detect:${hash}`,
} as const;


/**
 * 작업(Job) 관련 캐시 키
 */
export const JOB = {
  /**
   * 모든 작업 목록
   */
  ALL: 'jobs:all',

  /**
   * 작업 타입 목록
   */
  TYPES: 'job_types:all',

  /**
   * 특정 작업 상세 정보
   * @param jobId 작업 ID
   */
  DETAIL: (jobId: number) => `job:${jobId}`,
} as const;

/**
 * 감사 로그 관련 캐시 키
 */
export const AUDIT_LOG = {
  /**
   * 최근 감사 로그 (페이지네이션)
   * @param page 페이지 번호
   * @param limit 페이지 크기
   */
  RECENT: (page: number, limit: number) => `audit_logs:recent:${page}:${limit}`,

  /**
   * 사용자별 감사 로그
   * @param userId 사용자 ID
   * @param page 페이지 번호
   */
  BY_USER: (userId: number, page: number) => `audit_logs:user:${userId}:${page}`,
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
    DETAIL: (id: number) => `game_world:${id}`,
    BY_WORLD_ID: (worldId: string) => `game_world:world_id:${worldId}`,
  },

  /**
   * Client versions (environment-specific)
   */
  CLIENT_VERSION: {
    BY_CHANNEL: (channel: string, subChannel: string) => `client_version:${channel}:${subChannel}`,
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
} as const;



/**
 * 캐시 패턴 (패턴 기반 삭제용)
 */
export const PATTERNS = {
  /**
   * 모든 게임월드 관련 캐시
   */
  GAME_WORLDS: 'game_world*',

  /**
   * 모든 클라이언트 버전 관련 캐시
   */
  CLIENT_VERSIONS: 'client_version*',

  /**
   * 특정 사용자 관련 모든 캐시
   * @param userId 사용자 ID
   */
  USER: (userId: number) => `user:${userId}*`,

  /**
   * 모든 태그 관련 캐시
   */
  TAGS: 'tags*',

  /**
   * 모든 화이트리스트 관련 캐시
   */
  WHITELIST: 'whitelist*',

  /**
   * 모든 점검 관련 캐시
   */
  MAINTENANCE: 'maintenance*',

  /**
   * 모든 메시지 템플릿 관련 캐시
   */
  MESSAGE_TEMPLATES: 'message_template*',

  /**
   * 모든 작업 관련 캐시
   */
  JOBS: 'job*',

  /**
   * 모든 감사 로그 관련 캐시
   */
  AUDIT_LOGS: 'audit_log*',

  /**
   * 모든 번역 관련 캐시
   */
  TRANSLATION: 'translate*',

  /**
   * 특정 환경의 모든 캐시
   * @param environmentId 환경 ULID
   */
  ENVIRONMENT: (environmentId: string) => `${ENV_PREFIX}:${environmentId}:*`,

  /**
   * 모든 환경의 특정 패턴 캐시
   * @param pattern 캐시 패턴
   */
  ALL_ENVIRONMENTS: (pattern: string) => `${ENV_PREFIX}:*:${pattern}`,
} as const;

/**
 * 캐시 TTL 상수 (밀리초)
 */
export const TTL = {
  /**
   * 1분
   */
  ONE_MINUTE: 60 * 1000,

  /**
   * 5분
   */
  FIVE_MINUTES: 5 * 60 * 1000,

  /**
   * 10분
   */
  TEN_MINUTES: 10 * 60 * 1000,

  /**
   * 30분
   */
  THIRTY_MINUTES: 30 * 60 * 1000,

  /**
   * 1시간
   */
  ONE_HOUR: 60 * 60 * 1000,

  /**
   * 1일
   */
  ONE_DAY: 24 * 60 * 60 * 1000,
} as const;

/**
 * 기본 캐시 설정
 */
export const DEFAULT_CONFIG = {
  /**
   * 게임월드 공개 목록 TTL
   */
  GAME_WORLDS_PUBLIC_TTL: TTL.TEN_MINUTES,

  /**
   * 클라이언트 버전 TTL
   */
  CLIENT_VERSION_TTL: TTL.FIVE_MINUTES,

  /**
   * 사용자 프로필 TTL
   */
  USER_PROFILE_TTL: TTL.THIRTY_MINUTES,

  /**
   * 태그 목록 TTL
   */
  TAGS_TTL: TTL.ONE_HOUR,

  /**
   * 화이트리스트 TTL
   */
  WHITELIST_TTL: TTL.FIVE_MINUTES,

  /**
   * 점검 상태 TTL
   */
  MAINTENANCE_TTL: TTL.ONE_MINUTE,

  /**
   * 인게임 팝업 공지 TTL (Server SDK용)
   */
  POPUP_NOTICE_TTL: TTL.ONE_MINUTE,

  /**
   * 설문 목록 TTL (Server SDK용)
   */
  SURVEYS_TTL: TTL.ONE_MINUTE,

  /**
   * 설문 설정 TTL (Server SDK용)
   */
  SURVEY_SETTINGS_TTL: TTL.ONE_MINUTE,

  /**
   * 번역 결과/언어 감지 TTL
   */
  TRANSLATION_TTL: TTL.ONE_DAY,

  /**
   * 서비스 공지 TTL (Server SDK용 - Edge)
   */
  SERVICE_NOTICE_TTL: TTL.ONE_MINUTE,

  /**
   * 배너 TTL (Server SDK용 - Edge)
   */
  BANNER_TTL: TTL.FIVE_MINUTES,

  /**
   * 스토어 상품 TTL (Server SDK용)
   */
  STORE_PRODUCT_TTL: TTL.FIVE_MINUTES,
} as const;
