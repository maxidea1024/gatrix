import { Environment } from '../models/environment';
import { ChangeRequest } from '../models/change-request';
import { ChangeRequestService } from './change-request-service';
import { permissionService } from './permission-service';
import { P } from '../types/permissions';
import { createLogger } from '../config/logger';
import { requestContext } from '../middleware/request-context';

const logger = createLogger('UnifiedChangeGateway');
import knex from '../config/knex';
import { ErrorCodes } from '@gatrix/shared';
import { GatrixError } from '../middleware/error-handler';

export type ChangeOperationType = 'create' | 'update' | 'delete';

export interface ChangeGatewayResult {
  status: 'APPLIED_IMMEDIATELY' | 'DRAFT_SAVED' | 'ITEM_LOCKED';
  mode: 'DIRECT' | 'CHANGE_REQUEST';
  data?: any; // Result data for direct operations
  changeRequestId?: string;
  error?: any;
}

export class UnifiedChangeGateway {
  /**
   * Helper to check if skipCr was requested either via options or HTTP request payload
   */
  static isSkipCrRequested(options?: { skipCr?: boolean }): boolean {
    if (options?.skipCr) return true;
    const req = requestContext.getStore();
    if (!req) return false;
    return req.query.skipCr === 'true' || req.body?.skipCr === true;
  }

  /**
   * Check if user has a specific permission in the given environment
   */
  private static async hasEnvPermission(
    userId: string,
    environmentId: string,
    perm: string
  ): Promise<boolean> {
    const chain = await permissionService.resolveEnvironmentChain(environmentId);
    if (!chain) return false;
    return permissionService.hasEnvPermission(
      userId,
      chain.orgId,
      chain.projectId,
      environmentId,
      perm
    );
  }

  /**
   * For project-scoped resources (segments, flag types, etc.),
   * find the first environment in the project that has requiresApproval=true.
   * Returns the environment ID or null if none require approval.
   */
  static async getProjectCrEnvironment(
    projectId: string
  ): Promise<string | null> {
    const env = await knex('g_environments')
      .where({ projectId, requiresApproval: true })
      .select('id')
      .first();
    return env?.id || null;
  }

  /**
   * Request a modification (update) through the Change Request system
   */
  static async requestModification(
    userId: string,
    environmentId: string,
    targetTable: string,
    targetId: string,
    newData: any,
    options?: { skipCr?: boolean; primaryKey?: string }
  ): Promise<ChangeGatewayResult> {
    return this.processChange(
      userId,
      environmentId,
      targetTable,
      targetId,
      newData,
      undefined,
      options
    );
  }

  /**
   * Request a creation through the Change Request system
   */
  static async requestCreation(
    userId: string,
    environmentId: string,
    targetTable: string,
    createData: any,
    createFunction: () => Promise<any>,
    options?: { skipCr?: boolean }
  ): Promise<ChangeGatewayResult> {
    try {
      // 1. Fetch Environment Policy
      const env = await Environment.query().findById(environmentId);
      if (!env) {
        throw new Error(`Environment '${environmentId}' not found.`);
      }

      let requiresApproval = env.requiresApproval;
      if (requiresApproval && this.isSkipCrRequested(options)) {
        const hasSkipPermission = await this.hasEnvPermission(userId, environmentId, P.CHANGE_REQUESTS_SKIP);
        if (hasSkipPermission) {
          requiresApproval = false;
        } else {
          throw new GatrixError('You do not have permission to skip change requests.', 403, true, 'FORBIDDEN');
        }
      }

      // 2. Check if CR is required
      if (!requiresApproval) {
        // Direct creation
        const result = await createFunction();
        return {
          status: 'APPLIED_IMMEDIATELY',
          mode: 'DIRECT',
          data: result,
        };
      }

      // 3. CR Required - Create a change request for the new item
      const existingDraft = await ChangeRequest.query()
        .where('requesterId', userId)
        .where('environmentId', environmentId)
        .where('status', 'draft')
        .orderBy('updatedAt', 'desc')
        .first();

      const result = await ChangeRequestService.upsertChangeRequestItem(
        userId,
        environmentId,
        targetTable,
        `NEW_${Date.now()}`, // Temporary ID for new items
        null, // beforeData is null for creation (record doesn't exist yet)
        createData,
        existingDraft?.id
      );

      return {
        status: 'DRAFT_SAVED',
        changeRequestId: result.changeRequestId,
        mode: 'CHANGE_REQUEST',
      };
    } catch (error) {
      logger.error('requestCreation error:', error);
      throw error;
    }
  }

