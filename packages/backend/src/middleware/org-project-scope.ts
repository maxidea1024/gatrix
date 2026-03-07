import { Response, NextFunction } from 'express';
import { GatrixError } from './error-handler';
import { AuthenticatedRequest } from '../types/auth';

/**
 * Middleware to extract orgId and projectId from URL path params.
 * Used for project-scoped admin routes:
 *   /admin/orgs/:orgId/projects/:projectId/...
 *
 * Sets req.orgId and req.projectId from path params.
 */
export const orgProjectScope = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const { orgId, projectId } = req.params;

  if (!orgId) {
    next(new GatrixError('orgId is required in URL path', 400));
    return;
  }

  if (!projectId) {
    next(new GatrixError('projectId is required in URL path', 400));
    return;
  }

  req.orgId = orgId;
  req.projectId = projectId;

  next();
};
