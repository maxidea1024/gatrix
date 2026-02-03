import { Request, Response, NextFunction } from 'express';
import { JwtUtils, JwtPayload } from '../utils/jwt';
import { UserModel } from '../models/User';
import { GatrixError } from './errorHandler';
import logger from '../config/logger';

import { AppUser, AuthenticatedRequest as BaseAuthenticatedRequest } from '../types/auth';

export interface AuthenticatedRequest extends BaseAuthenticatedRequest {
  userDetails?: any;
}

export const auth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.debug('Authentication attempt:', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization,
      authHeaderPrefix: req.headers.authorization?.substring(0, 20) + '...',
    });

    const token = JwtUtils.getTokenFromHeader(req.headers.authorization);

    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        path: req.path,
        method: req.method,
      });
      throw new GatrixError('Access token is required', 401);
    }

    const payload = JwtUtils.verifyToken(token);
    if (!payload) {
      logger.warn('Authentication failed: Invalid token', {
        path: req.path,
        method: req.method,
        tokenPrefix: token.substring(0, 20) + '...',
      });
      throw new GatrixError('Invalid or expired token', 401);
    }

    // Verify user still exists and is active
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      logger.warn('Authentication failed: User not found', {
        path: req.path,
        method: req.method,
        userId: payload.userId,
      });
      throw new GatrixError('User not found', 401);
    }

    if (user.status !== 'active') {
      logger.warn('Authentication failed: User not active', {
        path: req.path,
        method: req.method,
        userId: payload.userId,
        userStatus: user.status,
      });
      throw new GatrixError('User account is not active', 401);
    }

    // Normalize user object on req.user to AppUser-like shape while keeping compatibility
    const normalizedUser: any = {
      id: user.id,
      userId: user.id, // backward compatibility for code using userId
      email: user.email,
      role: user.role,
      name: (user as any).name,
      status: user.status,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };

    // Set both for now (gradual migration to req.user only)
    req.user = normalizedUser as any;
    req.userDetails = normalizedUser;
    next();
  } catch (error) {
    if (error instanceof GatrixError) {
      next(error);
    } else {
      logger.error('Authentication error:', {
        error: (error as any)?.message,
        stack: (error as any)?.stack,
        path: req.path,
        method: req.method,
      });
      next(new GatrixError('Authentication failed', 401));
    }
  }
};

export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied for user:', {
        userId: (req.user as any)?.id ?? (req.user as any)?.userId,
        userRole,
        requiredRoles: allowedRoles,
        endpoint: req.path,
      });
      next(new GatrixError('Insufficient permissions', 403));
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');

/**
 * Middleware to require specific permission(s)
 * Checks if the authenticated user has the required permission(s)
 */
export const requirePermission = (permissions: string | string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    const userId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    try {
      // Check if user has any of the required permissions
      const hasPermission = await UserModel.hasAnyPermission(userId, requiredPermissions);

      if (!hasPermission) {
        logger.warn('Permission denied for user:', {
          userId,
          requiredPermissions,
          endpoint: req.path,
        });
        next(new GatrixError('Insufficient permissions', 403));
        return;
      }

      next();
    } catch (error) {
      logger.error('Error checking permissions:', error);
      next(new GatrixError('Error checking permissions', 500));
    }
  };
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
        const user = await UserModel.findById(payload.userId);
        if (user && user.status === 'active') {
          const normalizedUser: any = {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: user.role,
            name: (user as any).name,
            status: user.status,
            createdAt: (user as any).createdAt,
            updatedAt: (user as any).updatedAt,
          };
          req.user = normalizedUser as any;
          req.userDetails = normalizedUser;
        }
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    logger.debug('Optional auth failed:', error);
    next();
  }
};

export const requireActiveUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userDetails) {
    next(new GatrixError('User details not found', 401));
    return;
  }

  if (req.userDetails.status !== 'active') {
    next(new GatrixError('User account is not active', 403));
    return;
  }

  next();
};

export const requireEmailVerified = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userDetails) {
    next(new GatrixError('User details not found', 401));
    return;
  }

  if (!req.userDetails.email_verified) {
    next(new GatrixError('Email verification required', 403));
    return;
  }

  next();
};

// Export authenticate as alias for auth
export const authenticate = auth;
