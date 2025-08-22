import { Request } from 'express';

export interface AppUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AppUser;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
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