  /**
   * Request a deletion through the Change Request system
   */
  static async requestDeletion(
    userId: string,
    environmentId: string,
    targetTable: string,
    targetId: string,
    deleteFunction: () => Promise<void>,
    options?: { skipCr?: boolean; primaryKey?: string }
  ): Promise<ChangeGatewayResult> {
    try {
      // 1. Fetch Environment Policy
      const env = await Environment.query().findById(environmentId);
      if (!env) {
        throw new Error(`Environment '${environmentId}' not found.`);
      }

      let requiresApproval = env.requiresApproval;
      if (requiresApproval && this.isSkipCrRequested(options)) {
        const hasSkipPermission = await this.hasEnvPermission(userId, environmentId, P.CHANGE_REQUESTS_SKIP);
        if (hasSkipPermission) {
          requiresApproval = false;
        } else {
          throw new GatrixError('You do not have permission to skip change requests.', 403, true, 'FORBIDDEN');
        }
      }

      // 2. Check for pending CR locks
      const pendingRequest = await ChangeRequest.query()
        .alias('cr')
        .join('g_change_items as ci', 'cr.id', 'ci.changeRequestId')
        .where('ci.targetTable', targetTable)
        .where('ci.targetId', targetId)
        .whereIn('cr.status', ['open', 'approved'])
        .select('cr.id', 'cr.title', 'cr.requesterId')
        .first();

      if (pendingRequest) {
        const conflictInfo = {
          lockedBy: pendingRequest.requesterId,
          changeRequestId: pendingRequest.id,
          changeRequestTitle: pendingRequest.title,
        };

        throw new GatrixError(
          `This item is currently locked by active Change Request: ${pendingRequest.title}`,
          409, // Conflict
          true,
          ErrorCodes.RESOURCE_LOCKED,
          conflictInfo
        );
      }

      // 3. Check if CR is required
      if (!requiresApproval) {
        // Direct deletion
        await deleteFunction();
        return {
          status: 'APPLIED_IMMEDIATELY',
          mode: 'DIRECT',
        };
      }

      // 4. CR Required - Get current data and create deletion request
      const pk = options?.primaryKey || 'id';
      const currentData = await knex(targetTable).where(pk, targetId).first();
      if (!currentData) {
        throw new Error(`Item ${targetId} not found in ${targetTable}`);
      }

      const existingDraft = await ChangeRequest.query()
        .where('requesterId', userId)
        .where('environmentId', environmentId)
        .where('status', 'draft')
        .orderBy('updatedAt', 'desc')
        .first();

      const result = await ChangeRequestService.upsertChangeRequestItem(
        userId,
        environmentId,
        targetTable,
        targetId,
        currentData, // beforeData
        null, // afterData is null for deletion (determineOpType will recognize as DELETE)
        existingDraft?.id
      );

      return {
        status: 'DRAFT_SAVED',
        changeRequestId: result.changeRequestId,
        mode: 'CHANGE_REQUEST',
      };
    } catch (error) {
      logger.error('requestDeletion error:', error);
      throw error;
    }
  }

