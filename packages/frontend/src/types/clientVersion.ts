// 클라이언트 상태 enum
export enum ClientStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  RECOMMENDED_UPDATE = 'recommended_update',
  FORCED_UPDATE = 'forced_update',
  UNDER_REVIEW = 'under_review',
  BLOCKED_PATCH_ALLOWED = 'blocked_patch_allowed'
}

// 클라이언트 상태 라벨 매핑
export const ClientStatusLabels: Record<ClientStatus, string> = {
  [ClientStatus.ONLINE]: 'clientVersions.status.online',
  [ClientStatus.OFFLINE]: 'clientVersions.status.offline',
  [ClientStatus.RECOMMENDED_UPDATE]: 'clientVersions.status.recommendedUpdate',
  [ClientStatus.FORCED_UPDATE]: 'clientVersions.status.forcedUpdate',
  [ClientStatus.UNDER_REVIEW]: 'clientVersions.status.underReview',
  [ClientStatus.BLOCKED_PATCH_ALLOWED]: 'clientVersions.status.blockedPatchAllowed',
};

// 클라이언트 상태 색상 매핑
export const ClientStatusColors: Record<ClientStatus, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  [ClientStatus.ONLINE]: 'success',
  [ClientStatus.OFFLINE]: 'error',
  [ClientStatus.RECOMMENDED_UPDATE]: 'warning',
  [ClientStatus.FORCED_UPDATE]: 'error',
  [ClientStatus.UNDER_REVIEW]: 'info',
  [ClientStatus.BLOCKED_PATCH_ALLOWED]: 'warning',
};

// 클라이언트 버전 인터페이스
export interface ClientVersion {
  id: number;
  platform: string;
  clientVersion: string;
  clientStatus: ClientStatus;
  gameServerAddress: string;
  gameServerAddressForWhiteList?: string;
  patchAddress: string;
  patchAddressForWhiteList?: string;
  guestModeAllowed: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  tags?: { id: number; name: string; color: string }[];
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  updatedBy: number;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
}

// 클라이언트 버전 생성/수정 데이터
export interface ClientVersionFormData {
  platform: string;
  clientVersion: string;
  clientStatus: ClientStatus;
  gameServerAddress: string;
  gameServerAddressForWhiteList?: string;
  patchAddress: string;
  patchAddressForWhiteList?: string;
  guestModeAllowed: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  tags?: { id: number; name: string; color: string }[];
}

// 간편 추가를 위한 플랫폼별 설정
export interface PlatformSpecificSettings {
  platform: string;
  gameServerAddress: string;
  gameServerAddressForWhiteList?: string;
  patchAddress: string;
  patchAddressForWhiteList?: string;
}

// 간편 추가 폼 데이터
export interface BulkCreateFormData {
  clientVersion: string;
  clientStatus: ClientStatus;
  guestModeAllowed: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  platforms: PlatformSpecificSettings[];
  tags?: { id: number; name: string; color: string }[];
}

// 클라이언트 버전 필터
export interface ClientVersionFilters {
  version?: string;
  platform?: string;
  clientStatus?: ClientStatus;
  gameServerAddress?: string;
  patchAddress?: string;
  guestModeAllowed?: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  createdBy?: number;
  updatedBy?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  search?: string;
}

// 클라이언트 버전 정렬 옵션
export type ClientVersionSortField = 
  | 'id'
  | 'platform'
  | 'clientVersion'
  | 'clientStatus'
  | 'createdAt'
  | 'updatedAt';

export type SortOrder = 'ASC' | 'DESC';

// 클라이언트 버전 목록 응답
export interface ClientVersionListResponse {
  clientVersions: ClientVersion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 일괄 상태 변경 요청
export interface BulkStatusUpdateRequest {
  ids: number[];
  clientStatus: ClientStatus;
}

// 페이지네이션 설정
export interface ClientVersionPagination {
  page: number;
  limit: number;
  sortBy?: ClientVersionSortField;
  sortOrder?: SortOrder;
}

// 테이블 컬럼 정의
export interface ClientVersionTableColumn {
  id: keyof ClientVersion | 'actions' | 'select';
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: ClientVersion) => React.ReactNode;
}

// 폼 필드 정의
export interface ClientVersionFormField {
  name: keyof ClientVersionFormData;
  label: string;
  type: 'text' | 'select' | 'boolean' | 'textarea' | 'url';
  required?: boolean;
  options?: { value: string | boolean; label: string }[];
  placeholder?: string;
  helperText?: string;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any) => string | null;
  };
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 메타데이터 응답
export interface ClientVersionMetadata {
  platforms: string[];
}

// 로컬 스토리지 키
export const CLIENT_VERSION_STORAGE_KEYS = {
  PAGE_SIZE: 'clientVersionPageSize',
  FILTERS: 'clientVersionFilters',
  SORT: 'clientVersionSort',
} as const;

// 기본값
export const CLIENT_VERSION_DEFAULTS = {
  PAGE_SIZE: 10,
  SORT_BY: 'createdAt' as ClientVersionSortField,
  SORT_ORDER: 'DESC' as SortOrder,
} as const;

// 폼 유효성 검사 규칙
export const CLIENT_VERSION_VALIDATION = {
  PLATFORM: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
  },
  CLIENT_VERSION: {
    PATTERN: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
    EXAMPLE: '예: 1.0.0, 2.1.3, 1.0.0-beta.1',
  },
  SERVER_ADDRESS: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 500,
  },
  PATCH_ADDRESS: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 500,
  },
  EXTERNAL_LINK: {
    MAX_LENGTH: 500,
  },
  MEMO: {
    MAX_LENGTH: 1000,
  },
  CUSTOM_PAYLOAD: {
    MAX_LENGTH: 5000,
  },
} as const;
