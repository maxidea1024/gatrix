import { Response, NextFunction } from 'express';
import { JwtUtils } from '../utils/jwt';
import { UserModel } from '../models/User';
import { GatrixError } from './errorHandler';
import { createLogger } from '../config/logger';

const logger = createLogger('auth');
import { permissionService } from '../services/PermissionService';
import { AppUser, AuthenticatedRequest } from '../types/auth';

export type { AuthenticatedRequest };

export const auth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JwtUtils.getTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new GatrixError('Access token is required', 401);
    }

    const payload = JwtUtils.verifyToken(token);
    if (!payload) {
      throw new GatrixError('Invalid or expired token', 401);
    }

    // Verify user still exists and is active
    const user = await UserModel.findById(payload.userId as any);
    if (!user) {
      throw new GatrixError('User not found', 401);
    }

    if (user.status !== 'active') {
      throw new GatrixError('User account is not active', 401);
    }

    const orgId = payload.orgId;
    const orgRole = payload.orgRole as 'admin' | 'user';

    const appUser: AppUser = {
      id: String(user.id),
      userId: String(user.id),
      email: user.email,
      name: (user as any).name,
      orgId,
      orgRole,
      role: orgRole,
      isActive: user.status === 'active',
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };

    req.user = appUser;
    req.orgId = orgId;

    next();
  } catch (error) {
    if (error instanceof GatrixError) {
      next(error);
    } else {
      logger.error('Authentication error:', {
        error: (error as any)?.message,
        path: req.path,
        method: req.method,
      });
      next(new GatrixError('Authentication failed', 401));
    }
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JwtUtils.getTokenFromHeader(req.headers.authorization);

    if (token) {
      const payload = JwtUtils.verifyToken(token);
      if (payload) {
        const user = await UserModel.findById(payload.userId as any);
        if (user && user.status === 'active') {
          const orgRole = payload.orgRole as 'admin' | 'user';
          const appUser: AppUser = {
            id: String(user.id),
            userId: String(user.id),
            email: user.email,
            name: (user as any).name,
            orgId: payload.orgId,
            orgRole,
            role: orgRole,
            isActive: true,
            createdAt: (user as any).createdAt,
            updatedAt: (user as any).updatedAt,
          };
          req.user = appUser;
          req.orgId = payload.orgId;
        }
      }
    }

    next();
  } catch (error) {
    logger.debug('Optional auth failed:', error);
    next();
  }
};

// Gradual migration: re-export from rbacMiddleware
export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    const userRole = req.user.orgRole;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      next(new GatrixError('Insufficient permissions', 403));
      return;
    }

    next();
  };
};

export const requirePermission = (permissions: string | string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    // Org admin has all permissions
    const isAdmin = await permissionService.isOrgAdmin(req.user.id, req.user.orgId);
    if (isAdmin) {
      next();
      return;
    }

    // For now, check org-level permissions for backward compatibility
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    for (const perm of requiredPermissions) {
      const has = await permissionService.hasOrgPermission(req.user.id, req.user.orgId, perm);
      if (has) {
        next();
        return;
      }
    }

    next(new GatrixError('Insufficient permissions', 403));
  };
};

export const authenticate = auth;
