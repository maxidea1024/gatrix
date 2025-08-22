// User types
export interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  email_verified: boolean;
  email_verified_at?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser extends User {
  accessToken?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'auto';

// Language types
export type Language = 'en' | 'ko' | 'zh';

// Navigation types
export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  children?: NavItem[];
  roles?: string[];
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: any;
}

// Filter types
export interface UserFilters {
  role?: 'admin' | 'user';
  status?: 'pending' | 'active' | 'suspended' | 'deleted';
  search?: string;
}

// Audit log types
export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Error types
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}
