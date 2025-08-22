import { Request, Response, NextFunction } from 'express';
import { JwtUtils, JwtPayload } from '../utils/jwt';
import { UserModel } from '../models/User';
import { CustomError } from './errorHandler';
import logger from '../config/logger';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  userDetails?: any;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JwtUtils.getTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new CustomError('Access token is required', 401);
    }

    const payload = JwtUtils.verifyToken(token);
    if (!payload) {
      throw new CustomError('Invalid or expired token', 401);
    }

    // Verify user still exists and is active
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw new CustomError('User not found', 401);
    }

    if (user.status !== 'active') {
      throw new CustomError('User account is not active', 401);
    }

    req.user = payload;
    req.userDetails = user;
    next();
  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      logger.error('Authentication error:', error);
      next(new CustomError('Authentication failed', 401));
    }
  }
};

export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new CustomError('Authentication required', 401));
      return;
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied for user:', {
        userId: req.user.userId,
        userRole,
        requiredRoles: allowedRoles,
        endpoint: req.path,
      });
      next(new CustomError('Insufficient permissions', 403));
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');

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
          req.user = payload;
          req.userDetails = user;
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
    next(new CustomError('User details not found', 401));
    return;
  }

  if (req.userDetails.status !== 'active') {
    next(new CustomError('User account is not active', 403));
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
    next(new CustomError('User details not found', 401));
    return;
  }

  if (!req.userDetails.email_verified) {
    next(new CustomError('Email verification required', 403));
    return;
  }

  next();
};
