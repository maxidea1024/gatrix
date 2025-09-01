export interface User {
  id: number;
  email: string;
  passwordHash?: string;
  name: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  oauthProvider?: string;
  oauthId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  password?: string;
  name: string;
  avatarUrl?: string;
  role?: 'admin' | 'user';
  status?: 'pending' | 'active' | 'suspended' | 'deleted';
  emailVerified?: boolean;
  oauthProvider?: string;
  oauthId?: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  avatarUrl?: string;
  role?: 'admin' | 'user';
  status?: 'pending' | 'active' | 'suspended' | 'deleted';
  emailVerified?: boolean;
  lastLoginAt?: Date;
}

export interface UserWithoutPassword extends Omit<User, 'passwordHash'> {}

export interface OAuthAccount {
  id: number;
  userId: number;
  provider: 'google' | 'github';
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
  provider: 'google' | 'github';
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
  resourceType?: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}
