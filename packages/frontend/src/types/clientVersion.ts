// Client status enum
export enum ClientStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  RECOMMENDED_UPDATE = 'RECOMMENDED_UPDATE',
  FORCED_UPDATE = 'FORCED_UPDATE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  BLOCKED_PATCH_ALLOWED = 'BLOCKED_PATCH_ALLOWED',
  MAINTENANCE = 'MAINTENANCE',
}

// 클라이언트 Status 라벨 매핑
export const ClientStatusLabels: Record<ClientStatus, string> = {
  [ClientStatus.ONLINE]: 'clientVersions.status.online',
  [ClientStatus.OFFLINE]: 'clientVersions.status.offline',
  [ClientStatus.RECOMMENDED_UPDATE]: 'clientVersions.status.recommendedUpdate',
  [ClientStatus.FORCED_UPDATE]: 'clientVersions.status.forcedUpdate',
  [ClientStatus.UNDER_REVIEW]: 'clientVersions.status.underReview',
  [ClientStatus.BLOCKED_PATCH_ALLOWED]:
    'clientVersions.status.blockedPatchAllowed',
  [ClientStatus.MAINTENANCE]: 'clientVersions.status.maintenance',
};

// 클라이언트 Status 색상 매핑
export const ClientStatusColors: Record<
  ClientStatus,
  'success' | 'error' | 'warning' | 'info' | 'default'
> = {
  [ClientStatus.ONLINE]: 'success',
  [ClientStatus.OFFLINE]: 'error',
  [ClientStatus.RECOMMENDED_UPDATE]: 'warning',
  [ClientStatus.FORCED_UPDATE]: 'error',
  [ClientStatus.UNDER_REVIEW]: 'info',
  [ClientStatus.BLOCKED_PATCH_ALLOWED]: 'warning',
  [ClientStatus.MAINTENANCE]: 'warning',
};

// 클라이언트 버전 Interface
export interface ClientVersionMaintenanceLocale {
  lang: 'ko' | 'en' | 'zh';
  message: string;
}

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
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: ClientVersionMaintenanceLocale[];
  minPatchVersion?: string;
  targetEnv?: string;
  targetEnvName?: string;
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

// Client version Create/Edit data
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
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: ClientVersionMaintenanceLocale[];
  minPatchVersion?: string;
  targetEnv?: string;
  tags?: { id: number; name: string; color: string }[];
}

// 간편 추가를 위한 플랫Form별 Settings
export interface PlatformSpecificSettings {
  platform: string;
  gameServerAddress: string;
  gameServerAddressForWhiteList?: string;
  patchAddress: string;
  patchAddressForWhiteList?: string;
}

// 간편 추가 Form 데이터
export interface BulkCreateFormData {
  clientVersion: string;
  clientStatus: ClientStatus;
  guestModeAllowed: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: ClientVersionMaintenanceLocale[];
  platforms: PlatformSpecificSettings[];
  targetEnv?: string;
  tags?: { id: number; name: string; color: string }[];
}

// 클라이언트 버전 Filter
export interface ClientVersionFilters {
  version?: string | string[];
  platform?: string | string[];
  clientStatus?: ClientStatus | ClientStatus[];
  gameServerAddress?: string;
  patchAddress?: string;
  guestModeAllowed?: boolean | boolean[];
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
  // Comma-separated tag IDs for AND semantics, e.g. "1,2,3"
  tagIds?: string;
  // Legacy support: array of tag IDs
  tags?: string[];
  tagsOperator?: 'any_of' | 'include_all';
}

// 클라이언트 버전 Sorting 옵션
export type ClientVersionSortField =
  | 'id'
  | 'platform'
  | 'clientVersion'
  | 'clientStatus'
  | 'createdAt'
  | 'updatedAt';

export type SortOrder = 'ASC' | 'DESC';

// 클라이언트 버전 목록 Response
export interface ClientVersionListResponse {
  clientVersions: ClientVersion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 일괄 Status 변경 Request
export interface BulkStatusUpdateRequest {
  ids: number[];
  clientStatus: ClientStatus;
  // 점검 관련 필드들
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: ClientVersionMaintenanceLocale[];
  messageTemplateId?: number;
}

// Pagination Settings
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

// Form 필드 정의
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

// API Response Type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 메타데이터 Response
export interface ClientVersionMetadata {
  platforms: string[];
}

// 로컬 스토리지 키
export const CLIENT_VERSION_STORAGE_KEYS = {
  PAGE_SIZE: 'clientVersionPageSize',
  FILTERS: 'clientVersionFilters',
  SORT: 'clientVersionSort',
} as const;

// Default values
export const CLIENT_VERSION_DEFAULTS = {
  PAGE_SIZE: 10,
  SORT_BY: 'createdAt' as ClientVersionSortField,
  SORT_ORDER: 'DESC' as SortOrder,
} as const;

// Form Validation 규칙
export const CLIENT_VERSION_VALIDATION = {
  PLATFORM: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
  },
  CLIENT_VERSION: {
    PATTERN: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
    EXAMPLE: 'e.g., 1.0.0, 2.1.3, 1.0.0-beta.1',
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
