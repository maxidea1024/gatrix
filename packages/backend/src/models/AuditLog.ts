import database from '../config/database';
import logger from '../config/logger';
import { AuditLog, CreateAuditLogData } from '../types/user';

export class AuditLogModel {
  static async create(auditData: CreateAuditLogData): Promise<AuditLog> {
    try {
      const result = await database.query(
        `INSERT INTO g_audit_logs (userId, action, resourceType, resourceId, details, ipAddress, userAgent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          auditData.user_id || null,
          auditData.action,
          auditData.resource_type || null,
          auditData.resource_id || null,
          auditData.details ? JSON.stringify(auditData.details) : null,
          auditData.ip_address || null,
          auditData.user_agent || null,
        ]
      );

      const auditLog = await this.findById(result.insertId);
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
      const rows = await database.query(
        'SELECT * FROM g_audit_logs WHERE id = ?',
        [id]
      );
      
      const auditLog = rows[0];
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
      action?: string;
      resource_type?: string;
      start_date?: Date;
      end_date?: Date;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      const whereConditions: string[] = [];
      const whereValues: any[] = [];

      if (filters.user_id) {
        whereConditions.push('userId = ?');
        whereValues.push(filters.user_id);
      }

      if (filters.action) {
        whereConditions.push('action = ?');
        whereValues.push(filters.action);
      }

      if (filters.resource_type) {
        whereConditions.push('resourceType = ?');
        whereValues.push(filters.resource_type);
      }

      if (filters.start_date) {
        whereConditions.push('createdAt >= ?');
        whereValues.push(filters.start_date);
      }

      if (filters.end_date) {
        whereConditions.push('createdAt <= ?');
        whereValues.push(filters.end_date);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      logger.info('AuditLog query debug:', {
        whereConditions,
        whereValues,
        whereClause,
        limit,
        offset
      });

      // Get total count
      const countResult = await database.query(
        `SELECT COUNT(*) as total FROM g_audit_logs ${whereClause}`,
        whereValues
      );
      const total = countResult[0].total;

      // Get audit logs with user information
      // 매개변수를 직접 배열로 생성 (WHERE 조건이 없으므로 LIMIT, OFFSET만)
      const finalParams = [limit, offset];

      console.log('=== AUDIT LOG DEBUG ===');
      console.log('whereValues:', whereValues);
      console.log('whereValues type:', typeof whereValues);
      console.log('whereValues is array:', Array.isArray(whereValues));
      console.log('limit:', limit, 'type:', typeof limit);
      console.log('offset:', offset, 'type:', typeof offset);
      console.log('finalParams:', finalParams);
      console.log('finalParams is array:', Array.isArray(finalParams));
      console.log('========================');

      // MySQL LIMIT/OFFSET을 직접 문자열로 구성 (매개변수 바인딩 문제 회피)
      const logs = await database.query(
        `SELECT
           al.*,
           u.name as user_name,
           u.email as user_email
         FROM g_audit_logs al
         LEFT JOIN g_users u ON al.userId = u.id
         ${whereClause}
         ORDER BY al.createdAt DESC
         LIMIT ${limit} OFFSET ${offset}`,
        whereValues
      );

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
    } catch (error) {
      logger.error('Error finding all audit logs:', error);
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

      const result = await database.query(
        'DELETE FROM g_audit_logs WHERE createdAt < ?',
        [cutoffDate]
      );

      logger.info(`Deleted ${result.affectedRows} old audit logs older than ${daysToKeep} days`);
      return result.affectedRows;
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

      const stats = await database.query(
        `SELECT action, COUNT(*) as count
         FROM g_audit_logs
         ${whereClause}
         GROUP BY action
         ORDER BY count DESC`,
        whereValues
      );

      return stats;
    } catch (error) {
      logger.error('Error getting action stats:', error);
      throw error;
    }
  }
}
