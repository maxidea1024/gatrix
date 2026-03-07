import { Response, NextFunction } from 'express';
import { JwtUtils } from '../utils/jwt';
import { UserModel } from '../models/user';
import { GatrixError } from './error-handler';
import { createLogger } from '../config/logger';
import db from '../config/knex';

const logger = createLogger('auth');
import { permissionService } from '../services/permission-service';
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

    let orgId = payload.orgId;

    // Fallback: if JWT orgId is empty (token issued before org membership), look it up from DB
    if (!orgId) {
      try {
        const membership = await db('g_organisation_members')
          .where('userId', String(user.id))
          .orderBy('joinedAt', 'asc')
          .first();
        if (membership) {
          orgId = membership.orgId;
        }
      } catch {
        // Non-critical: proceed with empty orgId
      }
    }

    const appUser: AppUser = {
      id: String(user.id),
      userId: String(user.id),
      email: user.email,
      name: (user as any).name,
      orgId,
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
          const appUser: AppUser = {
            id: String(user.id),
            userId: String(user.id),
            email: user.email,
            name: (user as any).name,
            orgId: payload.orgId,
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

/**
 * Require org-level permission.
 * Checks via permissionService.hasOrgPermission (uses org-scope role bindings).
 */
export const requireOrgPermission = (permissions: string | string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    for (const perm of requiredPermissions) {
      if (await permissionService.hasOrgPermission(req.user.id, req.user.orgId, perm)) {
        next();
        return;
      }
    }

    logger.warn(`[requireOrgPermission] DENIED: userId=${req.user.id}, path=${req.path}, required=${JSON.stringify(requiredPermissions)}`);
    next(new GatrixError('Insufficient permissions', 403));
  };
};

/**
 * Require project-level permission.
 * Expects req.projectId to be set (by orgProjectScope middleware).
 * Checks via permissionService.hasProjectPermission (uses project-scope role bindings with override chain).
 */
export const requireProjectPermission = (permissions: string | string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    const projectId = req.projectId || req.params.projectId;
    if (!projectId) {
      next(new GatrixError('Project context required', 400));
      return;
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    for (const perm of requiredPermissions) {
      if (await permissionService.hasProjectPermission(req.user.id, req.user.orgId, projectId, perm)) {
        next();
        return;
      }
    }

    logger.warn(`[requireProjectPermission] DENIED: userId=${req.user.id}, projectId=${projectId}, path=${req.path}, required=${JSON.stringify(requiredPermissions)}`);
    next(new GatrixError('Insufficient permissions', 403));
  };
};

/**
 * Require environment-level permission.
 * Expects req.environmentId to be set (by environmentContextMiddleware).
 * Falls back to project-level check if no environment context is available.
 */
export const requireEnvPermission = (permissions: string | string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    const projectId = req.projectId || req.params.projectId;
    const environmentId = req.environmentId as string | undefined;

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    for (const perm of requiredPermissions) {
      // If environment context is available, check env-level permission
      if (environmentId && projectId) {
        if (await permissionService.hasEnvPermission(req.user.id, req.user.orgId, projectId, environmentId, perm)) {
          next();
          return;
        }
      }
      // Fallback to project-level check when no environment context
      else if (projectId) {
        if (await permissionService.hasProjectPermission(req.user.id, req.user.orgId, projectId, perm)) {
          next();
          return;
        }
      }
      // Fallback to org-level check when no project context
      else {
        if (await permissionService.hasOrgPermission(req.user.id, req.user.orgId, perm)) {
          next();
          return;
        }
      }
    }

    logger.warn(`[requireEnvPermission] DENIED: userId=${req.user.id}, projectId=${projectId}, envId=${environmentId}, path=${req.path}, required=${JSON.stringify(requiredPermissions)}`);
    next(new GatrixError('Insufficient permissions', 403));
  };
};

export const authenticate = auth;