  /**
   * Internal method to process update changes
   */
  public static async processChange(
    userId: string,
    environmentId: string,
    targetTable: string,
    targetId: string,
    changeDataOrFunction: any | ((currentData: any) => Promise<any> | any),
    directChangeFunction?: (processedData: any) => Promise<any>,
    options?: { skipCr?: boolean; primaryKey?: string }
  ): Promise<ChangeGatewayResult> {
    try {
      // 1. Fetch Env Policy
      const env = await Environment.query().findById(environmentId);
      if (!env) {
        throw new Error(`Environment '${environmentId}' not found.`);
      }

      let requiresApproval = env.requiresApproval;
      if (requiresApproval && this.isSkipCrRequested(options)) {
        const hasSkipPermission = await this.hasEnvPermission(userId, environmentId, P.CHANGE_REQUESTS_SKIP);
        if (hasSkipPermission) {
          requiresApproval = false;
        } else {
          throw new GatrixError('You do not have permission to skip change requests.', 403, true, 'FORBIDDEN');
        }
      }

      // 2. Global Lock Check
      const pendingRequest = await ChangeRequest.query()
        .alias('cr')
        .join('g_change_items as ci', 'cr.id', 'ci.changeRequestId')
        .where('ci.targetTable', targetTable)
        .where('ci.targetId', targetId)
        .whereIn('cr.status', ['open', 'approved'])
        .select('cr.id', 'cr.title', 'cr.requesterId')
        .first();

      if (pendingRequest) {
        const conflictInfo = {
          lockedBy: pendingRequest.requesterId,
          changeRequestId: pendingRequest.id,
          changeRequestTitle: pendingRequest.title,
        };

        throw new GatrixError(
          `This item is currently locked by active Change Request: ${pendingRequest.title}`,
          409, // Conflict
          true,
          ErrorCodes.RESOURCE_LOCKED,
          conflictInfo
        );
      }

      // 3. Resolve New Data
      const pk = options?.primaryKey || 'id';
      const currentData = await knex(targetTable).where(pk, targetId).first();
      let newData;
      if (typeof changeDataOrFunction === 'function') {
        newData = await changeDataOrFunction(currentData);
      } else {
        newData = changeDataOrFunction;
      }

      // 4. Branching Logic
      // CASE A: Direct Update
      if (!requiresApproval) {
        if (!/^[a-zA-Z0-9_]+$/.test(targetTable))
          throw new Error('Invalid table name');

        let result;
        if (directChangeFunction) {
          result = await directChangeFunction(newData);
        } else {
          await knex(targetTable).where(pk, targetId).update(newData);
          result = { id: targetId, ...newData };
        }

        return {
          status: 'APPLIED_IMMEDIATELY',
          mode: 'DIRECT',
          data: result,
        };
      }

      // CASE B: Change Request Required
      const existingDraft = await ChangeRequest.query()
        .where('requesterId', userId)
        .where('environmentId', environmentId)
        .where('status', 'draft')
        .orderBy('updatedAt', 'desc')
        .first();

      const result = await ChangeRequestService.upsertChangeRequestItem(
        userId,
        environmentId,
        targetTable,
        targetId,
        currentData || {}, // Before
        newData, // After
        existingDraft?.id
      );

      return {
        status: 'DRAFT_SAVED',
        changeRequestId: result.changeRequestId,
        mode: 'CHANGE_REQUEST',
      };
    } catch (error) {
      logger.error('processChange error:', error);
      throw error;
    }
  }

  /**
   * Check if an environment requires CR approval
   */
  static async requiresApproval(environmentId: string): Promise<boolean> {
    const env = await Environment.query().findById(environmentId);
    return env?.requiresApproval ?? false;
  }

  /**
   * Get environment CR settings
   */
  static async getEnvironmentSettings(
    environmentId: string
  ): Promise<{ requiresApproval: boolean; requiredApprovers: number } | null> {
    const env = await Environment.query().findById(environmentId);
    if (!env) return null;
    return {
      requiresApproval: env.requiresApproval,
      requiredApprovers: env.requiredApprovers,
    };
  }
}
