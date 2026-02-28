import { Request } from 'express';

export interface AppUser {
  id: string;
  userId: string; // same as id, for gradual migration from number-based code
  email: string;
  name: string;
  orgId: string;
  orgRole: 'admin' | 'user';
  role: 'admin' | 'user'; // maps to orgRole, for gradual migration
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AppUser;
  environment?: string;
  orgId?: string;
  projectId?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  orgId: string;
  orgRole: string;
  iat?: number;
  exp?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface TokenResponse {
  token: string;
  user: Omit<AppUser, 'password'>;
}
