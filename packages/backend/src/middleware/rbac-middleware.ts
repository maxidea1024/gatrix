/**
 * RBAC Middleware
 *
 * Provides 3 middleware factories for route-level permission checking:
 * - requireOrgPermission(perm)     ??checks org-level permission
 * - requireProjectPermission(perm) ??checks project-level permission (projectId from params)
 * - requireEnvPermission(perm)     ??checks env-level permission (auto-resolves environment chain)
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { permissionService } from '../services/permission-service';
import { GatrixError } from './error-handler';
import { createLogger } from '../config/logger';

const logger = createLogger('rbacMiddleware');

/**
 * Require an organisation-level permission.
 * Uses req.user.orgId from the authenticated user.
 */
export const requireOrgPermission = (perm: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new GatrixError('Authentication required', 401));
        return;
      }

      const { id: userId, orgId } = req.user;
      if (!orgId) {
        next(new GatrixError('Organisation context required', 403));
        return;
      }

      const allowed = await permissionService.hasOrgPermission(
        userId,
        orgId,
        perm
      );
      if (!allowed) {
        logger.warn('Org permission denied', {
          userId,
          orgId,
          perm,
          path: req.path,
        });
        next(new GatrixError('Insufficient permissions', 403));
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in requireOrgPermission:', error);
      next(new GatrixError('Permission check failed', 500));
    }
  };
};

/**
 * Require a project-level permission.
 * Resolves projectId from: req.params.projectId ??req.projectId
 * Auto-resolves orgId from the project if not on req.user.
 */
export const requireProjectPermission = (perm: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new GatrixError('Authentication required', 401));
        return;
      }

      const { id: userId, orgId } = req.user;
      const projectId = req.params.projectId || req.projectId;

      if (!projectId) {
        next(new GatrixError('Project context required', 400));
        return;
      }

      // Verify project belongs to user's org
      const projectOrgId = await permissionService.resolveProjectOrg(projectId);
      if (!projectOrgId || projectOrgId !== orgId) {
        next(new GatrixError('Project not found in your organisation', 404));
        return;
      }

      // Set projectId on request for downstream use
      req.projectId = projectId;

      const allowed = await permissionService.hasProjectPermission(
        userId,
        orgId,
        projectId,
        perm
      );
      if (!allowed) {
        logger.warn('Project permission denied', {
          userId,
          orgId,
          projectId,
          perm,
          path: req.path,
        });
        next(new GatrixError('Insufficient permissions', 403));
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in requireProjectPermission:', error);
      next(new GatrixError('Permission check failed', 500));
    }
  };
};

/**
 * Require an environment-level permission.
 * Resolves environment from: req.params.environmentId -> req.environmentId -> X-Environment-Id header
 * Auto-resolves the full chain: environment -> project -> organisation
 */
export const requireEnvPermission = (perm: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new GatrixError('Authentication required', 401));
        return;
      }

      const { id: userId, orgId } = req.user;
      const environmentId =
        req.params.environmentId ||
        req.environmentId ||
        (req.headers['x-environment-id'] as string);

      if (!environmentId) {
        next(new GatrixError('Environment context required', 400));
        return;
      }

      // Resolve full chain: environment -> project -> org
      const chain =
        await permissionService.resolveEnvironmentChain(environmentId);
      if (!chain) {
        next(new GatrixError('Environment not found', 404));
        return;
      }

      // Verify the environment belongs to user's org
      if (chain.orgId !== orgId) {
        next(
          new GatrixError('Environment not found in your organisation', 404)
        );
        return;
      }

      // Set resolved context on request
      req.environmentId = environmentId;
      req.projectId = chain.projectId;

      const allowed = await permissionService.hasEnvPermission(
        userId,
        orgId,
        chain.projectId,
        environmentId,
        perm
      );
      if (!allowed) {
        logger.warn('Env permission denied', {
          userId,
          orgId,
          projectId: chain.projectId,
          environmentId,
          perm,
          path: req.path,
        });
        next(new GatrixError('Insufficient permissions', 403));
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in requireEnvPermission:', error);
      next(new GatrixError('Permission check failed', 500));
    }
  };
};

/**
 * Require Org Admin role.
 * Shortcut for routes that need full admin access.
 */
export const requireOrgAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new GatrixError('Authentication required', 401));
      return;
    }

    const { id: userId, orgId } = req.user;
    if (!orgId) {
      next(new GatrixError('Organisation context required', 403));
      return;
    }

    const isOrgAdmin = await permissionService.isOrgAdmin(userId, orgId);
    if (!isOrgAdmin) {
      logger.warn('Org admin access denied', { userId, orgId, path: req.path });
      next(new GatrixError('Admin access required', 403));
      return;
    }

    next();
  } catch (error) {
    logger.error('Error in requireOrgAdmin:', error);
    next(new GatrixError('Permission check failed', 500));
  }
};
