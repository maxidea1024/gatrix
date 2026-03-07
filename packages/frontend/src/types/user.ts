// 태그 Interface
export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Used자 역할
export type UserRole = 'admin' | 'user';

// Used자 Status
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';

// 기본 Used자 Interface
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  preferredLanguage?: string;
  role?: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  tags?: Tag[];
}

// Used자 Create 데이터
export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  tags?: string[]; // Tag ID array
}

// Used자 업데이트 데이터
export interface UpdateUserData {
  name?: string;
  email?: string;
  avatarUrl?: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  tags?: string[]; // Tag ID array
}

// Used자 Filter
export interface UserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  tags?: string[]; // Filter by tag IDs
}

// Used자 목록 Response
export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Used자 통계
export interface UserStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  admins: number;
}

// API Response 래퍼
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Used자 Default values
export const USER_DEFAULTS = {
  PAGE_SIZE: 10,
  SORT_BY: 'createdAt',
  SORT_ORDER: 'DESC' as const,
  ROLE: 'user' as UserRole,
  STATUS: 'active' as UserStatus,
};
