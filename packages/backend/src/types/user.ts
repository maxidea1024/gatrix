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
  user_id: number;
  provider: 'google' | 'github';
  provider_id: string;
  provider_email?: string;
  provider_name?: string;
  provider_avatar?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOAuthAccountData {
  user_id: number;
  provider: 'google' | 'github';
  provider_id: string;
  provider_email?: string;
  provider_name?: string;
  provider_avatar?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface CreateAuditLogData {
  user_id?: number;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}
