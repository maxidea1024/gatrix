import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserService } from '../services/userService';
import { UserTagService } from '../services/UserTagService';
import { AuditLogModel } from '../models/AuditLog';
import { CustomError } from '../middleware/errorHandler';
import { clearAllCache } from '../middleware/responseCache';
import logger from '../config/logger';
import db from '../config/knex';

export class AdminController {
  // Dashboard and statistics
  static async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const [userStats, auditStats] = await Promise.all([
        UserService.getUserStats(),
        AdminController.getAuditStatsData()
      ]);

      res.json({
        success: true,
        data: {
          users: userStats,
          audit: auditStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await UserService.getUserStats();

      res.json({
        success: true,
        data: {
          totalUsers: stats.total,
          activeUsers: stats.active,
          pendingUsers: stats.pending,
          adminUsers: stats.admins
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await UserService.getUserStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  // User management
  static async getAllUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Handle role as single value or array
      const role = req.query.role;
      let roleValue: string | string[] | undefined;
      if (role) {
        roleValue = Array.isArray(role) ? role.map(r => String(r)) : String(role);
      }
      const roleOperator = req.query.role_operator as 'any_of' | 'include_all' | undefined;

      // Handle status as single value or array
      const status = req.query.status;
      let statusValue: string | string[] | undefined;
      if (status) {
        statusValue = Array.isArray(status) ? status.map(s => String(s)) : String(status);
      }
      const statusOperator = req.query.status_operator as 'any_of' | 'include_all' | undefined;

      const search = req.query.search as string;
      const tags = req.query.tags;
      const tagsOperator = req.query.tags_operator as 'any_of' | 'include_all' | undefined;

      const filters: any = {};
      if (roleValue) {
        filters.role = roleValue;
        if (roleOperator) filters.role_operator = roleOperator;
      }
      if (statusValue) {
        filters.status = statusValue;
        if (statusOperator) filters.status_operator = statusOperator;
      }
      if (search) filters.search = search;
      if (tags) {
        // tags can be a single string or array of strings
        filters.tags = Array.isArray(tags) ? tags : [tags];
        if (tagsOperator) filters.tags_operator = tagsOperator;
      }

      console.log('[AdminController] User filters:', JSON.stringify(filters, null, 2));

      const result = await UserService.getAllUsers(filters, { page, limit });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const user = await UserService.getUserById(userId);

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password, role, tagIds } = req.body;

      if (!req.user?.userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const createdBy = req.user.userId;

      // Validate required fields
      if (!name || !email || !password) {
        throw new CustomError('Name, email, and password are required', 400);
      }

      const userData = {
        name,
        email,
        password,
        role: role || 'user',
        status: 'active' as const, // Admin-created users are active by default
        emailVerified: true, // Admin-created users are verified by default
        createdBy, // Set the creator
      };

      let user = await UserService.createUser(userData);

      // 태그 설정
      if (tagIds && tagIds.length > 0) {
        await UserTagService.setUserTags(user.id, tagIds, req.user.userId);

        // 태그 설정 후 사용자 정보를 다시 로드하여 최신 태그 정보 포함
        user = await UserService.getUserById(user.id);
      }

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const { tagIds, ...updates } = req.body;

      if (!req.user?.userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const updatedBy = req.user.userId;

      let user = await UserService.updateUser(userId, updates);

      // 태그 설정 (tagIds가 제공된 경우에만)
      if (tagIds !== undefined) {
        await UserTagService.setUserTags(userId, tagIds, req.user.userId);

        // 태그 업데이트 후 사용자 정보를 다시 로드하여 최신 태그 정보 포함
        user = await UserService.getUserById(userId);
      }

      res.json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      // Prevent admin from deleting themselves
      if (req.user?.userId === userId) {
        throw new CustomError('Cannot delete your own account', 400);
      }

      await UserService.deleteUser(userId);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async activateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      await UserService.activateUser(userId);

      res.json({
        success: true,
        message: 'User activated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async suspendUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      // Prevent admin from suspending themselves
      if (req.user?.userId === userId) {
        throw new CustomError('Cannot suspend your own account', 400);
      }

      await UserService.suspendUser(userId);

      res.json({
        success: true,
        message: 'User suspended successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async promoteToAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      await UserService.promoteToAdmin(userId);

      res.json({
        success: true,
        message: 'User promoted to admin successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async demoteFromAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      // Prevent admin from demoting themselves
      if (req.user?.userId === userId) {
        throw new CustomError('Cannot demote your own account', 400);
      }

      await UserService.demoteFromAdmin(userId);

      res.json({
        success: true,
        message: 'User demoted from admin successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyUserEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      if (!userId || isNaN(userId)) {
        throw new CustomError('Invalid user ID', 400);
      }

      // 사용자 존재 확인
      const user = await db('g_users').where('id', userId).first();
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // 이미 인증된 경우 확인
      if (user.emailVerified) {
        throw new CustomError('Email is already verified', 400);
      }

      // 이메일 인증 상태 업데이트
      await db('g_users')
        .where('id', userId)
        .update({
          emailVerified: 1,
          emailVerifiedAt: new Date(),
          updatedAt: new Date()
        });

      // 캐시 클리어
      clearAllCache();

      res.json({
        success: true,
        message: 'User email verified successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Audit logs
  static async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.debug('getAuditLogs called:', {
        user: req.user,
        query: req.query,
        path: req.path
      });

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.query.userId ? parseInt(req.query.userId as string) :
        req.query.user_id ? parseInt(req.query.user_id as string) : undefined; // backward compatibility
      const ipAddress = req.query.ipAddress as string || req.query.ip_address as string; // backward compatibility

      // Handle action as single value or array
      const action = req.query.action;
      const actionValue = Array.isArray(action) ? action : (action ? [action as string] : undefined);
      const actionOperator = req.query.action_operator as 'any_of' | 'include_all' | undefined;

      // Handle resourceType as single value or array
      const resourceType = req.query.resourceType || req.query.resource_type; // backward compatibility
      const resourceTypeValue = Array.isArray(resourceType) ? resourceType : (resourceType ? [resourceType as string] : undefined);
      const resourceTypeOperator = req.query.resource_type_operator as 'any_of' | 'include_all' | undefined;

      // Keep as ISO string, don't convert to Date object
      const startDate = (req.query.startDate as string) || (req.query.start_date as string);
      const endDate = (req.query.endDate as string) || (req.query.end_date as string);

      const filters: any = {};
      if (userId) filters.userId = userId;
      if (req.query.user) filters.user = String(req.query.user);
      if (ipAddress) filters.ipAddress = ipAddress;
      if (actionValue && actionValue.length > 0) {
        filters.action = actionValue;
        if (actionOperator) filters.action_operator = actionOperator;
      }
      if (resourceTypeValue && resourceTypeValue.length > 0) {
        filters.resourceType = resourceTypeValue;
        if (resourceTypeOperator) filters.resource_type_operator = resourceTypeOperator;
      }
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      logger.info('[AdminController] Audit log query filters:', filters);

      logger.debug('Calling AuditLogModel.findAll with:', {
        page,
        limit,
        filters
      });

      const result = await AuditLogModel.findAll(page, limit, filters);

      logger.debug('AuditLogModel.findAll result:', {
        logsCount: result.logs?.length,
        total: result.total,
        page: result.page,
        limit: result.limit
      });

      // Normalize fields for frontend compatibility (ISO date + snake_case duplicates)
      const normalized = {
        ...result,
        logs: (result.logs || []).map((log: any) => {
          const created = log.createdAt ?? log.created_at;
          const date = created instanceof Date ? created : created ? new Date(created) : null;
          const iso = date && !isNaN(date.getTime()) ? date.toISOString() : null;

          const resourceType = log.entityType ?? log.resourceType ?? log.resource_type ?? null;
          const resourceId = log.entityId ?? log.resourceId ?? log.resource_id ?? null;
          const ipAddress = log.ipAddress ?? log.ip_address ?? null;
          const userAgent = log.userAgent ?? log.user_agent ?? null;

          // Create details object from oldValues and newValues
          const details: any = {};
          if (log.oldValues) {
            details.oldValues = log.oldValues;
          }
          if (log.newValues) {
            details.newValues = log.newValues;
          }

          return {
            ...log,
            // dates
            createdAt: iso || log.createdAt || log.created_at,
            created_at: iso || log.created_at || log.createdAt,
            // resource/type/id
            resourceType,
            resource_type: resourceType,
            resourceId,
            resource_id: resourceId,
            // network info
            ipAddress,
            ip_address: ipAddress,
            userAgent,
            user_agent: userAgent,
            // details for frontend
            details: Object.keys(details).length > 0 ? details : null,
          };
        })
      };

      res.json({
        success: true,
        data: normalized
      });
    } catch (error: any) {
      logger.error('Error in getAuditLogs:', {
        error: error?.message,
        stack: error?.stack,
        user: req.user,
        query: req.query
      });
      next(error);
    }
  }

  static async getAuditStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) :
        req.query.start_date ? new Date(req.query.start_date as string) : undefined; // backward compatibility
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) :
        req.query.end_date ? new Date(req.query.end_date as string) : undefined; // backward compatibility

      const stats = await AuditLogModel.getActionStats(startDate, endDate);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  // System management
  static async clearCache(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await clearAllCache();

      logger.info('Cache cleared by admin', {
        adminId: req.user?.userId,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async cleanupAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const daysToKeep = parseInt(req.body.days_to_keep) || 90;
      const deletedCount = await AuditLogModel.deleteOldLogs(daysToKeep);

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old audit logs`,
        data: { deletedCount, daysToKeep }
      });
    } catch (error) {
      next(error);
    }
  }

  // Pending user approvals
  static async getPendingUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pendingUsers = await UserService.getPendingUsers();

      res.json({
        success: true,
        data: pendingUsers
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      await UserService.activateUser(userId);

      res.json({
        success: true,
        message: 'User approved and activated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async rejectUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      await UserService.deleteUser(userId);

      res.json({
        success: true,
        message: 'User rejected and removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper methods
  private static async getAuditStatsData() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await AuditLogModel.getActionStats(thirtyDaysAgo);
      return {
        totalActions: stats.reduce((sum, stat) => sum + stat.count, 0),
        topActions: stats.slice(0, 5)
      };
    } catch (error) {
      logger.error('Error getting audit stats:', error);
      return {
        totalActions: 0,
        topActions: []
      };
    }
  }

  // Health check for debugging audit logs issues
  static async healthCheck(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const checks = {
        database: false,
        auditLogsTable: false,
        usersTable: false,
        sampleQuery: false
      };

      // Check database connection
      try {
        await db.raw('SELECT 1');
        checks.database = true;
      } catch (error: any) {
        logger.error('Database connection failed:', error);
      }

      // Check audit logs table
      try {
        await db('g_audit_logs').count('* as count').first();
        checks.auditLogsTable = true;
      } catch (error: any) {
        logger.error('Audit logs table check failed:', error);
      }

      // Check users table
      try {
        await db('g_users').count('* as count').first();
        checks.usersTable = true;
      } catch (error: any) {
        logger.error('Users table check failed:', error);
      }

      // Check sample audit logs query
      try {
        await db('g_audit_logs as al')
          .leftJoin('g_users as u', 'al.userId', 'u.id')
          .select([
            'al.*',
            'u.name as user_name',
            'u.email as user_email'
          ])
          .orderBy('al.createdAt', 'desc')
          .limit(1)
          .first();
        checks.sampleQuery = true;
      } catch (error: any) {
        logger.error('Sample query failed:', error);
      }

      res.json({
        success: true,
        data: {
          checks,
          allHealthy: Object.values(checks).every(check => check),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk operations for users
  static async bulkUpdateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userIds, status } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new CustomError('User IDs are required', 400);
      }

      if (!status || !['active', 'pending', 'suspended'].includes(status)) {
        throw new CustomError('Valid status is required', 400);
      }

      if (!req.user?.userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const currentUserId = req.user.userId;

      await db.transaction(async (trx) => {
        await trx('g_users')
          .whereIn('id', userIds)
          .update({
            status,
            updatedAt: new Date()
          });

        // Log audit entries
        for (const userId of userIds) {
          await AuditLogModel.create({
            userId: currentUserId,
            action: 'user_status_updated',
            resourceType: 'user',
            resourceId: userId.toString(),
            newValues: { status, bulkOperation: true },
            ipAddress: req.ip
          });
        }
      });

      clearAllCache();

      res.json({
        success: true,
        message: `Updated status for ${userIds.length} users`
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkUpdateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userIds, role } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new CustomError('User IDs are required', 400);
      }

      if (!role || !['user', 'admin'].includes(role)) {
        throw new CustomError('Valid role is required', 400);
      }

      if (!req.user?.userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const currentUserId = req.user.userId;

      await db.transaction(async (trx) => {
        await trx('g_users')
          .whereIn('id', userIds)
          .update({
            role,
            updatedAt: new Date()
          });

        // Log audit entries
        for (const userId of userIds) {
          await AuditLogModel.create({
            userId: currentUserId,
            action: 'user_role_updated',
            resourceType: 'user',
            resourceId: userId.toString(),
            newValues: { role, bulkOperation: true },
            ipAddress: req.ip
          });
        }
      });

      clearAllCache();

      res.json({
        success: true,
        message: `Updated role for ${userIds.length} users`
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkUpdateUserEmailVerified(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userIds, emailVerified } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new CustomError('User IDs are required', 400);
      }

      if (typeof emailVerified !== 'boolean') {
        throw new CustomError('Valid emailVerified boolean is required', 400);
      }

      if (!req.user?.userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const currentUserId = req.user.userId;

      await db.transaction(async (trx) => {
        await trx('g_users')
          .whereIn('id', userIds)
          .update({
            emailVerified,
            updatedAt: new Date()
          });

        // Log audit entries
        for (const userId of userIds) {
          await AuditLogModel.create({
            userId: currentUserId,
            action: 'user_email_verified_updated',
            resourceType: 'user',
            resourceId: userId.toString(),
            newValues: { emailVerified, bulkOperation: true },
            ipAddress: req.ip
          });
        }
      });

      clearAllCache();

      res.json({
        success: true,
        message: `Updated email verification for ${userIds.length} users`
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkUpdateUserTags(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userIds, tagIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new CustomError('User IDs are required', 400);
      }

      if (!tagIds || !Array.isArray(tagIds)) {
        throw new CustomError('Tag IDs array is required', 400);
      }

      if (!req.user?.userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const currentUserId = req.user.userId;

      await db.transaction(async (trx) => {
        // Remove existing tags for these users
        await trx('g_tag_assignments')
          .whereIn('userId', userIds)
          .del();

        // Add new tags
        if (tagIds.length > 0) {
          const assignments = userIds.flatMap(userId =>
            tagIds.map(tagId => ({
              userId,
              tagId,
              createdBy: currentUserId,
              createdAt: new Date()
            }))
          );

          await trx('g_tag_assignments').insert(assignments);
        }

        // Log audit entries
        for (const userId of userIds) {
          await AuditLogModel.create({
            userId: currentUserId,
            action: 'user_tags_updated',
            resourceType: 'user',
            resourceId: userId.toString(),
            newValues: { tagIds, bulkOperation: true },
            ipAddress: req.ip
          });
        }
      });

      clearAllCache();

      res.json({
        success: true,
        message: `Updated tags for ${userIds.length} users`
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkDeleteUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new CustomError('User IDs are required', 400);
      }

      if (!req.user?.userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const currentUserId = req.user.userId;

      // Prevent deleting current user
      if (userIds.includes(currentUserId)) {
        throw new CustomError('Cannot delete your own account', 400);
      }

      await db.transaction(async (trx) => {
        // Log audit entries before deletion
        for (const userId of userIds) {
          await AuditLogModel.create({
            userId: currentUserId,
            action: 'user_deleted',
            resourceType: 'user',
            resourceId: userId.toString(),
            newValues: { bulkOperation: true },
            ipAddress: req.ip
          });
        }

        // Delete tag assignments
        await trx('g_tag_assignments')
          .whereIn('userId', userIds)
          .del();

        // Delete users
        await trx('g_users')
          .whereIn('id', userIds)
          .del();
      });

      clearAllCache();

      res.json({
        success: true,
        message: `Deleted ${userIds.length} users`
      });
    } catch (error) {
      next(error);
    }
  }
}
