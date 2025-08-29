import { Response, NextFunction } from 'express';
import { AuditLogModel } from '../models/AuditLog';
import { AuthenticatedRequest } from './auth';
import { createLogger } from '../config/logger';

const logger = createLogger('AuditLog');

export interface AuditLogOptions {
  action: string;
  resourceType?: string;
  getResourceId?: (req: any) => string | undefined;
  getDetails?: (req: any, res: any) => any;
  skipIf?: (req: any, res: any) => boolean;
}

export const auditLog = (options: AuditLogOptions) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original res.end to capture response
    const originalEnd = res.end;
    let responseBody: any;

    // Override res.end to capture response data
    res.end = function(chunk?: any, encoding?: any): Response {
      if (chunk && typeof chunk === 'string') {
        try {
          responseBody = JSON.parse(chunk);
        } catch (e) {
          responseBody = chunk;
        }
      }
      return originalEnd.call(this, chunk, encoding);
    };

    // Continue with the request
    res.on('finish', async () => {
      try {
        // Skip logging if condition is met
        if (options.skipIf && options.skipIf(req, res)) {
          return;
        }

        // Skip logging for failed requests (4xx, 5xx) unless explicitly configured
        if (res.statusCode >= 400) {
          return;
        }

        const resourceId = options.getResourceId ? options.getResourceId(req) : undefined;
        const details = options.getDetails ? options.getDetails(req, res) : undefined;

        await AuditLogModel.create({
          user_id: req.user?.userId,
          action: options.action,
          resource_type: options.resourceType,
          resource_id: resourceId,
          details: details || {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            body: req.body,
            query: req.query,
            params: req.params,
          },
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
        });
      } catch (error) {
        // Don't fail the request if audit logging fails
        logger.error('Failed to create audit log:', error);
      }
    });

    next();
  };
};

// Predefined audit log middlewares for common actions
export const auditUserLogin = auditLog({
  action: 'user_login',
  resourceType: 'user',
  getResourceId: (req) => req.body?.email,
  getDetails: (req) => ({
    email: req.body?.email,
    loginMethod: 'password',
  }),
});

export const auditUserRegister = auditLog({
  action: 'user_register',
  resourceType: 'user',
  getResourceId: (req) => req.body?.email,
  getDetails: (req) => ({
    email: req.body?.email,
    name: req.body?.name,
  }),
});

export const auditUserUpdate = auditLog({
  action: 'user_update',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
    updates: req.body,
  }),
});

export const auditUserDelete = auditLog({
  action: 'user_delete',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
  }),
});

export const auditUserApprove = auditLog({
  action: 'user_approve',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
  }),
});

export const auditUserReject = auditLog({
  action: 'user_reject',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
  }),
});

export const auditUserSuspend = auditLog({
  action: 'user_suspend',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
  }),
});

export const auditUserUnsuspend = auditLog({
  action: 'user_unsuspend',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
  }),
});

export const auditUserPromote = auditLog({
  action: 'user_promote',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
    newRole: 'admin',
  }),
});

export const auditUserDemote = auditLog({
  action: 'user_demote',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    userId: req.params?.id,
    newRole: 'user',
  }),
});

// Game world actions
export const auditGameWorldCreate = auditLog({
  action: 'game_world_create',
  resourceType: 'game_world',
  getResourceId: (req) => req.body?.worldId,
  getDetails: (req) => ({
    body: req.body,
  }),
});

export const auditGameWorldUpdate = auditLog({
  action: 'game_world_update',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({
    id: req.params?.id,
    updates: req.body,
  }),
});

export const auditGameWorldDelete = auditLog({
  action: 'game_world_delete',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({ id: req.params?.id }),
});

export const auditGameWorldToggleVisibility = auditLog({
  action: 'game_world_toggle_visibility',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({ id: req.params?.id, toggle: 'visibility' }),
});

export const auditGameWorldToggleMaintenance = auditLog({
  action: 'game_world_toggle_maintenance',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({ id: req.params?.id, toggle: 'maintenance' }),
});

export const auditGameWorldUpdateOrders = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getDetails: (req) => ({
    updates: req.body?.orderUpdates,
  }),
});

export const auditGameWorldMoveUp = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({ id: req.params?.id, direction: 'up' }),
});

export const auditGameWorldMoveDown = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getDetails: (req) => ({ id: req.params?.id, direction: 'down' }),
});

export const auditPasswordChange = auditLog({
  action: 'password_change',
  resourceType: 'user',
  getResourceId: (req: AuthenticatedRequest) => req.user?.userId?.toString(),
  getDetails: (req: AuthenticatedRequest) => ({
    userId: req.user?.userId,
  }),
});

export const auditProfileUpdate = auditLog({
  action: 'profile_update',
  resourceType: 'user',
  getResourceId: (req: AuthenticatedRequest) => req.user?.userId?.toString(),
  getDetails: (req: AuthenticatedRequest) => ({
    userId: req.user?.userId,
    updates: req.body,
  }),
});
