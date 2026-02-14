export type SupportedLanguage = 'en' | 'ko' | 'zh';
export type AuthType = 'local' | 'google' | 'github' | 'qq' | 'wechat' | 'baidu' | 'service-account';

export interface User {
  id: number;
  email: string;
  passwordHash?: string;
  name: string;
  avatarUrl?: string;
  preferredLanguage: SupportedLanguage;
  role: 'admin' | 'user';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  authType: AuthType;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  oauthProvider?: string;
  oauthId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
  createdByName?: string;
  createdByEmail?: string;
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
  oauthProvider?: string;
  oauthId?: string;
  createdBy?: number;
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
}

export interface UserWithoutPassword extends Omit<User, 'passwordHash'> { }

export interface OAuthAccount {
  id: number;
  userId: number;
  provider: 'google' | 'github' | 'qq' | 'wechat' | 'baidu';
  providerId: string;
  providerEmail?: string;
  providerName?: string;
  providerAvatar?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOAuthAccountData {
  userId: number;
  provider: 'google' | 'github' | 'qq' | 'wechat' | 'baidu';
  providerId: string;
  providerEmail?: string;
  providerName?: string;
  providerAvatar?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface AuditLog {
  id: number;
  userId?: number;
  action: string;
  description?: string;
  entityType?: string;
  entityId?: number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface CreateAuditLogData {
  userId?: number;
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
