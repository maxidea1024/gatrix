import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserService } from '../services/userService';
import { AuditLogModel } from '../models/AuditLog';
import { CustomError } from '../middleware/errorHandler';
import { clearAllCache } from '../middleware/responseCache';
import logger from '../config/logger';

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
      const role = req.query.role as string;
      const status = req.query.status as string;
      const search = req.query.search as string;

      const filters: any = {};
      if (role) filters.role = role;
      if (status) filters.status = status;
      if (search) filters.search = search;

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
      const { name, email, password, role } = req.body;

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
      };

      const user = await UserService.createUser(userData);

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
      const updates = req.body;

      const user = await UserService.updateUser(userId, updates);

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

  // Audit logs
  static async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.query.user_id ? parseInt(req.query.user_id as string) : undefined;
      const action = req.query.action as string;
      const resourceType = req.query.resource_type as string;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

      const filters: any = {};
      if (userId) filters.user_id = userId;
      if (action) filters.action = action;
      if (resourceType) filters.resource_type = resourceType;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const result = await AuditLogModel.findAll(page, limit, filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

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
}
