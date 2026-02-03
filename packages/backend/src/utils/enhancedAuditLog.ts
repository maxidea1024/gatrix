import { Response, NextFunction } from 'express';
import { AuditLogModel } from '../models/AuditLog';
import { AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../config/logger';
import db from '../config/knex';

const logger = createLogger('EnhancedAuditLog');

export interface EnhancedAuditLogOptions {
  action: string;
  resourceType?: string;
  getResourceId?: (req: any) => string | number | undefined;
  getResourceIdFromResponse?: (responseBody: any) => string | number | undefined;
  // Enhanced: Fetch old values from database before the operation
  fetchOldValues?: (req: any) => Promise<any>;
  // Enhanced: Get new values with more context
  getNewValues?: (req: any, res: any, oldValues?: any) => any;
  // Enhanced: Get additional context information
  getContext?: (req: any, oldValues?: any, newValues?: any) => any;
  skipIf?: (req: any, res: any) => boolean;
}

/**
 * Enhanced audit log middleware that captures detailed before/after state
 * Follows 육하원칙 (5W1H): Who, What, When, Where, Why, How
 */
export const enhancedAuditLog = (options: EnhancedAuditLogOptions) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Capture old values BEFORE the operation
    let oldValues: any = undefined;
    let captureError: any = undefined;

    try {
      if (options.fetchOldValues) {
        oldValues = await options.fetchOldValues(req);
      }
    } catch (error) {
      logger.error('Failed to fetch old values for audit log:', error);
      captureError = error;
      // Continue with the request even if old values fetch fails
    }

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

        // Get new values with context
        const newValues = options.getNewValues
          ? options.getNewValues(req, res, oldValues)
          : req.body;

        // Get additional context
        const context = options.getContext
          ? options.getContext(req, oldValues, newValues)
          : undefined;

        // Merge context into newValues if provided
        const finalNewValues = context ? { ...newValues, _context: context } : newValues;

        await AuditLogModel.create({
          userId: req.user?.userId,
          action: options.action,
          resourceType: options.resourceType,
          resourceId: resourceId ? resourceId.toString() : undefined,
          oldValues: oldValues,
          newValues: finalNewValues,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        if (captureError) {
          logger.warn('Audit log created but old values capture failed:', {
            action: options.action,
            resourceId,
            error: captureError.message,
          });
        }
      } catch (error) {
        // Don't fail the request if audit logging fails
        logger.error('Failed to create enhanced audit log:', error);
      }
    });

    next();
  };
};

/**
 * Helper function to fetch game world details by ID
 */
export async function fetchGameWorldById(id: number | string): Promise<any> {
  const world = await db('g_game_worlds').where('id', id).first();

  if (!world) {
    return null;
  }

  return {
    id: world.id,
    worldId: world.worldId,
    name: world.name,
    isVisible: world.isVisible,
    isMaintenance: world.isMaintenance,
    displayOrder: world.displayOrder,
    description: world.description,
    maintenanceMessage: world.maintenanceMessage,
    maintenanceStartDate: world.maintenanceStartDate,
    maintenanceEndDate: world.maintenanceEndDate,
  };
}

/**
 * Helper function to fetch user details by ID
 */
export async function fetchUserById(id: number | string): Promise<any> {
  const user = await db('g_users')
    .select('id', 'name', 'email', 'role', 'status', 'emailVerified')
    .where('id', id)
    .first();

  return user || null;
}

/**
 * Helper function to fetch invitation details by ID
 */
export async function fetchInvitationById(id: string): Promise<any> {
  const invitation = await db('g_invitations').where('id', id).first();

  if (!invitation) {
    return null;
  }

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    isActive: invitation.isActive,
    expiresAt: invitation.expiresAt,
    createdBy: invitation.createdBy,
    usedAt: invitation.usedAt,
    usedBy: invitation.usedBy,
  };
}

/**
 * Helper function to fetch API token details by ID
 */
export async function fetchApiTokenById(id: number | string): Promise<any> {
  const token = await db('g_api_access_tokens').where('id', id).first();

  if (!token) {
    return null;
  }

  return {
    id: token.id,
    tokenName: token.tokenName,
    tokenType: token.tokenType,
    description: token.description,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    usageCount: token.usageCount,
    createdBy: token.createdBy,
  };
}

/**
 * Helper function to fetch multiple records by IDs
 */
export async function fetchRecordsByIds(
  table: string,
  ids: (number | string)[],
  selectFields?: string[]
): Promise<any[]> {
  const query = db(table).whereIn('id', ids);

  if (selectFields && selectFields.length > 0) {
    query.select(selectFields);
  }

  return await query;
}

/**
 * Create context object with request metadata
 */
export function createAuditContext(req: AuthenticatedRequest, additionalInfo?: any): any {
  return {
    timestamp: new Date().toISOString(),
    userId: req.user?.userId,
    userName: (req.user as any)?.name,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    ...additionalInfo,
  };
}
