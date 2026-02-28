export type SupportedLanguage = 'en' | 'ko' | 'zh';
export type AuthType =
  | 'local'
  | 'google'
  | 'github'
  | 'qq'
  | 'wechat'
  | 'baidu'
  | 'service-account';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  avatarUrl?: string;
  preferredLanguage: SupportedLanguage;
  role: 'admin' | 'user'; // mapped from org membership, kept for gradual migration
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  authType: AuthType;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  isEditor: boolean;
  forceToEditorMode: boolean;
  ssoProviderId?: string;
  ssoSubjectId?: string;
  tags?: any;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  password?: string;
  name: string;
  avatarUrl?: string;
  preferredLanguage?: SupportedLanguage;
  role?: 'admin' | 'user';
  status?: 'pending' | 'active' | 'suspended' | 'deleted';
  authType?: AuthType;
  emailVerified?: boolean;
  createdBy?: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  avatarUrl?: string;
  preferredLanguage?: SupportedLanguage;
  role?: 'admin' | 'user';
  status?: 'pending' | 'active' | 'suspended' | 'deleted';
  authType?: AuthType;
  emailVerified?: boolean;
  lastLoginAt?: Date;
  isEditor?: boolean;
  forceToEditorMode?: boolean;
}

export interface UserWithoutPassword extends Omit<User, 'passwordHash'> {}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: 'google' | 'github' | 'qq' | 'wechat' | 'baidu';
  providerId: string;
  providerData?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOAuthAccountData {
  userId: string;
  provider: 'google' | 'github' | 'qq' | 'wechat' | 'baidu';
  providerId: string;
  providerData?: any;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  environment?: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface CreateAuditLogData {
  userId?: string;
  action: string;
  description?: string;
  resourceType?: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  environment?: string;
}
