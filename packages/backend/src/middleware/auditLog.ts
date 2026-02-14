import { Response, NextFunction } from 'express';
import { AuditLogModel } from '../models/AuditLog';
import { AuthenticatedRequest } from './auth';
import { createLogger } from '../config/logger';
import { enhancedAuditLog, fetchGameWorldById, fetchUserById } from '../utils/enhancedAuditLog';

const logger = createLogger('AuditLog');

export interface AuditLogOptions {
  action: string;
  resourceType?: string;
  getResourceId?: (req: any) => string | undefined;
  getResourceIdFromResponse?: (responseBody: any) => string | number | undefined;
  getOldValues?: (req: any) => any;
  getNewValues?: (req: any, res: any) => any;
  getDescription?: (req: any, res: any) => string;
  skipIf?: (req: any, res: any) => boolean;
}

export const auditLog = (options: AuditLogOptions) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original res.end to capture response
    const originalEnd = res.end;
    let responseBody: any;

    // Override res.end to capture response data
    res.end = function (chunk?: any, encoding?: any): Response {
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
        const description = options.getDescription ? options.getDescription(req, res) : undefined;

        await AuditLogModel.create({
          userId: req.user?.userId,
          action: options.action,
          description,
          resourceType: options.resourceType,
          resourceId: resourceId ? resourceId.toString() : undefined,
          oldValues: oldValues,
          newValues: newValues,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          environment: req.environment,
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
  getResourceIdFromResponse: (responseBody) => responseBody?.data?.user?.id,
  getNewValues: (req) => ({
    email: req.body?.email,
    loginMethod: 'password',
  }),
  getDescription: (req) => `User '${req.body?.email}' logged in`,
});

export const auditUserRegister = auditLog({
  action: 'user_register',
  resourceType: 'user',
  getResourceIdFromResponse: (responseBody) => responseBody?.data?.user?.id,
  getNewValues: (req) => ({
    email: req.body?.email,
    name: req.body?.name,
  }),
  getDescription: (req) => `User '${req.body?.name}' (${req.body?.email}) registered`,
});

export const auditUserUpdate = enhancedAuditLog({
  action: 'user_update',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (req, _res, oldValues) => {
    const changes: any = {};
    const body = req.body;

    // Track only changed fields
    if (body.name !== undefined && body.name !== oldValues?.name) changes.name = body.name;
    if (body.email !== undefined && body.email !== oldValues?.email) changes.email = body.email;
    if (body.role !== undefined && body.role !== oldValues?.role) changes.role = body.role;
    if (body.status !== undefined && body.status !== oldValues?.status)
      changes.status = body.status;
    if (body.tags !== undefined) changes.tags = body.tags;

    return changes;
  },
  getContext: (req, oldValues, newValues) => ({
    operation: 'update_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    changedFields: Object.keys(newValues || {}),
  }),
  getDescription: (_req, oldValues, newValues) =>
    `User '${oldValues?.name || oldValues?.email}' updated (${Object.keys(newValues || {}).join(', ')})`,
});

export const auditUserDelete = enhancedAuditLog({
  action: 'user_delete',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    deletedUser: {
      id: oldValues?.id,
      email: oldValues?.email,
      name: oldValues?.name,
      role: oldValues?.role,
      status: oldValues?.status,
    },
  }),
  getContext: (_req, oldValues) => ({
    operation: 'delete_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    userRole: oldValues?.role,
  }),
  getDescription: (_req, oldValues) =>
    `User '${oldValues?.name}' (${oldValues?.email}) deleted`,
});

export const auditUserApprove = enhancedAuditLog({
  action: 'user_approve',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    status: 'active',
    previousStatus: oldValues?.status,
  }),
  getContext: (_req, oldValues) => ({
    operation: 'approve_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    statusChange: `${oldValues?.status} → active`,
  }),
  getDescription: (_req, oldValues) =>
    `User '${oldValues?.name}' (${oldValues?.email}) approved (${oldValues?.status} → active)`,
});

export const auditUserReject = enhancedAuditLog({
  action: 'user_reject',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    status: 'deleted',
    previousStatus: oldValues?.status,
  }),
  getContext: (_req, oldValues) => ({
    operation: 'reject_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    statusChange: `${oldValues?.status} → deleted`,
  }),
  getDescription: (_req, oldValues) =>
    `User '${oldValues?.name}' (${oldValues?.email}) rejected (${oldValues?.status} → deleted)`,
});

