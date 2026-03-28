import { transaction } from 'objection';
import { ulid } from 'ulid';
import { ChangeRequest, ChangeRequestStatus } from '../models/change-request';
import { ChangeItem, FieldOp, EntityOpType } from '../models/change-item';
import { Approval } from '../models/approval';
import { Environment } from '../models/environment';
import { User } from '../models/user';
import {
  ActionGroup,
  ACTION_GROUP_TYPES,
  ActionGroupType,
} from '../models/action-group';
import knex from '../config/knex';
import { ChangeRequestNotifications } from './sse-notification-service';
import { GatrixError } from '../middleware/error-handler';
import { ErrorCodes } from '@gatrix/shared';
import { diff } from 'deep-diff';
import { OutboxService } from './outbox-service';
import { permissionService } from './permission-service';
import { P } from '../types/permissions';

import { createLogger } from '../config/logger';
import { resolveEntityLabel } from '../utils/entity-label-resolver';
const logger = createLogger('ChangeRequest');

/**
 * Tables that use a non-standard primary key (not 'id').
 * Used during CR execution to query the correct column.
 */
const TABLE_PRIMARY_KEY_MAP: Record<string, string> = {
  g_feature_flag_types: 'flagType',
};

/** Resolve the primary key column name for a given table */
function getPrimaryKey(table: string): string {
  return TABLE_PRIMARY_KEY_MAP[table] || 'id';
}

/**
 * Generate ops from beforeData and afterData
 */
