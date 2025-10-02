// Frontend crash types for client crash tracking

export interface ClientCrash {
  id: number;
  branch: number;
  chash: string;
  firstLine: string;
  count: number;
  state: CrashState;
  lastCrash: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
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
  createdAt: string; // ISO date string
}

export enum CrashState {
  OPEN = 0,
  CLOSED = 1,
  DELETED = 2
}

export enum Platform {
  UNKNOWN = 0,
  ANDROID = 1,
  IOS = 2,
  WINDOWS = 3,
  MAC = 4,
  LINUX = 5,
  WEB = 6
}

export enum Branch {
  PRODUCTION = 1,
  STAGING = 2,
  DEVELOPMENT = 3,
  EDITOR = 9
}

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

export enum ServerGroup {
  GLOBAL = 'global',
  KOREA = 'korea',
  CHINA = 'china',
  JAPAN = 'japan',
  SEA = 'sea',
  NA = 'na',
  EU = 'eu',
  OTHER = 'other'
}

export interface CrashFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  serverGroup?: ServerGroup;
  marketType?: MarketType;
  deviceType?: Platform;
  branch?: Branch;
  majorVer?: number;
  minorVer?: number;
  buildNum?: number;
  patchNum?: number;
  state?: CrashState;
}

export interface GetCrashesRequest extends CrashFilters {
  page?: number;
  limit?: number;
}

export interface GetCrashesResponse {
  data: ClientCrash[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CrashDetail extends ClientCrash {
  instances: CrashInstance[];
  stackTrace?: string;
}

export interface CrashStats {
  total: number;
  open: number;
  closed: number;
  recent: number; // last 24 hours
  versionDistribution: { version: string; count: number }[];
  platformDistribution: { platform: string; count: number }[];
  affectedUsers: number;
  latestInstances: CrashInstance[];
}

export interface UpdateCrashStateRequest {
  state: CrashState;
}

// Helper functions for display
export const getPlatformName = (platform: Platform): string => {
  switch (platform) {
    case Platform.ANDROID: return 'Android';
    case Platform.IOS: return 'iOS';
    case Platform.WINDOWS: return 'Windows';
    case Platform.MAC: return 'Mac';
    case Platform.LINUX: return 'Linux';
    case Platform.WEB: return 'Web';
    default: return 'Unknown';
  }
};

export const getBranchName = (branch: Branch): string => {
  switch (branch) {
    case Branch.PRODUCTION: return 'Production';
    case Branch.STAGING: return 'Staging';
    case Branch.DEVELOPMENT: return 'Development';
    case Branch.EDITOR: return 'Editor';
    default: return 'Unknown';
  }
};

export const getStateName = (state: CrashState): string => {
  switch (state) {
    case CrashState.OPEN: return 'Open';
    case CrashState.CLOSED: return 'Closed';
    case CrashState.DELETED: return 'Deleted';
    default: return 'Unknown';
  }
};

export const getVersionString = (crash: ClientCrash | CrashInstance): string => {
  if ('majorVer' in crash) {
    return `${crash.majorVer}.${crash.minorVer}.${crash.buildNum}.${crash.patchNum}`;
  }
  return 'Unknown';
};