export const auditUserSuspend = enhancedAuditLog({
  action: 'user_suspend',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    status: 'suspended',
    previousStatus: oldValues?.status,
  }),
  getContext: (_req, oldValues) => ({
    operation: 'suspend_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    statusChange: `${oldValues?.status} → suspended`,
  }),
  getDescription: (_req, oldValues) =>
    `User '${oldValues?.name}' (${oldValues?.email}) suspended (${oldValues?.status} → suspended)`,
});

export const auditUserUnsuspend = enhancedAuditLog({
  action: 'user_unsuspend',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    status: 'active',
    previousStatus: oldValues?.status,
  }),
  getContext: (_req, oldValues) => ({
    operation: 'unsuspend_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    statusChange: `${oldValues?.status} → active`,
  }),
  getDescription: (_req, oldValues) =>
    `User '${oldValues?.name}' (${oldValues?.email}) unsuspended (${oldValues?.status} → active)`,
});

export const auditUserPromote = enhancedAuditLog({
  action: 'user_promote',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    role: 'admin',
    previousRole: oldValues?.role,
  }),
  getContext: (_req, oldValues) => ({
    operation: 'promote_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    roleChange: `${oldValues?.role} → admin`,
  }),
  getDescription: (_req, oldValues) =>
    `User '${oldValues?.name}' (${oldValues?.email}) promoted to admin (${oldValues?.role} → admin)`,
});

export const auditUserDemote = enhancedAuditLog({
  action: 'user_demote',
  resourceType: 'user',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    return await fetchUserById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    role: 'user',
    previousRole: oldValues?.role,
  }),
  getContext: (_req, oldValues) => ({
    operation: 'demote_user',
    userName: oldValues?.name,
    userEmail: oldValues?.email,
    roleChange: `${oldValues?.role} → user`,
  }),
  getDescription: (_req, oldValues) =>
    `User '${oldValues?.name}' (${oldValues?.email}) demoted to user (${oldValues?.role} → user)`,
});

// Game world actions
export const auditGameWorldCreate = enhancedAuditLog({
  action: 'game_world_create',
  resourceType: 'game_world',
  getResourceIdFromResponse: (responseBody) => responseBody?.data?.id || responseBody?.id,
  getNewValues: (req) => ({
    worldId: req.body?.worldId,
    name: req.body?.name,
    isVisible: req.body?.isVisible ?? true,
    isMaintenance: req.body?.isMaintenance ?? false,
    displayOrder: req.body?.displayOrder,
    description: req.body?.description,
  }),
  getContext: (req) => ({
    operation: 'create_game_world',
    worldId: req.body?.worldId,
    worldName: req.body?.name,
  }),
  getDescription: (req) =>
    `Game world '${req.body?.name}' (${req.body?.worldId}) created`,
});

export const auditGameWorldUpdate = enhancedAuditLog({
  action: 'game_world_update',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = parseInt(req.params?.id);
    if (isNaN(id)) return null;
    return await fetchGameWorldById(id);
  },
  getNewValues: (req, _res, oldValues) => {
    const changes: any = {};
    const body = req.body;

    // Track only changed fields
    if (body.name !== undefined && body.name !== oldValues?.name) changes.name = body.name;
    if (body.worldId !== undefined && body.worldId !== oldValues?.worldId)
      changes.worldId = body.worldId;
    if (body.isVisible !== undefined && body.isVisible !== oldValues?.isVisible)
      changes.isVisible = body.isVisible;
    if (body.isMaintenance !== undefined && body.isMaintenance !== oldValues?.isMaintenance)
      changes.isMaintenance = body.isMaintenance;
    if (body.displayOrder !== undefined && body.displayOrder !== oldValues?.displayOrder)
      changes.displayOrder = body.displayOrder;
    if (body.description !== undefined && body.description !== oldValues?.description)
      changes.description = body.description;
    if (
      body.maintenanceMessage !== undefined &&
      body.maintenanceMessage !== oldValues?.maintenanceMessage
    )
      changes.maintenanceMessage = body.maintenanceMessage;

    return changes;
  },
  getContext: (req, oldValues, newValues) => ({
    operation: 'update_game_world',
    worldId: oldValues?.worldId,
    worldName: oldValues?.name,
    changedFields: Object.keys(newValues || {}),
  }),
  getDescription: (_req, oldValues, newValues) =>
    `Game world '${oldValues?.name}' (${oldValues?.worldId}) updated (${Object.keys(newValues || {}).join(', ')})`,
});

