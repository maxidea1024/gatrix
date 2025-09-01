import db from '../config/knex';
import logger from '../config/logger';
import { AuditLog, CreateAuditLogData } from '../types/user';

export class AuditLogModel {
  static async create(auditData: CreateAuditLogData): Promise<AuditLog> {
    try {
      const [insertId] = await db('g_audit_logs').insert({
        userId: auditData.user_id || null,
        action: auditData.action,
        resourceType: auditData.resource_type || null,
        resourceId: auditData.resource_id || null,
        details: auditData.details ? JSON.stringify(auditData.details) : null,
        ipAddress: auditData.ip_address || null,
        userAgent: auditData.user_agent || null,
      });

      const auditLog = await this.findById(insertId);
      if (!auditLog) {
        throw new Error('Failed to create audit log');
      }

      return auditLog;
    } catch (error) {
      logger.error('Error creating audit log:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<AuditLog | null> {
    try {
      const auditLog = await db('g_audit_logs')
        .where('id', id)
        .first();

      if (auditLog && auditLog.details) {
        try {
          auditLog.details = JSON.parse(auditLog.details);
        } catch (e) {
          // If JSON parsing fails, keep as string
        }
      }

      return auditLog || null;
    } catch (error) {
      logger.error('Error finding audit log by ID:', error);
      throw error;
    }
  }

  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: {
      user_id?: number;
      user?: string; // search by email or name
      ip_address?: string;
      action?: string;
      resource_type?: string;
      start_date?: Date;
      end_date?: Date;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    try {
      // Check if table exists first
      try {
        await db('g_audit_logs').select(1).limit(1);
      } catch (error: any) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          logger.error('g_audit_logs table does not exist. Please run migrations.');
          throw new Error('Audit logs table not found. Please run database migrations.');
        }
        throw error;
      }

      const offset = (page - 1) * limit;

      // Build base query
      const baseQuery = () => db('g_audit_logs as al')
        .leftJoin('g_users as u', 'al.userId', 'u.id');

      // Apply filters function
      const applyFilters = (query: any) => {
        if (filters.user_id) {
          query.where('al.userId', filters.user_id);
        }

        if (filters.ip_address) {
          query.where('al.ipAddress', 'like', `%${filters.ip_address}%`);
        }

        if (filters.action) {
          query.where('al.action', filters.action);
        }

        if (filters.resource_type) {
          query.where('al.resourceType', filters.resource_type);
        }

        if (filters.user) {
          query.where(function(this: any) {
            this.where('u.email', 'like', `%${filters.user}%`)
                .orWhere('u.name', 'like', `%${filters.user}%`);
          });
        }

        if (filters.start_date) {
          query.where('al.createdAt', '>=', filters.start_date);
        }

        if (filters.end_date) {
          query.where('al.createdAt', '<=', filters.end_date);
        }

        return query;
      };

      logger.debug('AuditLog findAll query details:', {
        filters,
        limit,
        offset,
        page
      });

      // Get total count
      const countQuery = applyFilters(baseQuery())
        .count('al.id as total')
        .first();

      // Get audit logs with user information
      const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 1000);
      const safeOffset = Math.max(Number(offset) || 0, 0);

      const logsQuery = applyFilters(baseQuery())
        .select([
          'al.*',
          'u.name as user_name',
          'u.email as user_email'
        ])
        .orderBy('al.createdAt', 'desc')
        .limit(safeLimit)
        .offset(safeOffset);

      logger.debug('Executing queries...');

      // Execute queries in parallel
      const [countResult, logs] = await Promise.all([
        countQuery,
        logsQuery
      ]);

      const total = countResult?.total || 0;

      logger.debug('Query result:', { logsCount: logs.length, total });

      // Parse JSON details
      logs.forEach((log: any) => {
        if (log.details) {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            // If JSON parsing fails, keep as string
          }
        }
      });

      return {
        logs,
        total,
        page,
        limit
      };
    } catch (error: any) {
      logger.error('Error finding all audit logs:', {
        error: error.message,
        code: error.code,
        sqlState: error.sqlState,
        stack: error.stack,
        filters,
        page,
        limit
      });

      // Provide more specific error messages
      if (error.code === 'ER_NO_SUCH_TABLE') {
        throw new Error('Audit logs table not found. Please run database migrations.');
      } else if (error.code === 'ER_BAD_FIELD_ERROR') {
        throw new Error('Database schema mismatch. Please check audit logs table structure.');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Database connection failed. Please check database server.');
      }

      throw error;
    }
  }

  static async findByUserId(
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    return this.findAll(page, limit, { user_id: userId });
  }

  static async findByAction(
    action: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    return this.findAll(page, limit, { action });
  }

  static async findByResourceType(
    resourceType: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    return this.findAll(page, limit, { resource_type: resourceType });
  }

  static async deleteOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db('g_audit_logs')
        .where('createdAt', '<', cutoffDate)
        .del();

      logger.info(`Deleted ${result} old audit logs older than ${daysToKeep} days`);
      return result;
    } catch (error) {
      logger.error('Error deleting old audit logs:', error);
      throw error;
    }
  }

  static async getActionStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ action: string; count: number }[]> {
    try {
      const whereConditions: string[] = [];
      const whereValues: any[] = [];

      if (startDate) {
        whereConditions.push('createdAt >= ?');
        whereValues.push(startDate);
      }

      if (endDate) {
        whereConditions.push('createdAt <= ?');
        whereValues.push(endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = db('g_audit_logs')
        .select('action')
        .count('* as count')
        .groupBy('action')
        .orderBy('count', 'desc');

      if (startDate) {
        query.where('createdAt', '>=', startDate);
      }
      if (endDate) {
        query.where('createdAt', '<=', endDate);
      }

      const stats = await query;

      return stats as { action: string; count: number }[];
    } catch (error) {
      logger.error('Error getting action stats:', error);
      throw error;
    }
  }
}