function generateOps(
  beforeData: Record<string, any> | null,
  afterData: Record<string, any> | null
): FieldOp[] {
  const ops: FieldOp[] = [];
  const before = beforeData || {};
  const after = afterData || {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  // Skip internal fields
  const skipFields = [
    'createdAt',
    'updatedAt',
    'createdBy',
    'updatedBy',
    'version',
  ];

  // Normalize value for comparison
  // Handles: MySQL TINYINT boolean, nullable field mismatches,
  // null/undefined/''/[]/false/0 equivalences
  const isEmptyValue = (val: any): boolean => {
    if (val === null || val === undefined || val === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  };

  const normalizeValue = (val: any): any => {
    if (isEmptyValue(val)) return null;
    if (val === true) return 1;
    if (val === false) return 0;
    return val;
  };

  allKeys.forEach((key) => {
    if (skipFields.includes(key)) return;

    const oldVal = before[key];
    const newVal = after[key];

    // Normalize values for comparison
    const normalizedOld = normalizeValue(oldVal);
    const normalizedNew = normalizeValue(newVal);

    // Only include if values differ (using normalized comparison)
    if (JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNew)) {
      let opType: 'SET' | 'DEL' | 'MOD' = 'MOD';
      if (oldVal === undefined || oldVal === null) {
        opType = 'SET';
      } else if (newVal === undefined || newVal === null) {
        opType = 'DEL';
      }
      // Store original values in ops for display (not normalized)
      ops.push({
        path: key,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
        opType,
      });
    }
  });

  return ops;
}

/**
 * Determine entity operation type from beforeData and afterData
 */
function determineOpType(
  beforeData: Record<string, any> | null,
  afterData: Record<string, any> | null
): EntityOpType {
  const isBeforeEmpty = !beforeData || Object.keys(beforeData).length === 0;
  const isAfterEmpty = !afterData || Object.keys(afterData).length === 0;

  if (isBeforeEmpty && !isAfterEmpty) return 'CREATE';
  if (!isBeforeEmpty && isAfterEmpty) return 'DELETE';
  return 'UPDATE';
}

/**
 * Apply ops to base data to get the final data
 * For CREATE: base is empty, apply all SET ops
 * For UPDATE: base is current data, apply ops
 * For DELETE: returns null
 */
function applyOpsToData(
  baseData: Record<string, any> | null,
  ops: FieldOp[],
  opType: EntityOpType
): Record<string, any> | null {
  if (opType === 'DELETE') {
    return null; // Delete operation
  }

  const result = { ...(baseData || {}) };

  for (const op of ops) {
    if (op.opType === 'DEL') {
      delete result[op.path];
    } else {
      result[op.path] = op.newValue;
    }
  }

  return result;
}

/**
 * Generate inverse ops for revert
 * SET -> DEL (or SET with old value if it existed)
 * DEL -> SET
 * MOD -> MOD (swap old/new)
 */
function generateInverseOps(ops: FieldOp[]): FieldOp[] {
  return ops.map((op) => {
    if (op.opType === 'SET') {
      // Was added, so remove it (or restore old if there was one)
      return {
        path: op.path,
        oldValue: op.newValue,
        newValue: op.oldValue,
        opType: op.oldValue === null ? 'DEL' : 'MOD',
      };
    } else if (op.opType === 'DEL') {
      // Was removed, so add it back
      return {
        path: op.path,
        oldValue: op.newValue, // was null
        newValue: op.oldValue, // restore
        opType: 'SET',
      };
    } else {
      // MOD: just swap
      return {
        path: op.path,
        oldValue: op.newValue,
        newValue: op.oldValue,
        opType: 'MOD',
      };
    }
  });
}

/**
 * Determine inverse operation type for revert
 */
function getInverseOpType(opType: EntityOpType): EntityOpType {
  if (opType === 'CREATE') return 'DELETE';
  if (opType === 'DELETE') return 'CREATE';
  return 'UPDATE';
}

export class ChangeRequestService {
  /**
   * Upsert a Draft Change Request or Add Item to Existing Draft
   * Now uses ops-based model
   */
  static async upsertChangeRequestItem(
    userId: string,
    environmentId: string,
    targetTable: string,
    targetId: string,
    beforeData: Record<string, any> | null,
    afterData: Record<string, any> | null,
    changeRequestId?: string
  ): Promise<{ changeRequestId: string; status: ChangeRequestStatus }> {
    try {
      let cr: ChangeRequest | undefined;

      // Phase 3: Check if user has a pending review request (open status)
      // Block new edits when review is pending
      const pendingReview = await ChangeRequest.query()
        .where('requesterId', userId)
        .where('environmentId', environmentId)
        .where('status', 'open')
        .first();

      if (pendingReview) {
        throw new GatrixError(
          'You have a pending review request. Withdraw it or wait for approval/rejection before making new changes.',
          409,
          true,
          'PENDING_REVIEW_EXISTS'
        );
      }

      // 1. If ID provided, verify it exists and is in DRAFT
      if (changeRequestId) {
        cr = await ChangeRequest.query()
          .findById(changeRequestId)
          .where('status', 'draft');

        if (!cr) {
          throw new Error('Change Request not found or not in DRAFT status.');
        }

        // Verify the CR belongs to this user
        if (cr.requesterId !== userId) {
          throw new GatrixError(
            "You cannot modify another user's draft.",
            403,
            true,
            'NOT_DRAFT_OWNER'
          );
        }
      } else {
        // Phase 2: Check if user already has a draft - enforce single draft rule
        const existingDraft = await ChangeRequest.query()
          .where('requesterId', userId)
          .where('environmentId', environmentId)
          .where('status', 'draft')
          .first();

        if (existingDraft) {
          // Use existing draft instead of creating a new one
          cr = existingDraft;
        } else {
          // Draft is a personal edit buffer - use simple timestamp title
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');

          cr = await ChangeRequest.query().insert({
            id: ulid(),
            requesterId: userId,
            environmentId: environmentId,
            status: 'draft',
            title: `Draft-${hh}${mm}`,
          });
        }
      }

      // 3. Determine operation type and generate ops
      const opType = determineOpType(beforeData, afterData);

      // For UPDATE, merge to get full object
      let mergedAfterData = afterData;
      if (opType === 'UPDATE' && beforeData && afterData) {
        mergedAfterData = { ...beforeData, ...afterData };
      }

      const ops = generateOps(beforeData, mergedAfterData);

      // Skip items with no actual changes for UPDATE operations
      if (opType === 'UPDATE' && ops.length === 0) {
        return { changeRequestId: cr.id, status: cr.status };
      }

      // 4. Check if item for this target already exists
      const existingItem = await ChangeItem.query()
        .where('changeRequestId', cr.id)
        .where('targetTable', targetTable)
        .where('targetId', targetId)
        .first();

      if (existingItem) {
        // If the existing item is a DELETE and we're trying to UPDATE, skip it
        // (cannot modify an item already marked for deletion in the same CR)
        if (existingItem.opType === 'DELETE' && opType === 'UPDATE') {
          logger.info(
            `Skipping UPDATE for ${targetTable}:${targetId} — item already marked for DELETE in CR ${cr.id}`
          );
          return { changeRequestId: cr.id, status: cr.status };
        }
        // Update existing item's ops
        // Use mergedAfterData for label resolution so all fields (e.g. platform, clientVersion) are available
        const displayName = resolveEntityLabel(
          targetTable,
          mergedAfterData || beforeData
        );
        await ChangeItem.query()
          .findById(existingItem.id)
          .patch({ ops, opType, ...(displayName && { displayName }) });
      } else {
        // Determine ActionGroup type
        let actionGroupType: ActionGroupType = ACTION_GROUP_TYPES.UPDATE_ENTITY;
        if (opType === 'CREATE')
          actionGroupType = ACTION_GROUP_TYPES.CREATE_ENTITY;
        else if (opType === 'DELETE')
          actionGroupType = ACTION_GROUP_TYPES.DELETE_ENTITY;

        // Find or create ActionGroup
        let actionGroup = await ActionGroup.query()
          .where('changeRequestId', cr.id)
          .where('actionType', actionGroupType)
          .first();

        if (!actionGroup) {
          const cleanTable = targetTable.startsWith('g_')
            ? targetTable.slice(2)
            : targetTable;
          const actionLabel =
            opType === 'CREATE'
              ? 'Create'
              : opType === 'DELETE'
                ? 'Delete'
                : 'Update';
          const maxOrder = await ActionGroup.query()
            .where('changeRequestId', cr.id)
            .max('orderIndex as maxOrder')
            .first();
          const nextOrder = ((maxOrder as any)?.maxOrder ?? -1) + 1;

          actionGroup = await ActionGroup.query().insert({
            id: ulid(),
            changeRequestId: cr.id,
            actionType: actionGroupType,
            title: `${actionLabel} ${cleanTable}`,
            orderIndex: nextOrder,
          });
        }

        // Insert ChangeItem with ops
        // Use mergedAfterData for label resolution so all fields (e.g. platform, clientVersion) are available
        const displayName = resolveEntityLabel(
          targetTable,
          mergedAfterData || beforeData
        );
        await ChangeItem.query().insert({
          id: ulid(),
          changeRequestId: cr.id,
          actionGroupId: actionGroup.id,
          targetTable,
          targetId,
          opType,
          ops,
          ...(displayName && { displayName }),
        });
      }

      return { changeRequestId: cr.id, status: cr.status };
    } catch (error) {
      logger.error('Error upserting change request:', error);
      throw error;
    }
  }

  /**
   * Upsert a ChangeItem with draftData (for complex entities like feature flags, segments).
   * Instead of field-level ops, stores a full snapshot in draftData.
   * The draftData is applied via the service-registry handler on execute.
   */
  static async upsertDraftDataItem(
    userId: string,
    environmentId: string,
    targetTable: string,
    targetId: string,
    draftData: Record<string, any>,
    actionTitle?: string,
    beforeDraftData?: Record<string, any>
  ): Promise<{ changeRequestId: string; status: ChangeRequestStatus }> {
    try {
      // Check for pending review
      const pendingReview = await ChangeRequest.query()
        .where('requesterId', userId)
        .where('environmentId', environmentId)
        .where('status', 'open')
        .first();

      if (pendingReview) {
        throw new GatrixError(
          'You have a pending review request. Withdraw it or wait for approval/rejection before making new changes.',
          409,
          true,
          'PENDING_REVIEW_EXISTS'
        );
      }

      // Skip items with no actual changes (systemic guard for bulk operations)
      if (beforeDraftData && draftData) {
        const internalKeys = new Set(['_flagName']);
        const relevantKeys = Object.keys(draftData).filter(
          (k) => !internalKeys.has(k)
        );
        let hasActualChange = false;
        for (const key of relevantKeys) {
          const beforeVal = beforeDraftData[key];
          const afterVal = draftData[key];
          if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
            hasActualChange = true;
            break;
          }
        }
        if (!hasActualChange) {
          logger.debug(
            `Skipping upsertDraftDataItem for ${targetTable}:${targetId} — no actual changes detected`
          );
          // Return existing draft CR id if available, otherwise create a minimal response
          const existingDraft = await ChangeRequest.query()
            .where('requesterId', userId)
            .where('environmentId', environmentId)
            .where('status', 'draft')
            .first();
          if (existingDraft) {
            return {
              changeRequestId: existingDraft.id,
              status: existingDraft.status,
            };
          }
          // No draft exists and no changes — return a no-op indicator
          return { changeRequestId: '', status: 'draft' };
        }
      }

      // Find or create draft CR
      // First, check if there's already a draft CR that contains a change item for this target
      // This ensures all changes for a single entity (e.g., feature flag across multiple envs) go into one CR
      let cr: ChangeRequest | undefined;

      const existingItemForTarget = await ChangeItem.query()
        .joinRelated('changeRequest')
        .where('g_change_items.targetTable', targetTable)
        .where('g_change_items.targetId', targetId)
        .where('changeRequest.requesterId', userId)
        .where('changeRequest.status', 'draft')
        .select('g_change_items.changeRequestId')
        .first();

      if (existingItemForTarget) {
        cr = await ChangeRequest.query().findById(
          existingItemForTarget.changeRequestId
        );
      }

      // Fallback: look for any draft CR by this user for this environment
      if (!cr) {
        cr = await ChangeRequest.query()
          .where('requesterId', userId)
          .where('environmentId', environmentId)
          .where('status', 'draft')
          .first();
      }

      if (!cr) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        cr = await ChangeRequest.query().insert({
          id: ulid(),
          requesterId: userId,
          environmentId,
          status: 'draft',
          title: `Draft-${hh}${mm}`,
        });
      }

      // Check if item for this target already exists
      const existingItem = await ChangeItem.query()
        .where('changeRequestId', cr.id)
        .where('targetTable', targetTable)
        .where('targetId', targetId)
        .first();

      if (existingItem) {
        // Update existing item's draftData
        const displayName = resolveEntityLabel(targetTable, draftData);
        await ChangeItem.query()
          .findById(existingItem.id)
          .patch({
            draftData,
            ops: [],
            ...(displayName && { displayName }),
            ...(beforeDraftData && { beforeDraftData }),
          });
      } else {
        // Find or create ActionGroup
        let actionGroup = await ActionGroup.query()
          .where('changeRequestId', cr.id)
          .where('actionType', ACTION_GROUP_TYPES.UPDATE_ENTITY)
          .first();

        if (!actionGroup) {
          const maxOrder = await ActionGroup.query()
            .where('changeRequestId', cr.id)
            .max('orderIndex as maxOrder')
            .first();
          const nextOrder = ((maxOrder as any)?.maxOrder ?? -1) + 1;

          actionGroup = await ActionGroup.query().insert({
            id: ulid(),
            changeRequestId: cr.id,
            actionType: ACTION_GROUP_TYPES.UPDATE_ENTITY,
            title: actionTitle || `Update ${targetTable}`,
            orderIndex: nextOrder,
          });
        }

        // Insert ChangeItem with draftData (ops is empty)
        const displayName = resolveEntityLabel(targetTable, draftData);
        await ChangeItem.query().insert({
          id: ulid(),
          changeRequestId: cr.id,
          actionGroupId: actionGroup.id,
          targetTable,
          targetId,
          opType: 'UPDATE',
          ops: [],
          draftData,
          ...(displayName && { displayName }),
          ...(beforeDraftData && { beforeDraftData }),
        });
      }

      return { changeRequestId: cr.id, status: cr.status };
    } catch (error) {
      logger.error('Error upserting draft data item:', error);
      throw error;
    }
  }

  /**
   * Get pending CR draftData for a specific target entity.
   * Returns the draftData from the most recent pending (draft/open) CR ChangeItem.
   * Used by Playground evaluation and detail pages to show pending changes.
   */
  static async getPendingDraftForTarget(
    targetTable: string,
    targetId: string,
    environmentId?: string
  ): Promise<{
    changeRequestId: string;
    status: ChangeRequestStatus;
    draftData: Record<string, any>;
    requesterId: string;
  } | null> {
    const statuses = ['draft', 'open', 'approved'];

    let query = ChangeItem.query()
      .joinRelated('changeRequest')
      .where('g_change_items.targetTable', targetTable)
      .where('g_change_items.targetId', targetId)
      .whereIn('changeRequest.status', statuses)
      .whereNotNull('g_change_items.draftData')
      .select(
        'g_change_items.changeRequestId',
        'changeRequest.status',
        'g_change_items.draftData',
        'changeRequest.requesterId'
      )
      .orderBy('changeRequest.createdAt', 'desc')
      .first();

    if (environmentId) {
      query = query.where('changeRequest.environmentId', environmentId);
    }

    const result = await query;

    if (!result) return null;

    return {
      changeRequestId: result.changeRequestId,
      status: (result as any).status,
      draftData: result.draftData as Record<string, any>,
      requesterId: (result as any).requesterId,
    };
  }

  /**
   * Get all pending CR draftData items for a target table in an environment.
   * Used by Playground to merge all pending changes for evaluation.
   */
  static async getAllPendingDraftsForTable(
    targetTable: string,
    projectId: string
  ): Promise<
    Array<{
      targetId: string;
      changeRequestId: string;
      draftData: Record<string, any>;
    }>
  > {
    const items = await ChangeItem.query()
      .joinRelated('changeRequest.[environmentModel]')
      .where('g_change_items.targetTable', targetTable)
      .whereIn('changeRequest.status', ['draft', 'open', 'approved'])
      .where('changeRequest:environmentModel.projectId', projectId)
      .whereNotNull('g_change_items.draftData')
      .select(
        'g_change_items.targetId',
        'g_change_items.changeRequestId',
        'g_change_items.draftData'
      );

    return items.map((item) => ({
      targetId: item.targetId,
      changeRequestId: item.changeRequestId,
      draftData: item.draftData as Record<string, any>,
    }));
  }

  static async updateChangeRequestMetadata(
    changeRequestId: string,
    metadata: {
      title?: string;
      description?: string;
      reason?: string;
      impactAnalysis?: string;
    }
  ): Promise<ChangeRequest> {
    const cr = await ChangeRequest.query().findById(changeRequestId);
    if (!cr) throw new Error('Change Request not found');
    if (cr.status !== 'draft')
      throw new Error('Metadata can only be updated in DRAFT status');

    return await cr.$query().patchAndFetch(metadata);
  }

  static async submitChangeRequest(
    changeRequestId: string
  ): Promise<ChangeRequest> {
    const cr = await ChangeRequest.query()
      .findById(changeRequestId)
      .withGraphFetched('[requester, changeItems]');
    if (!cr) throw new Error('Change Request not found');
    if (cr.status !== 'draft')
      throw new Error('Only DRAFT requests can be submitted');

    // Validation - only title is required
    if (!cr.title) {
      throw new Error('Title is required for submission.');
    }

    // Capture entity versions at submission time for conflict detection later
    for (const item of cr.changeItems || []) {
      if (!/^[a-zA-Z0-9_]+$/.test(item.targetTable)) continue;

      // Skip new items (they have no existing version)
      if (item.targetId.startsWith('NEW_')) continue;

      try {
        const currentData = await knex(item.targetTable)
          .where(getPrimaryKey(item.targetTable), item.targetId)
          .first();

        if (currentData && typeof currentData.version === 'number') {
          // Store the version at submission time
          await ChangeItem.query()
            .findById(item.id)
            .patch({ entityVersion: currentData.version });
        }
      } catch (err) {
        logger.warn(
          `Failed to capture version for ${item.targetTable}:${item.targetId}`,
          err
        );
      }
    }

    const updated = await cr.$query().patchAndFetch({
      status: 'open',
      updatedAt: new Date().toISOString() as any,
    });

    // Send SSE notification to all users
    await ChangeRequestNotifications.notifySubmitted({
      id: cr.id,
      title: cr.title,
      environmentId: cr.environmentId,
      requesterId: cr.requesterId,
      requesterName: cr.requester?.name || cr.requester?.email,
    });

    return updated;
  }

  static async approveChangeRequest(
    changeRequestId: string,
    approverId: string,
    comment?: string,
    options?: { forceApprove?: boolean }
  ): Promise<ChangeRequest> {
    return await transaction(ChangeRequest.knex(), async (trx) => {
      const cr = await ChangeRequest.query(trx)
        .findById(changeRequestId)
        .withGraphFetched('[environmentModel, requester]');
      if (!cr)
        throw new GatrixError(
          'Change Request not found',
          404,
          true,
          ErrorCodes.CR_NOT_FOUND
        );
      if (cr.status !== 'open')
        throw new GatrixError(
          'Request is not OPEN for approval',
          400,
          true,
          ErrorCodes.CR_INVALID_STATUS
        );

      // Get approver info for notification
      const approver = await User.query().findById(approverId);

      // 1. Record Approval
      // Check if already approved by this user
      const existing = await Approval.query(trx)
        .where('changeRequestId', changeRequestId)
        .where('approverId', approverId)
        .first();

      if (existing) {
        throw new GatrixError(
          'You have already approved this request.',
          400,
          true,
          ErrorCodes.CR_ALREADY_APPROVED
        );
      }

      await Approval.query(trx).insert({
        id: ulid(),
        changeRequestId: cr.id,
        approverId,
        comment,
      });

      // 2. Check Threshold
      // Fetch all approvals to be absolutely sure of the count regardless of DB dialect
      const allApprovals = await Approval.query(trx).where(
        'changeRequestId',
        changeRequestId
      );
      const currentApprovals = allApprovals.length;

      // Get required threshold from environment (default to 1)
      let requiredApprovers = 1;
      if (cr.environmentModel) {
        requiredApprovers = Number(cr.environmentModel.requiredApprovers);
      } else {
        // Fallback: fetch environment directly if relation failed to load
        const env = await knex('g_environments')
          .transacting(trx)
          .where('environmentId', cr.environmentId)
          .first();
        if (env) {
          requiredApprovers = Number(env.requiredApprovers);
        }
      }

      let isForced = false;
      if (options?.forceApprove) {
        const chain = await permissionService.resolveEnvironmentChain(cr.environmentId);
        const hasSkipPermission = chain
          ? await permissionService.hasEnvPermission(
              approverId,
              chain.orgId,
              chain.projectId,
              cr.environmentId,
              P.CHANGE_REQUESTS_SKIP
            )
          : false;
        if (!hasSkipPermission) {
          throw new GatrixError(
            'You do not have permission to force approve.',
            403,
            true,
            'FORBIDDEN'
          );
        }
        isForced = true;
      }

      logger.info(
        `Approval threshold check for ${cr.id}: ${currentApprovals}/${requiredApprovers} (Env: ${cr.environmentId}, Forced: ${isForced})`
      );

      if (currentApprovals >= requiredApprovers || isForced) {
        const updated = await ChangeRequest.query(trx).patchAndFetchById(
          cr.id,
          {
            status: 'approved',
            updatedAt: new Date().toISOString() as any,
          }
        );

        logger.info(`Request ${cr.id} transitioned to APPROVED status.`);

        // Send SSE notification to requester when approved
        await ChangeRequestNotifications.notifyApproved(
          {
            id: cr.id,
            title: cr.title,
            environmentId: cr.environmentId,
            requesterId: cr.requesterId,
          },
          approver?.name || approver?.email,
          approverId
        );

        return updated;
      }

      // Still OPEN - but we should return the latest state including the new approval count
      const refreshed = await ChangeRequest.query(trx)
        .findById(cr.id)
        .withGraphFetched('[environmentModel, requester, approvals]');

      return refreshed || cr;
    });
  }

  /**
   * Checks if an open Change Request meets the approval criteria
   * (Useful if environment config changes after CR creation)
   */
  static async checkAndAutoApprove(
    cr: ChangeRequest
  ): Promise<ChangeRequest | null> {
    if (cr.status !== 'open') return null;

    const effectiveMinApprovals = cr.environmentModel
      ? Number(cr.environmentModel.requiredApprovers)
      : 1;
    const approvalCount = cr.approvals?.length ?? 0;

    if (approvalCount >= effectiveMinApprovals) {
      logger.info(
        `Auto-approving ${cr.id} as threshold ${effectiveMinApprovals} is met via lazy check`
      );

      const updated = await ChangeRequest.query().patchAndFetchById(cr.id, {
        status: 'approved',
        updatedAt: new Date().toISOString() as any,
      });

      // Notify about this state change
      try {
        await ChangeRequestNotifications.notifyApproved(
          {
            id: cr.id,
            title: cr.title,
            environmentId: cr.environmentId,
            requesterId: cr.requesterId,
          },
          'System (Auto)',
          ''
        );
      } catch (err) {
        logger.error('Failed to send auto-approve notification', err);
      }

      return updated;
    }

    return null;
  }

  static async rejectChangeRequest(
    changeRequestId: string,
    rejectedBy: string | null,
    comment: string
  ): Promise<ChangeRequest> {
    if (!comment) throw new Error('Rejection comment is mandatory.');

    const cr = await ChangeRequest.query().findById(changeRequestId);
    if (!cr) throw new Error('Change Request not found');
    if (cr.status !== 'open' && cr.status !== 'approved') {
      throw new Error('Only OPEN or APPROVED requests can be rejected');
    }

    // Get rejector info for notification (null means system rejection)
    const rejector = rejectedBy
      ? await User.query().findById(rejectedBy)
      : null;
    const rejectorName = rejector?.name || rejector?.email || 'System';

    // Update Status with rejection info
    await cr.$query().patch({
      status: 'rejected',
      rejectedBy: rejectedBy ?? undefined, // Will be undefined for system rejections
      rejectedAt: knex.fn.now(),
      rejectionReason: comment,
    });

    // Create Audit Log with comment
    await knex('g_audit_logs').insert({
      id: ulid(),
      action: 'change_request_rejected',
      userId: rejectedBy || '',
      changeRequestId: cr.id,
      entityType: 'ChangeRequest',
      entityId: cr.id,
      newValues: JSON.stringify({ comment }),
    });

    // Send SSE notification to requester
    await ChangeRequestNotifications.notifyRejected(
      {
        id: cr.id,
        title: cr.title,
        environmentId: cr.environmentId,
        requesterId: cr.requesterId,
      },
      rejectorName,
      comment,
      rejectedBy || ''
    );

    const updated = await cr.$query().findById(cr.id);
    if (!updated) throw new Error('Failed to retrieve updated change request');
    return updated;
  }

  static async reopenChangeRequest(
    changeRequestId: string,
    requesterId: string
  ): Promise<ChangeRequest> {
    return await transaction(ChangeRequest.knex(), async (trx) => {
      const cr = await ChangeRequest.query(trx).findById(changeRequestId);
      if (!cr) throw new Error('Change Request not found');
      if (cr.status !== 'rejected' && cr.status !== 'conflict') {
        throw new Error('Only REJECTED or CONFLICT requests can be reopened');
      }

      const user = await User.query(trx).findById(requesterId);
      // Check admin status via RBAC permissions (wildcard = org admin)
      const { permissionService } = await import('./permission-service');
      const userOrgs =
        await permissionService.getUserOrganisations(requesterId);
      let isAdmin = false;
      for (const org of userOrgs) {
        if (await permissionService.isOrgAdmin(requesterId, org.orgId)) {
          isAdmin = true;
          break;
        }
      }

      // Validate ownership: Only the original requester or an admin can reopen
      if (cr.requesterId !== requesterId && !isAdmin) {
        throw new Error(
          'Only the original requester or an admin can reopen this request.'
        );
      }

      // Phase 4: Check for existing draft - prevent reopen conflict
      const existingDraft = await ChangeRequest.query(trx)
        .where('requesterId', cr.requesterId)
        .where('environmentId', cr.environmentId)
        .where('status', 'draft')
        .first();

      if (existingDraft) {
        throw new GatrixError(
          'Cannot reopen: you already have an active draft. Delete or submit it first.',
          409,
          true,
          'REOPEN_CONFLICT',
          { existingDraftId: existingDraft.id }
        );
      }

      // Also check for pending review
      const pendingReview = await ChangeRequest.query(trx)
        .where('requesterId', cr.requesterId)
        .where('environmentId', cr.environmentId)
        .where('status', 'open')
        .first();

      if (pendingReview) {
        throw new GatrixError(
          'Cannot reopen: you have a pending review request. Wait for approval/rejection first.',
          409,
          true,
          'PENDING_REVIEW_EXISTS'
        );
      }

      // Reset to Draft
      const updated = await cr.$query(trx).patchAndFetch({ status: 'draft' });

      // CRITICAL: Delete ALL approvals (Reset progress)
      await Approval.query(trx)
        .where('changeRequestId', changeRequestId)
        .delete();

      return updated;
    });
  }

  static async executeChangeRequest(
    changeRequestId: string,
    userId: string
  ): Promise<ChangeRequest> {
    // Import service registry
    const { hasServiceHandler, getServiceHandler } =
      await import('./service-registry');

    const result = await transaction(ChangeRequest.knex(), async (trx) => {
      const cr = await ChangeRequest.query(trx)
        .findById(changeRequestId)
        .withGraphFetched('changeItems');

      if (!cr) throw new Error('Change Request not found');
      if (cr.status !== 'approved')
        throw new Error('Change Request must be APPROVED to execute');

      // Get environment settings for conflict check policy
      const env = await Environment.query(trx).findById(cr.environmentId);
      const strictConflictCheck = env?.strictConflictCheck ?? true; // Default to strict

      // Collect items for post-transaction service calls and Outbox events
      const serviceCallsNeeded: Array<{
        targetTable: string;
        targetId: string;
        afterData: any;
        beforeData: any;
        isCreate: boolean;
        isDraftData?: boolean;
      }> = [];

      // Transactional Logic - verify data and prepare for service calls
      for (const item of cr.changeItems || []) {
        // 1. Validate table name
        if (!/^[a-zA-Z0-9_]+$/.test(item.targetTable)) {
          throw new Error(`Invalid target table: ${item.targetTable}`);
        }

        // Resolve primary key column for this table
        const pk = getPrimaryKey(item.targetTable);

        const targetRow = await trx(item.targetTable)
          .where(pk, item.targetId)
          .first()
          .forUpdate(); // ROW LOCK

        // 2. Version-based Conflict Detection
        const liveData = targetRow || null;
        const isCreate = !liveData;

        // Check version if available (preferred method)
        const hasVersionColumn =
          liveData && typeof liveData.version === 'number';
        const storedEntityVersion = item.entityVersion;
        const liveVersion = liveData?.version;

        let hasConflict = false;
        let conflictReason = '';

        if (
          hasVersionColumn &&
          storedEntityVersion !== undefined &&
          storedEntityVersion !== null
        ) {
          // Version-based conflict detection
          if (liveVersion !== storedEntityVersion) {
            hasConflict = true;
            conflictReason = `Version mismatch: expected ${storedEntityVersion}, found ${liveVersion}`;
          }
        } else if (!isCreate) {
          // Fallback: compare using ops' oldValues against live data
          // ChangeItem model does not have a beforeData field, so we use ops to detect conflicts
          if (item.ops && item.ops.length > 0 && liveData) {
            const normalizeValue = (val: any): any => {
              if (val === true) return 1;
              if (val === false) return 0;
              if (val instanceof Date) return val.toISOString();
              return val;
            };
            for (const op of item.ops) {
              // Skip virtual fields that don't exist in the actual DB table
              // (e.g., tagIds stored in a separate tag_assignments table)
              if (!(op.path in liveData)) continue;

              const liveVal = normalizeValue(liveData[op.path]);
              const expectedVal = normalizeValue(op.oldValue);
              if (JSON.stringify(liveVal) !== JSON.stringify(expectedVal)) {
                hasConflict = true;
                conflictReason = `Field "${op.path}" has changed since this request was created (expected: ${JSON.stringify(expectedVal)}, found: ${JSON.stringify(liveVal)})`;
                break;
              }
            }
          }
          // If ops is empty or not available, skip conflict check (no baseline to compare)
        }

        if (hasConflict) {
          if (strictConflictCheck) {
            // Set status to 'conflict' and save before throwing error
            await ChangeRequest.query(trx)
              .findById(changeRequestId)
              .patch({
                status: 'conflict',
                rejectionReason: `Data conflict: ${conflictReason}`,
                updatedAt: new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ') as any,
              });

            throw new GatrixError(
              conflictReason,
              409,
              true,
              'CR_DATA_CONFLICT',
              {
                originalDraftBase: item.beforeData,
                currentLive: liveData,
                userDraft: item.afterData,
                storedVersion: storedEntityVersion,
                liveVersion: liveVersion,
              }
            );
          } else {
            // Warn but continue (dev/test environments)
            logger.warn(
              `Conflict detected but continuing (non-strict): ${conflictReason}`
            );
          }
        }

        // 4. Apply Update based on opType
        // For DELETE operations, remove the record with optimistic lock
        if (item.opType === 'DELETE') {
          let affectedRows: number;

          // Use optimistic locking if version column exists
          if (hasVersionColumn && storedEntityVersion !== undefined) {
            affectedRows = await trx(item.targetTable)
              .where(pk, item.targetId)
              .where('version', storedEntityVersion)
              .delete();

            if (affectedRows === 0) {
              throw new GatrixError(
                `Optimistic lock failed: version changed during delete (table: ${item.targetTable}, id: ${item.targetId})`,
                409,
                true,
                'CR_DATA_CONFLICT'
              );
            }
          } else {
            affectedRows = await trx(item.targetTable)
              .where(pk, item.targetId)
              .delete();
          }

          logger.info(`Deleted ${item.targetTable}:${item.targetId}`);

          if (hasServiceHandler(item.targetTable)) {
            serviceCallsNeeded.push({
              targetTable: item.targetTable,
              targetId: item.targetId,
              afterData: null,
              beforeData: liveData,
              isCreate: false,
            });
          }
          continue; // Move to next item
        }

        // For CREATE/UPDATE: check if this item uses draftData (complex entities)
        if (item.draftData && Object.keys(item.draftData).length > 0) {
          // DraftData items skip direct DB updates.
          // They are applied via the service-registry handler after transaction.
          logger.info(
            `Queuing draftData-based execution for ${item.targetTable}:${item.targetId}`
          );
          serviceCallsNeeded.push({
            targetTable: item.targetTable,
            targetId: item.targetId,
            afterData: item.draftData,
            beforeData: liveData,
            isCreate: false,
            isDraftData: true,
          });
          continue;
        }

        // For CREATE/UPDATE: apply ops to get final data
        const afterData = applyOpsToData(liveData, item.ops, item.opType);
        if (afterData) {
          const isCreate = item.opType === 'CREATE';

          // Common non-column fields to strip for direct DB operations
          const fieldsToStrip = [
            'maintenanceLocales',
            'tagIds',
            'createdByName',
            'createdByEmail',
            'updatedByName',
            'updatedByEmail',
            'tags', // Often a list of tag objects from joins
            'approvals', // Joined data
            'environmentModel', // Joined data
          ];

          const dbData = { ...afterData };
          fieldsToStrip.forEach((f) => delete dbData[f]);

          // Strip fields that don't exist in the actual table to prevent 'Unknown column' errors
          const [allColumns] = await trx.raw(
            `SHOW COLUMNS FROM ${item.targetTable}`
          );
          const validColumns = new Set(
            (allColumns as any[]).map((col: any) => col.Field)
          );
          for (const key of Object.keys(dbData)) {
            if (!validColumns.has(key)) {
              delete dbData[key];
            }
          }

          // Note: Not all tables have createdBy/updatedBy columns
          // These should be set in the ops/afterData if needed

          // Convert ISO 8601 datetime strings to MySQL format
          // Instead of maintaining a list, scan all string fields
          for (const field of Object.keys(dbData)) {
            if (dbData[field] && typeof dbData[field] === 'string') {
              // Check if it's ISO 8601 format (ends with Z or has timezone offset)
              if (
                dbData[field].includes('T') &&
                (dbData[field].endsWith('Z') ||
                  dbData[field].match(/[+-]\d{2}:\d{2}$/))
              ) {
                const date = new Date(dbData[field]);
                if (!isNaN(date.getTime())) {
                  // Convert to MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
                  dbData[field] = date
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' ');
                }
              }
            }
          }

          // Stringify JSON fields (objects/arrays) to ensure MySQL compatibility
          for (const key in dbData) {
            if (
              dbData[key] !== null &&
              typeof dbData[key] === 'object' &&
              !(dbData[key] instanceof Date)
            ) {
              dbData[key] = JSON.stringify(dbData[key]);
            }
          }

          if (hasServiceHandler(item.targetTable)) {
            let realId: string | number = item.targetId;

            // Still update directly in transaction for atomicity
            if (isCreate) {
              // Check if table uses VARCHAR id (ULID) or INT auto_increment
              const [columns] = await trx.raw(
                `SHOW COLUMNS FROM ${item.targetTable} WHERE Field = 'id'`
              );
              const idColumnType = columns[0]?.Type?.toLowerCase() || '';
              const usesStringId =
                idColumnType.includes('varchar') ||
                idColumnType.includes('char');

              if (usesStringId) {
                // Generate a new ULID for VARCHAR id columns
                const newId = ulid();
                dbData.id = newId;
                realId = newId;
              } else {
                // For INT auto_increment, don't set id - let DB handle it
                delete dbData.id;
              }

              // Ensure environment is set for new records
              if (!dbData.environmentId) {
                dbData.environmentId = cr.environmentId;
              }
              // Ensure timestamps are set for new records
              if (!dbData.createdAt) {
                dbData.createdAt = new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ');
              }
              if (!dbData.updatedAt) {
                dbData.updatedAt = new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ');
              }
              // Set createdBy for new records only if the table has the column
              if (
                validColumns.has('createdBy') &&
                dbData.createdBy === undefined
              ) {
                dbData.createdBy = userId;
              }
              // Check if table has a version column
              const [versionCols] = await trx.raw(
                `SHOW COLUMNS FROM ${item.targetTable} WHERE Field = 'version'`
              );
              // Set initial version for new records
              if (
                versionCols &&
                versionCols.length > 0 &&
                dbData.version === undefined
              ) {
                dbData.version = 1;
              }
              const [result] = await trx(item.targetTable).insert(dbData);
              // For auto_increment, result is the new ID
              if (!usesStringId && result) {
                realId = result;
              }

              // Update ChangeItem's targetId to the real ID for future rollback
              if (
                item.targetId.startsWith('NEW_') &&
                realId !== item.targetId
              ) {
                await ChangeItem.query(trx)
                  .findById(item.id)
                  .patch({
                    targetId: String(realId),
                  });
                logger.info(
                  `Updated ChangeItem targetId: ${item.targetId} -> ${realId}`
                );
              }
            } else {
              // Optimistic locking: increment version and add to WHERE clause
              if (
                typeof liveData?.version === 'number' &&
                storedEntityVersion !== undefined
              ) {
                dbData.version = liveData.version + 1;
                const affectedRows = await trx(item.targetTable)
                  .where(pk, item.targetId)
                  .where('version', storedEntityVersion)
                  .update(dbData);

                if (affectedRows === 0) {
                  throw new GatrixError(
                    `Optimistic lock failed: version changed during update (table: ${item.targetTable}, id: ${item.targetId})`,
                    409,
                    true,
                    'CR_DATA_CONFLICT'
                  );
                }
              } else {
                // No version column - update without optimistic lock
                await trx(item.targetTable)
                  .where(pk, item.targetId)
                  .update(dbData);
              }
            }

            // Will call service after transaction commits
            serviceCallsNeeded.push({
              targetTable: item.targetTable,
              targetId: String(realId),
              afterData,
              beforeData: liveData,
              isCreate,
            });
          } else {
            // No service handler - direct update only, no events
            if (isCreate) {
              // Check if table uses VARCHAR id (ULID) or INT auto_increment
              const [columns] = await trx.raw(
                `SHOW COLUMNS FROM ${item.targetTable} WHERE Field = 'id'`
              );
              const idColumnType = columns[0]?.Type?.toLowerCase() || '';
              const usesStringId =
                idColumnType.includes('varchar') ||
                idColumnType.includes('char');

              if (usesStringId) {
                // Generate a new ULID for VARCHAR id columns
                dbData.id = ulid();
              } else {
                // For INT auto_increment, don't set id - let DB handle it
                delete dbData.id;
              }

              // Ensure environment is set for new records
              if (!dbData.environmentId) {
                dbData.environmentId = cr.environmentId;
              }
              // Ensure timestamps are set for new records
              if (!dbData.createdAt) {
                dbData.createdAt = new Date();
              }
              if (!dbData.updatedAt) {
                dbData.updatedAt = new Date();
              }
              // Check if table has a version column
              const [versionCols] = await trx.raw(
                `SHOW COLUMNS FROM ${item.targetTable} WHERE Field = 'version'`
              );
              // Set initial version for new records
              if (
                versionCols &&
                versionCols.length > 0 &&
                dbData.version === undefined
              ) {
                dbData.version = 1;
              }

              // Strip fields that don't exist in the actual table
              const [allCols2] = await trx.raw(
                `SHOW COLUMNS FROM ${item.targetTable}`
              );
              const validCols2 = new Set(
                (allCols2 as any[]).map((col: any) => col.Field)
              );
              for (const key of Object.keys(dbData)) {
                if (!validCols2.has(key)) {
                  delete dbData[key];
                }
              }

              const [insertResult] = await trx(item.targetTable).insert(dbData);

              // Update ChangeItem's targetId to the real ID for future rollback
              const realId: string | number = dbData.id || insertResult;
              if (
                item.targetId.startsWith('NEW_') &&
                realId &&
                realId !== item.targetId
              ) {
                await ChangeItem.query(trx)
                  .findById(item.id)
                  .patch({
                    targetId: String(realId),
                  });
                logger.info(
                  `Updated ChangeItem targetId: ${item.targetId} -> ${realId}`
                );
              }
            } else {
              // Optimistic locking: increment version and add to WHERE clause
              if (
                typeof liveData?.version === 'number' &&
                storedEntityVersion !== undefined
              ) {
                dbData.version = liveData.version + 1;
                const affectedRows = await trx(item.targetTable)
                  .where(pk, item.targetId)
                  .where('version', storedEntityVersion)
                  .update(dbData);

                if (affectedRows === 0) {
                  throw new GatrixError(
                    `Optimistic lock failed: version changed during update (table: ${item.targetTable}, id: ${item.targetId})`,
                    409,
                    true,
                    'CR_DATA_CONFLICT'
                  );
                }
              } else {
                // No version column - update without optimistic lock
                await trx(item.targetTable)
                  .where(pk, item.targetId)
                  .update(dbData);
              }
            }
            logger.warn(
              `No service handler for ${item.targetTable}, events not published`
            );
          }
        }
      }

      // 5. Record Outbox events (within transaction for atomicity)
      if (serviceCallsNeeded.length > 0) {
        await OutboxService.recordCREvents(
          cr.id,
          serviceCallsNeeded.map((call) => ({
            entityType: call.targetTable,
            entityId: call.targetId,
            beforeData: call.beforeData,
            afterData: call.afterData,
            isCreate: call.isCreate,
            isDelete: false, // TODO: Handle deletes when supported
          })),
          trx
        );
      }

      // 6. Finalize
      const finalInfo = await cr.$query(trx).patchAndFetch({
        status: 'applied',
        executedBy: userId, // Store who executed this request
      });

      // Fetch executor for notification
      const executor = await User.query(trx).findById(userId);

      // Notify frontend
      await ChangeRequestNotifications.notifyExecuted(
        {
          id: cr.id,
          title: cr.title,
          environmentId: cr.environmentId,
          requesterId: cr.requesterId,
        },
        executor?.name || executor?.email,
        userId
      );

      // Log Execution
      await knex('g_audit_logs').transacting(trx).insert({
        id: ulid(),
        action: 'change_request_executed',
        userId,
        changeRequestId: cr.id,
        entityType: 'ChangeRequest',
        entityId: cr.id,
      });

      return { cr: finalInfo, serviceCallsNeeded };
    });

    // 6. After transaction commits, publish events via service layer
    if (result.serviceCallsNeeded.length > 0) {
      for (const call of result.serviceCallsNeeded) {
        const handler = getServiceHandler(call.targetTable);
        if (handler) {
          try {
            if (call.isDraftData && handler.applyDraft) {
              // Use applyDraft for complex entities with draftData
              await handler.applyDraft(
                call.targetId,
                call.afterData,
                result.cr.environmentId,
                userId
              );
            } else {
              // Standard apply for ops-based changes
              await handler.apply(
                call.targetId,
                call.afterData,
                result.cr.environmentId,
                userId
              );
            }
          } catch (err) {
            logger.error(
              `Post-execution service hook failed for ${call.targetTable}:${call.targetId}`,
              err
            );
            // We do NOT rollback transaction here as data is already committed.
            // Just log error. Ideally this should be robust or queue-based.
          }
        }
      }
    }

    return result.cr;
  }

  /**
   * Preview what a revert would look like without creating the CR
   * Returns the inverse operations that would be applied
   */
  static async previewRevert(changeRequestId: string): Promise<{
    originalCr: ChangeRequest;
    revertItems: Array<{
      targetTable: string;
      targetId: string;
      displayName?: string;
      opType: EntityOpType;
      ops: FieldOp[];
      actionType: string;
    }>;
  }> {
    const originalCr = await ChangeRequest.query()
      .findById(changeRequestId)
      .withGraphFetched('changeItems');

    if (!originalCr) throw new GatrixError('Change Request not found', 404);
    if (originalCr.status !== 'applied')
      throw new GatrixError('Only APPLIED requests can be reverted', 400);

    const revertItems: Array<{
      targetTable: string;
      targetId: string;
      displayName?: string;
      opType: EntityOpType;
      ops: FieldOp[];
      actionType: string;
    }> = [];

    for (const item of originalCr.changeItems || []) {
      const inverseOpType = getInverseOpType(item.opType);
      const inverseOps = generateInverseOps(item.ops);

      let actionType = 'UPDATE_ENTITY';
      if (inverseOpType === 'CREATE') actionType = 'CREATE_ENTITY';
      else if (inverseOpType === 'DELETE') actionType = 'DELETE_ENTITY';

      revertItems.push({
        targetTable: item.targetTable,
        targetId: item.targetId,
        displayName: item.displayName,
        opType: inverseOpType,
        ops: inverseOps,
        actionType,
      });
    }

    return { originalCr, revertItems };
  }

  static async revertChangeRequest(
    changeRequestId: string,
    userId: string
  ): Promise<ChangeRequest> {
    return await transaction(ChangeRequest.knex(), async (trx) => {
      const originalCr = await ChangeRequest.query(trx)
        .findById(changeRequestId)
        .withGraphFetched('changeItems');

      if (!originalCr) throw new GatrixError('Change Request not found', 404);
      if (originalCr.status !== 'applied')
        throw new GatrixError('Only APPLIED requests can be reverted', 400);

      // Create new CR for revert
      const newCrKey = ulid();
      const newCr = await ChangeRequest.query(trx).insert({
        id: newCrKey,
        title: `Revert: ${originalCr.title}`,
        description: `Revert of request #${originalCr.id}`,
        requesterId: userId,
        environmentId: originalCr.environmentId,
        status: 'open',
        type: 'revert',
      });

      // Process items - Generate inverse operations
      for (const item of originalCr.changeItems || []) {
        // Determine inverse operation type
        const inverseOpType = getInverseOpType(item.opType);

        // Determine ActionGroup type for revert
        let actionGroupType: ActionGroupType = ACTION_GROUP_TYPES.UPDATE_ENTITY;
        if (inverseOpType === 'CREATE')
          actionGroupType = ACTION_GROUP_TYPES.CREATE_ENTITY;
        else if (inverseOpType === 'DELETE')
          actionGroupType = ACTION_GROUP_TYPES.DELETE_ENTITY;

        // Find or create ActionGroup for the new CR
        let actionGroup = await ActionGroup.query(trx)
          .where('changeRequestId', newCrKey)
          .where('actionType', actionGroupType)
          .first();

        if (!actionGroup) {
          const cleanTable = item.targetTable.startsWith('g_')
            ? item.targetTable.slice(2)
            : item.targetTable;
          const actionLabel =
            inverseOpType === 'CREATE'
              ? 'Restore'
              : inverseOpType === 'DELETE'
                ? 'Remove'
                : 'Revert';

          const maxOrder = (await ActionGroup.query(trx)
            .where('changeRequestId', newCrKey)
            .max('orderIndex as maxOrder')
            .first()) as any;
          const nextOrder = (maxOrder?.maxOrder ?? -1) + 1;

          actionGroup = await ActionGroup.query(trx).insert({
            id: ulid(),
            changeRequestId: newCrKey,
            actionType: actionGroupType,
            title: `${actionLabel} ${cleanTable}`,
            orderIndex: nextOrder,
          });
        }

        // Generate inverse ops
        const inverseOps = generateInverseOps(item.ops);

        // Fetch current live data for proper conflict detection during revert execution
        let currentLiveData: Record<string, any> | null = null;
        let currentVersion: number | undefined;

        if (inverseOpType !== 'CREATE') {
          // For UPDATE/DELETE revert, need to capture current state
          try {
            currentLiveData = await trx(item.targetTable)
              .where(getPrimaryKey(item.targetTable), item.targetId)
              .first();
            if (currentLiveData?.version !== undefined) {
              currentVersion = currentLiveData.version;
            }
          } catch (err) {
            logger.warn(
              `Could not fetch live data for ${item.targetTable}:${item.targetId}`,
              err
            );
          }
        }

        // Calculate afterData by applying inverse ops to current live data
        const afterData =
          inverseOpType === 'DELETE'
            ? null
            : applyOpsToData(currentLiveData, inverseOps, inverseOpType);

        await ChangeItem.query(trx).insert({
          id: ulid(),
          changeRequestId: newCrKey,
          actionGroupId: actionGroup.id,
          targetTable: item.targetTable,
          targetId: item.targetId,
          opType: inverseOpType,
          ops: inverseOps,
          beforeData: currentLiveData,
          afterData: afterData,
          entityVersion: currentVersion,
        } as any);
      }

      // Notify
      const requester = await User.query(trx).findById(userId);
      try {
        // Treating revert creation as a new submission for notification purposes
        await ChangeRequestNotifications.notifySubmitted({
          id: newCr.id,
          title: newCr.title,
          environmentId: newCr.environmentId,
          requesterId: userId,
          requesterName: requester?.name || requester?.email,
        });
      } catch (err) {
        logger.error('Failed to send revert notification', err);
      }

      // Return the full CR with items AND action groups
      const result = await ChangeRequest.query(trx)
        .findById(newCr.id)
        .withGraphFetched('[changeItems, actionGroups.changeItems]');

      if (!result) {
        throw new Error('Failed to create revert request');
      }

      return result;
    });
  }

  /**
   * Delete rejected change requests older than X days
   */
  static async cleanupRejected(retentionDays: number): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - retentionDays);
    const isoThreshold = thresholdDate
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    return await transaction(ChangeRequest.knex(), async (trx) => {
      // Find IDs to delete first to handle related data
      const oldRequests = await ChangeRequest.query(trx)
        .where('status', 'rejected')
        .where('rejectedAt', '<', isoThreshold)
        .select('id');

      const ids = oldRequests.map((r) => r.id);
      if (ids.length === 0) return 0;

      // Delete related items and approvals
      await ChangeItem.query(trx).whereIn('changeRequestId', ids).delete();
      await Approval.query(trx).whereIn('changeRequestId', ids).delete();

      // Delete requests
      const deleted = await ChangeRequest.query(trx)
        .whereIn('id', ids)
        .delete();

      logger.info('Cleanup completed', {
        deleted,
        retentionDays,
      });
      return deleted;
    });
  }

  /**
   * Get counts of change requests by status
   * @param projectId Project ID to filter environments
   * @param userId User ID (for draft visibility)
   */
  static async getChangeRequestCounts(
    projectId: string,
    userId: string
  ): Promise<Record<string, number>> {
    const counts = await ChangeRequest.query()
      .joinRelated('environmentModel')
      .where('environmentModel.projectId', projectId)
      .where((builder) => {
        builder
          .whereNot('g_change_requests.status', 'draft')
          .orWhere((subBuilder) => {
            subBuilder
              .where('g_change_requests.status', 'draft')
              .where('g_change_requests.requesterId', userId);
          });
      })
      .groupBy('g_change_requests.status')
      .select('g_change_requests.status')
      .count('* as count');

    const result: Record<string, number> = {
      all: 0,
      draft: 0,
      open: 0,
      approved: 0,
      applied: 0,
      rejected: 0,
    };

    let total = 0;
    counts.forEach((row: any) => {
      const count = parseInt(row.count as string);
      result[row.status] = count;
      // Exclude drafts from the 'all' total since they are personal edit buffers
      if (row.status !== 'draft') {
        total += count;
      }
    });
    result.all = total;

    return result;
  }
}

// Helper for deep comparison handling generic JSON/DB response differences
function compareData(live: unknown, snapshot: unknown): boolean {
  // If both null/undefined/empty
  if (!live && !snapshot) return true;

  // Normalize objects to handle field order differences
  // This is necessary because DB JSON fields may be returned with different key orders
  const normalizedLive = normalizeForComparison(live);
  const normalizedSnapshot = normalizeForComparison(snapshot);

  // Utilize deep-diff
  const differences = diff(normalizedLive, normalizedSnapshot);
  // If diff is undefined, they are equal
  return !differences;
}

// Recursively sort object keys to ensure consistent comparison regardless of field order
function normalizeForComparison(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle Date objects - convert to ISO string for consistent comparison
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Normalize boolean/number for MySQL TINYINT compatibility
  // MySQL stores boolean as 0/1, but JS may have true/false
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  // Also normalize 0/1 to stay consistent
  if (typeof value === 'number' && (value === 0 || value === 1)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = normalizeForComparison(obj[key]);
    }
    return result;
  }

  return value;
}