export const auditGameWorldDelete = enhancedAuditLog({
  action: 'game_world_delete',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = parseInt(req.params?.id);
    if (isNaN(id)) return null;
    return await fetchGameWorldById(id);
  },
  getNewValues: (_req, _res, oldValues) => ({
    deletedWorld: {
      id: oldValues?.id,
      worldId: oldValues?.worldId,
      name: oldValues?.name,
      isVisible: oldValues?.isVisible,
      isMaintenance: oldValues?.isMaintenance,
    },
  }),
  getContext: (_req, oldValues) => ({
    operation: 'delete_game_world',
    worldId: oldValues?.worldId,
    worldName: oldValues?.name,
  }),
  getDescription: (_req, oldValues) =>
    `Game world '${oldValues?.name}' (${oldValues?.worldId}) deleted`,
});

export const auditGameWorldToggleVisibility = enhancedAuditLog({
  action: 'game_world_toggle_visibility',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = parseInt(req.params?.id);
    if (isNaN(id)) return null;
    return await fetchGameWorldById(id);
  },
  getNewValues: (req, res, oldValues) => {
    const newIsVisible = oldValues ? !oldValues.isVisible : req.body?.isVisible;
    return {
      worldId: oldValues?.worldId,
      name: oldValues?.name,
      isVisible: newIsVisible,
      changedFrom: oldValues?.isVisible,
      changedTo: newIsVisible,
    };
  },
  getContext: (req, oldValues, newValues) => ({
    operation: 'toggle_visibility',
    worldName: oldValues?.name,
    worldId: oldValues?.worldId,
    description: `Changed visibility from ${oldValues?.isVisible} to ${newValues?.changedTo}`,
  }),
});

export const auditGameWorldToggleMaintenance = enhancedAuditLog({
  action: 'game_world_toggle_maintenance',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = parseInt(req.params?.id);
    if (isNaN(id)) return null;
    return await fetchGameWorldById(id);
  },
  getNewValues: (req, res, oldValues) => {
    const newIsMaintenance = oldValues ? !oldValues.isMaintenance : req.body?.isMaintenance;
    return {
      worldId: oldValues?.worldId,
      name: oldValues?.name,
      isMaintenance: newIsMaintenance,
      changedFrom: oldValues?.isMaintenance,
      changedTo: newIsMaintenance,
      maintenanceMessage: oldValues?.maintenanceMessage,
      maintenanceStartDate: oldValues?.maintenanceStartDate,
      maintenanceEndDate: oldValues?.maintenanceEndDate,
    };
  },
  getContext: (req, oldValues, newValues) => ({
    operation: 'toggle_maintenance',
    worldName: oldValues?.name,
    worldId: oldValues?.worldId,
    description: `Changed maintenance status from ${oldValues?.isMaintenance} to ${newValues?.changedTo}`,
  }),
});

export const auditGameWorldUpdateOrders = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getNewValues: (req) => ({ orderUpdates: req.body?.orderUpdates }),
  getDescription: () => `Game world display order updated`,
});

export const auditGameWorldMoveUp = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ direction: 'up' }),
  getDescription: (req) => `Game world #${req.params?.id} moved up`,
});

export const auditGameWorldMoveDown = auditLog({
  action: 'game_world_update_orders',
  resourceType: 'game_world',
  getResourceId: (req) => req.params?.id,
  getNewValues: () => ({ direction: 'down' }),
  getDescription: (req) => `Game world #${req.params?.id} moved down`,
});

export const auditPasswordChange = auditLog({
  action: 'password_change',
  resourceType: 'user',
  getResourceId: (req: AuthenticatedRequest) => req.user?.userId?.toString(),
  getDescription: (req: AuthenticatedRequest) => `User '${req.user?.email}' changed password`,
});

// 기본 auditLog 함수만 유지하고 개별 미들웨어는 제거
// 각 라우트에서 auditLog를 직접 사용하도록 변경

