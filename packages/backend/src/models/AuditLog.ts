import db from '../config/knex';
import logger from '../config/logger';
import { AuditLog, CreateAuditLogData } from '../types/user';

export class AuditLogModel {
  static async create(auditData: CreateAuditLogData): Promise<AuditLog> {
    try {
      const [insertId] = await db('g_audit_logs').insert({
        userId: auditData.userId || null,
        action: auditData.action,
        entityType: auditData.resourceType || null,
        entityId: auditData.resourceId || null,
        oldValues: auditData.oldValues ? JSON.stringify(auditData.oldValues) : null,
        newValues: auditData.newValues ? JSON.stringify(auditData.newValues) : null,
        ipAddress: auditData.ipAddress || null,
        userAgent: auditData.userAgent || null,
      });

      const auditLog = await this.findById(insertId);
      if (!auditLog) {
        throw new Error('Failed to create audit log');
      }

      // Trigger Integration Event
      // Use dynamic import to avoid circular dependency
      try {
        const { ALL_INTEGRATION_EVENTS } = await import('../types/integrationEvents');

        let eventType = auditData.action;
        let isValidEvent = ALL_INTEGRATION_EVENTS.includes(eventType as any);

        // Try mapping if not valid (e.g., _create -> _created, _update -> _updated)
        // Audit logs often use 'verb' (create), while Integration events use 'past tense' (created)
        if (!isValidEvent) {
          // Special mappings
          if (eventType === 'game_world_toggle_maintenance' && auditData.newValues) {
            // Handle boolean or 0/1 (though newValues should be boolean from middleware)
            const isActive = auditData.newValues.isMaintenance === true || auditData.newValues.isMaintenance === 1;
            eventType = isActive ? 'game_world_maintenance_on' : 'game_world_maintenance_off';
          } else if (eventType === 'game_world_toggle_visibility') {
            eventType = 'game_world_visibility_changed';
          } else {
            // Generic mappings
            if (eventType.endsWith('_create')) {
              eventType = eventType + 'd';
            } else if (eventType.endsWith('_update')) {
              eventType = eventType + 'd';
            } else if (eventType.endsWith('_delete')) {
              eventType = eventType + 'd';
            } else if (eventType.endsWith('_bulk_create')) {
              eventType = eventType + 'd';
            } else if (eventType.endsWith('_bulk_update')) {
              eventType = eventType + 'd';
            }
          }
          isValidEvent = ALL_INTEGRATION_EVENTS.includes(eventType as any);
        }

        if (isValidEvent) {
          const { IntegrationService } = await import('../services/IntegrationService');

          // Construct event data from newValues and other audit info
          const eventData: Record<string, any> = {
            ...(auditData.newValues || {}),
            resourceId: auditData.resourceId,
            resourceType: auditData.resourceType,
          };

          // Add oldValues if present
          if (auditData.oldValues) {
            eventData.oldValues = auditData.oldValues;
          }

          await IntegrationService.handleEvent({
            type: eventType as any,
            environment: auditData.environment,
            createdByUserId: auditData.userId,
            data: eventData,
            createdAt: new Date(),
          });
        }
      } catch (error) {
        logger.error('Failed to trigger integration event on audit log creation:', error);
        // Continue execution, do not fail audit log creation
      }

      return auditLog;
    } catch (error) {
      logger.error('Error creating audit log:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<AuditLog | null> {
    try {
      const auditLog = await db('g_audit_logs').where('id', id).first();

      if (auditLog) {
        // Parse oldValues if it exists and is a string
        if (auditLog.oldValues && typeof auditLog.oldValues === 'string') {
          try {
            auditLog.oldValues = JSON.parse(auditLog.oldValues);
          } catch (e) {
            // If JSON parsing fails, keep as string
          }
        }

        // Parse newValues if it exists and is a string
        if (auditLog.newValues && typeof auditLog.newValues === 'string') {
          try {
            auditLog.newValues = JSON.parse(auditLog.newValues);
          } catch (e) {
            // If JSON parsing fails, keep as string
          }
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
      userId?: number;
      user?: string; // search by email or name
      ipAddress?: string;
      action?: string | string[];
      action_operator?: 'any_of' | 'include_all';
      resourceType?: string | string[];
      resource_type_operator?: 'any_of' | 'include_all';
      startDate?: Date;
      endDate?: Date;
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
      const baseQuery = () =>
        db('g_audit_logs as al').leftJoin('g_users as u', 'al.userId', 'u.id');

      // Apply filters function
      const applyFilters = (query: any) => {
        if (filters.userId) {
          query.where('al.userId', filters.userId);
        }

        if (filters.ipAddress) {
          query.where('al.ipAddress', 'like', `%${filters.ipAddress}%`);
        }

        // Handle action filter (single or multiple)
        if (filters.action) {
          if (Array.isArray(filters.action)) {
            const operator = filters.action_operator || 'any_of';
            if (operator === 'include_all') {
              // Include all: must match all actions (using AND)
              // This is tricky for a single field - we'll use whereIn for now
              // as "include all" doesn't make much sense for a single action field
              query.whereIn('al.action', filters.action);
            } else {
              // Any of: match any action (using OR)
              query.whereIn('al.action', filters.action);
            }
          } else {
            query.where('al.action', filters.action);
          }
        }

        // Handle resourceType filter (single or multiple)
        if (filters.resourceType) {
          if (Array.isArray(filters.resourceType)) {
            const operator = filters.resource_type_operator || 'any_of';
            if (operator === 'include_all') {
              // Include all: must match all resource types
              query.whereIn('al.entityType', filters.resourceType);
            } else {
              // Any of: match any resource type
              query.whereIn('al.entityType', filters.resourceType);
            }
          } else {
            query.where('al.entityType', filters.resourceType);
          }
        }

        if (filters.user) {
          query.where(function (this: any) {
            this.where('u.email', 'like', `%${filters.user}%`).orWhere(
              'u.name',
              'like',
              `%${filters.user}%`
            );
          });
        }

        if (filters.startDate) {
          query.where('al.createdAt', '>=', filters.startDate);
        }

        if (filters.endDate) {
          query.where('al.createdAt', '<=', filters.endDate);
        }

        return query;
      };

      // Get total count
      const countQuery = applyFilters(baseQuery()).count('al.id as total').first();

      // Get audit logs with user information
      const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 1000);
      const safeOffset = Math.max(Number(offset) || 0, 0);

      const logsQuery = applyFilters(baseQuery())
        .select(['al.*', 'u.name as user_name', 'u.email as user_email'])
        .orderBy('al.createdAt', 'desc')
        .limit(safeLimit)
        .offset(safeOffset);

      // Log the actual SQL query for debugging
      logger.info('[AuditLog] Query filters:', filters);
      logger.info('[AuditLog] SQL Query:', logsQuery.toSQL().toNative());

      // Execute queries in parallel
      const [countResult, logs] = await Promise.all([countQuery, logsQuery]);

      logger.info('[AuditLog] Query results:', {
        count: countResult?.total || 0,
        logsReturned: logs?.length || 0,
      });

      const total = countResult?.total || 0;

      // Parse JSON fields
      logs.forEach((log: any) => {
        // Parse oldValues if it exists and is a string
        if (log.oldValues && typeof log.oldValues === 'string') {
          try {
            log.oldValues = JSON.parse(log.oldValues);
          } catch (e) {
            // If JSON parsing fails, keep as string
          }
        }

        // Parse newValues if it exists and is a string
        if (log.newValues && typeof log.newValues === 'string') {
          try {
            log.newValues = JSON.parse(log.newValues);
          } catch (e) {
            // If JSON parsing fails, keep as string
          }
        }
      });

      return {
        logs,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('Error finding all audit logs:', {
        error: error.message,
        code: error.code,
        sqlState: error.sqlState,
        stack: error.stack,
        filters,
        page,
        limit,
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
    return this.findAll(page, limit, { userId: userId });
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
    return this.findAll(page, limit, { resourceType: resourceType });
  }

  static async deleteOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db('g_audit_logs').where('createdAt', '<', cutoffDate).del();

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

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

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
