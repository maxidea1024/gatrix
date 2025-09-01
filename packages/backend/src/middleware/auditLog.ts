import { Response, NextFunction } from 'express';
import { AuditLogModel } from '../models/AuditLog';
import { AuthenticatedRequest } from './auth';
import { createLogger } from '../config/logger';

const logger = createLogger('AuditLog');

export interface AuditLogOptions {
  action: string;
  resourceType?: string;
  getResourceId?: (req: any) => string | undefined;
  getResourceIdFromResponse?: (responseBody: any) => string | number | undefined;
  getOldValues?: (req: any) => any;
  getNewValues?: (req: any, res: any) => any;
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

        // Resource ID 결정 (요청에서 또는 응답에서)
        let resourceId = options.getResourceId ? options.getResourceId(req) : undefined;
        if (!resourceId && options.getResourceIdFromResponse && responseBody) {
          const id = options.getResourceIdFromResponse(responseBody);
          resourceId = id ? id.toString() : undefined;
        }

        const oldValues = options.getOldValues ? options.getOldValues(req) : undefined;
        const newValues = options.getNewValues ? options.getNewValues(req, res) : req.body;

        await AuditLogModel.create({
          userId: req.user?.userId,
          action: options.action,
          resourceType: options.resourceType,
          resourceId: resourceId ? resourceId.toString() : undefined,
          oldValues: oldValues,
          newValues: newValues,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
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
  getNewValues: (req) => ({
    email: req.body?.email,
    loginMethod: 'password',
  }),
});

export const auditUserRegister = auditLog({
  action: 'user_register',
  resourceType: 'user',
  getResourceId: (req) => req.body?.email,
  getNewValues: (req) => ({
    email: req.body?.email,
    name: req.body?.name,
  }),
});

export const auditUserUpdate = auditLog({
  action: 'user_update',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getNewValues: (req) => req.body,
});

export const auditUserDelete = auditLog({
  action: 'user_delete',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
});

export const auditUserApprove = auditLog({
  action: 'user_approve',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ status: 'active' }),
});

export const auditUserReject = auditLog({
  action: 'user_reject',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ status: 'deleted' }),
});

export const auditUserSuspend = auditLog({
  action: 'user_suspend',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ status: 'suspended' }),
});

export const auditUserUnsuspend = auditLog({
  action: 'user_unsuspend',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ status: 'active' }),
});

export const auditUserPromote = auditLog({
  action: 'user_promote',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ role: 'admin' }),
});

export const auditUserDemote = auditLog({
  action: 'user_demote',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ role: 'user' }),
});

// Game world actions
export const auditGameWorldCreate = auditLog({
  action: 'game_world_create',
  resourceType: 'game_world',
  // Don't set getResourceId for create operations since ID doesn't exist yet
  getNewValues: (req) => req.body,
});

export const auditGameWorldUpdate = auditLog({
  action: 'game_world_update',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getNewValues: (req) => req.body,
});

export const auditGameWorldDelete = auditLog({
  action: 'game_world_delete',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
});

export const auditGameWorldToggleVisibility = auditLog({
  action: 'game_world_toggle_visibility',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getNewValues: (req) => ({ isVisible: req.body?.isVisible }),
});

export const auditGameWorldToggleMaintenance = auditLog({
  action: 'game_world_toggle_maintenance',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getNewValues: (req) => ({ isMaintenance: req.body?.isMaintenance }),
});

export const auditGameWorldUpdateOrders = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getNewValues: (req) => ({ orderUpdates: req.body?.orderUpdates }),
});

export const auditGameWorldMoveUp = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ direction: 'up' }),
});

export const auditGameWorldMoveDown = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ direction: 'down' }),
});

export const auditPasswordChange = auditLog({
  action: 'password_change',
  resourceType: 'user',
  getResourceId: (req: AuthenticatedRequest) => req.user?.userId?.toString(),
});

// 기본 auditLog 함수만 유지하고 개별 미들웨어는 제거
// 각 라우트에서 auditLog를 직접 사용하도록 변경

export const auditProfileUpdate = auditLog({
  action: 'profile_update',
  resourceType: 'user',
  getResourceId: (req: AuthenticatedRequest) => req.user?.userId?.toString(),
  getNewValues: (req: AuthenticatedRequest) => req.body,
});
