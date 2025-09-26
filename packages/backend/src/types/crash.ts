// Client Crash types based on the analysis document

export interface ClientCrash {
  id: number;
  branch: number;
  chash: string;
  firstLine: string;
  count: number;
  state: CrashState;
  lastCrash: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrashInstance {
  id: number;
  cid: number; // crash id
  pubId: string;
  userId: number;
  platform: number;
  majorVer: number;
  minorVer: number;
  buildNum: number;
  patchNum: number;
  userMsg?: string;
  createdAt: Date;
}

export enum CrashState {
  OPEN = 0,
  CLOSED = 1,
  DELETED = 2
}

// Platform constants based on analysis
export enum Platform {
  UNKNOWN = 0,
  ANDROID = 1,
  IOS = 2,
  WINDOWS = 3,
  MAC = 4,
  LINUX = 5,
  WEB = 6
}

// Branch constants
export enum Branch {
  PRODUCTION = 1,
  STAGING = 2,
  DEVELOPMENT = 3,
  EDITOR = 9 // Special branch with different reopen logic
}

// Market types for Android (중국대응 목적)
export enum MarketType {
  GOOGLE_PLAY = 'google_play',
  HUAWEI = 'huawei',
  XIAOMI = 'xiaomi',
  OPPO = 'oppo',
  VIVO = 'vivo',
  BAIDU = 'baidu',
  TENCENT = 'tencent',
  SAMSUNG = 'samsung',
  OTHER = 'other'
}

// Server groups for regional issue tracking
export enum ServerGroup {
  GLOBAL = 'global',
  KOREA = 'korea',
  CHINA = 'china',
  JAPAN = 'japan',
  SEA = 'sea', // Southeast Asia
  NA = 'na', // North America
  EU = 'eu', // Europe
  OTHER = 'other'
}

export interface CrashFilters {
  search?: string; // 유저닉네임 또는 UserId 검색
  dateFrom?: string;
  dateTo?: string;
  serverGroup?: ServerGroup; // 특정 국가 이슈파악목적
  marketType?: MarketType; // 중국대응 목적. Android 마켓별 이슈파악
  deviceType?: Platform; // 운영체제 (platform)
  branch?: Branch; // 브랜치
  majorVer?: number;
  minorVer?: number;
  buildNum?: number;
  patchNum?: number;
  state?: CrashState;
}

export interface CrashListResponse {
  crashes: ClientCrash[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Upload request body structure from analysis
export interface CrashUploadRequest {
  pubId: string; // 퍼블리셔 ID
  userId: number; // 사용자 ID
  platform: Platform; // 플랫폼 정보
  branch: Branch; // 브랜치 정보
  majorVer: number; // 메이저 버전
  minorVer: number; // 마이너 버전
  buildNum: number; // 빌드 번호
  patchNum: number; // 패치 번호
  userMsg?: string; // 사용자 메시지
  stack: string; // 스택 트레이스 (ErrWithStack)
  log?: string; // 로그 데이터
  serverGroup?: ServerGroup; // 서버 그룹 정보
  marketType?: MarketType; // 마켓 타입 정보
}

// Constants from analysis
export const CRASH_CONSTANTS = {
  MaxFirstLineLen: 200,
  MaxUserMsgLen: 255,
  MaxLogTextLen: 1048576 // 1MB
} as const;

// Detailed crash view with instances
export interface CrashDetail extends ClientCrash {
  instances: CrashInstance[];
  stackTrace?: string; // Full stack trace from file
}

// Pagination options
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

// Response wrapper
export interface CrashResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
