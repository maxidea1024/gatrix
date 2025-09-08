// 태그 인터페이스
export interface Tag {
  id: number;
  name: string;
  color: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 사용자 역할
export type UserRole = 'admin' | 'user';

// 사용자 상태
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';

// 기본 사용자 인터페이스
export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
  preferredLanguage?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  createdByName?: string;
  createdByEmail?: string;
  tags?: Tag[];
}

// 사용자 생성 데이터
export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  tags?: number[]; // 태그 ID 배열
}

// 사용자 업데이트 데이터
export interface UpdateUserData {
  name?: string;
  email?: string;
  avatarUrl?: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  tags?: number[]; // 태그 ID 배열
}

// 사용자 필터
export interface UserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  tags?: number[]; // 태그 ID 배열로 필터링
}

// 사용자 목록 응답
export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 사용자 통계
export interface UserStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  admins: number;
}

// API 응답 래퍼
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 사용자 기본값
export const USER_DEFAULTS = {
  PAGE_SIZE: 10,
  SORT_BY: 'createdAt',
  SORT_ORDER: 'DESC' as const,
  ROLE: 'user' as UserRole,
  STATUS: 'active' as UserStatus,
};