export const auditProfileUpdate = auditLog({
  action: 'profile_update',
  resourceType: 'user',
  getResourceId: (req: AuthenticatedRequest) => req.user?.userId?.toString(),
  getNewValues: (req: AuthenticatedRequest) => req.body,
  getDescription: (req: AuthenticatedRequest) => `User '${req.user?.email}' updated profile`,
});

// Service Notice actions
export const auditServiceNoticeCreate = auditLog({
  action: 'service_notice_create',
  resourceType: 'service_notice',
  getResourceIdFromResponse: (responseBody) =>
    responseBody?.data?.notice?.id || responseBody?.notice?.id,
  getNewValues: (req) => ({
    title: req.body?.title,
    category: req.body?.category,
    platforms: req.body?.platforms,
    isActive: req.body?.isActive,
    startDate: req.body?.startDate,
    endDate: req.body?.endDate,
  }),
  getDescription: (req) => `Service notice '${req.body?.title}' created (category: ${req.body?.category})`,
});

export const auditServiceNoticeUpdate = enhancedAuditLog({
  action: 'service_notice_update',
  resourceType: 'service_notice',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    try {
      const ServiceNoticeService = require('../services/ServiceNoticeService').default;
      const notice = await ServiceNoticeService.getServiceNoticeById(parseInt(id));
      return {
        title: notice.title,
        category: notice.category,
        platforms: notice.platforms,
        isActive: notice.isActive,
        startDate: notice.startDate,
        endDate: notice.endDate,
      };
    } catch (error) {
      return null;
    }
  },
  getNewValues: (req) => ({
    title: req.body?.title,
    category: req.body?.category,
    platforms: req.body?.platforms,
    isActive: req.body?.isActive,
    startDate: req.body?.startDate,
    endDate: req.body?.endDate,
  }),
  getContext: (req, oldValues) => ({
    operation: 'update_service_notice',
    noticeTitle: oldValues?.title || req.body?.title,
  }),
  getDescription: (req, oldValues) =>
    `Service notice '${oldValues?.title || req.body?.title}' updated`,
});

export const auditServiceNoticeDelete = enhancedAuditLog({
  action: 'service_notice_delete',
  resourceType: 'service_notice',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    try {
      const ServiceNoticeService = require('../services/ServiceNoticeService').default;
      const notice = await ServiceNoticeService.getServiceNoticeById(parseInt(id));
      return {
        title: notice.title,
        category: notice.category,
        platforms: notice.platforms,
        isActive: notice.isActive,
        startDate: notice.startDate,
        endDate: notice.endDate,
      };
    } catch (error) {
      return null;
    }
  },
  getContext: (req, oldValues) => ({
    operation: 'delete_service_notice',
    noticeTitle: oldValues?.title,
  }),
  getDescription: (_req, oldValues) =>
    `Service notice '${oldValues?.title}' deleted`,
});

export const auditServiceNoticeBulkDelete = auditLog({
  action: 'service_notice_bulk_delete',
  resourceType: 'service_notice',
  getNewValues: (req) => ({
    ids: req.body?.ids,
    count: req.body?.ids?.length || 0,
  }),
  getDescription: (req) => `${req.body?.ids?.length || 0} service notice(s) bulk deleted`,
});

export const auditServiceNoticeToggleActive = enhancedAuditLog({
  action: 'service_notice_toggle_active',
  resourceType: 'service_notice',
  getResourceId: (req) => req.params?.id,
  fetchOldValues: async (req) => {
    const id = req.params?.id;
    if (!id) return null;
    try {
      const ServiceNoticeService = require('../services/ServiceNoticeService').default;
      const notice = await ServiceNoticeService.getServiceNoticeById(parseInt(id));
      return {
        title: notice.title,
        isActive: notice.isActive,
      };
    } catch (error) {
      return null;
    }
  },
  getNewValues: (_req, _res, oldValues) => ({
    isActive: !oldValues?.isActive,
  }),
  getContext: (_req, oldValues) => ({
    operation: 'toggle_service_notice_status',
    noticeTitle: oldValues?.title,
    statusChange: `${oldValues?.isActive ? 'active' : 'inactive'} → ${!oldValues?.isActive ? 'active' : 'inactive'}`,
  }),
  getDescription: (_req, oldValues) =>
    `Service notice '${oldValues?.title}' ${!oldValues?.isActive ? 'activated' : 'deactivated'}`,
});
