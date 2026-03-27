import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { ChangeRequestService } from '../services/change-request-service';
import { ChangeRequest } from '../models/change-request';
import { ChangeItem } from '../models/change-item';
import { ActionGroup } from '../models/action-group';
import { Approval } from '../models/approval';

import { createLogger } from '../config/logger';
const logger = createLogger('ChangeRequestController');

// Helper to get environment from request
function getEnvironment(req: AuthenticatedRequest): string {
  const env = req.environmentId;
  if (!env) {
    throw new GatrixError('Environment not specified', 400);
  }
  return env;
}

// Minimum delay for CR operations (prevents rapid clicks, ensures UI feedback visibility)
const CR_REQUEST_DELAY_MS = parseInt(
  process.env.CR_REQUEST_DELAY_MS || '0',
  10
);

async function withMinimumDelay<T>(operation: Promise<T>): Promise<T> {
  if (CR_REQUEST_DELAY_MS <= 0) {
    return operation;
  }
  const startTime = Date.now();
  const result = await operation;
  const elapsed = Date.now() - startTime;
  const remainingDelay = CR_REQUEST_DELAY_MS - elapsed;
  if (remainingDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  }
  return result;
}

export class ChangeRequestController {
  /**
   * Get list of change requests for current environment
   * GET /api/v1/admin/change-requests
   */
  static list = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const projectId = req.projectId;
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const userId = req.user?.id;

      // Filter by project (via environment join) instead of single environment
      let query = ChangeRequest.query()
        .joinRelated('environmentModel')
        .where('environmentModel.projectId', projectId as string)
        .withGraphFetched(
          '[requester, rejector, environmentModel, changeItems, approvals]'
        )
        .orderBy('g_change_requests.updatedAt', 'desc')
        .limit(limit)
        .offset(offset);

      if (status) {
        query = query.where('g_change_requests.status', status);
        // If filtering by draft, only show own drafts
        if (status === 'draft' && userId) {
          query = query.where('g_change_requests.requesterId', userId);
        }
      } else {
        // When showing all statuses, exclude drafts entirely
        // Drafts are personal edit buffers and only visible via the draft tab
        query = query.whereNot('g_change_requests.status', 'draft');
      }

      const [items, countResult] = await Promise.all([
        query,
        ChangeRequest.query()
          .joinRelated('environmentModel')
          .where('environmentModel.projectId', projectId as string)
          .where((builder: any) => {
            if (status) {
              builder.where('g_change_requests.status', status);
              if (status === 'draft' && userId) {
                builder.where('g_change_requests.requesterId', userId);
              }
            } else {
              builder.whereNot('g_change_requests.status', 'draft');
            }
          })
          .count('* as count')
          .first(),
      ]);

      const total = parseInt((countResult as any)?.count || '0');

      res.json({
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }
  );

  /**
   * Get single change request details
   * GET /api/v1/admin/change-requests/:id
   */
  static getById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const cr = await ChangeRequest.query()
        .findById(id)
        .withGraphFetched(
          '[requester, rejector, environmentModel, changeItems, actionGroups.changeItems, approvals.approver, executor]'
        );

      if (!cr) {
        throw new GatrixError('Change Request not found', 404);
      }

      // Lazy check for auto-approval (in case env config changed)
      if (cr.status === 'open') {
        const autoApproved = await ChangeRequestService.checkAndAutoApprove(cr);
        if (autoApproved) {
          cr.status = 'approved';
          cr.updatedAt = autoApproved.updatedAt;
        }
      }

      res.json({
        success: true,
        data: cr,
      });
    }
  );

  /**
   * Update change request metadata (Draft only)
   * PATCH /api/v1/admin/change-requests/:id
   */
  static updateMetadata = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { title, description, reason, impactAnalysis } = req.body;

      const updated = await ChangeRequestService.updateChangeRequestMetadata(
        id,
        {
          title,
          description,
          reason,
          impactAnalysis,
        }
      );

      res.json({
        success: true,
        data: updated,
        message: 'Change request metadata updated',
      });
    }
  );

  /**
   * Submit change request (Draft -> Open)
   * POST /api/v1/admin/change-requests/:id/submit
   */
  static submit = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { title, reason } = req.body;

      // Update title and reason before submitting
      if (title || reason) {
        await ChangeRequestService.updateChangeRequestMetadata(id, {
          title,
          reason,
        });
      }

      const submitted = await ChangeRequestService.submitChangeRequest(id);

      logger.info('Submitted', {
        changeRequestId: id,
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        data: submitted,
        message: 'Change request submitted for review',
      });
    }
  );

  /**
   * Approve change request
   * POST /api/v1/admin/change-requests/:id/approve
   */
  static approve = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        throw new GatrixError('User not authenticated', 401);
      }

      const approved = await withMinimumDelay(
        ChangeRequestService.approveChangeRequest(id, userId, comment)
      );

      logger.info('Approved', {
        changeRequestId: id,
        approverId: userId,
      });

      res.json({
        success: true,
        data: approved,
        message:
          approved.status === 'approved'
            ? 'Change request fully approved'
            : 'Approval recorded, waiting for more approvers',
      });
    }
  );

  /**
   * Reject change request
   * POST /api/v1/admin/change-requests/:id/reject
   */
  static reject = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        throw new GatrixError('User not authenticated', 401);
      }

      if (!comment) {
        throw new GatrixError('Rejection comment is required', 400);
      }

      const rejected = await withMinimumDelay(
        ChangeRequestService.rejectChangeRequest(id, userId, comment)
      );

      logger.info('Rejected', {
        changeRequestId: id,
        rejectorId: userId,
      });

      res.json({
        success: true,
        data: rejected,
        message: 'Change request rejected',
      });
    }
  );

  /**
   * Reopen rejected change request (Reset to Draft)
   * POST /api/v1/admin/change-requests/:id/reopen
   */
  static reopen = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new GatrixError('User not authenticated', 401);
      }

      const reopened = await withMinimumDelay(
        ChangeRequestService.reopenChangeRequest(id, userId)
      );

      logger.info('Reopened', { changeRequestId: id, userId });

      res.json({
        success: true,
        data: reopened,
        message: 'Change request reopened as draft',
      });
    }
  );

  /**
   * Execute approved change request
   * POST /api/v1/admin/change-requests/:id/execute
   */
  static execute = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new GatrixError('User not authenticated', 401);
      }

      try {
        const executed = await withMinimumDelay(
          ChangeRequestService.executeChangeRequest(id, userId)
        );

        logger.info('Executed', {
          changeRequestId: id,
          executorId: userId,
        });

        res.json({
          success: true,
          data: executed,
          message: 'Change request applied successfully',
        });
      } catch (error: any) {
        // Log full error details for internal debugging
        logger.error('Execution failed', {
          changeRequestId: id,
          executorId: userId,
          errorMessage: error.message,
          errorCode: error.code,
          errorStack: error.stack,
          sqlState: error.sqlState,
          errno: error.errno,
        });

        // Check if it's a known GatrixError (safe to expose)
        const isGatrixError = error instanceof GatrixError;
        const isConflictError =
          isGatrixError && error.code === 'CR_DATA_CONFLICT';
        const isDuplicateError =
          isGatrixError && error.code === 'DUPLICATE_ENTRY';

        // Check for MySQL duplicate entry error
        const isMySQLDuplicate =
          error.errno === 1062 || error.code === 'ER_DUP_ENTRY';

        if (isConflictError || isDuplicateError || isMySQLDuplicate) {
          try {
            if (isConflictError) {
              // Set status to 'conflict' for data conflicts
              await ChangeRequest.query().findById(id).patch({
                status: 'conflict',
                rejectionReason: '$i18n:errors.DATA_CONFLICT_DURING_EXECUTION',
              });
              logger.info('Marked as conflict', {
                changeRequestId: id,
              });
            } else {
              // Reject for duplicate entry errors
              await ChangeRequestService.rejectChangeRequest(
                id,
                null,
                '$i18n:errors.DUPLICATE_ENTRY_DURING_EXECUTION'
              );
              logger.info('Auto-rejected due to duplicate', {
                changeRequestId: id,
              });
            }
          } catch (updateError) {
            logger.error(
              'Failed to update CR status after execution failure',
              updateError
            );
          }

          // Throw a safe error message for conflict/duplicate cases
          if (isConflictError) {
            throw error; // GatrixError is safe to expose
          }
          throw new GatrixError(
            'Change request execution failed: duplicate entry detected',
            409,
            true,
            'DUPLICATE_ENTRY'
          );
        }

        // For all other errors (including internal SQL errors), throw a generic secure error
        // Do NOT expose internal error details to frontend
        throw new GatrixError(
          'Change request execution failed due to an internal error. Please contact the administrator.',
          500,
          true,
          'CR_EXECUTION_FAILED'
        );
      }
    }
  );

  /**
   * Delete draft change request
   * DELETE /api/v1/admin/change-requests/:id
   */
  static delete = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const cr = await ChangeRequest.query().findById(id);
      if (!cr) {
        throw new GatrixError('Change Request not found', 404);
      }

      if (cr.status !== 'draft' && cr.status !== 'rejected') {
        throw new GatrixError(
          'Only draft or rejected change requests can be deleted',
          400
        );
      }

      // Delete related items, action groups, and approvals first
      await ChangeItem.query().where('changeRequestId', id).delete();
      await ActionGroup.query().where('changeRequestId', id).delete();
      await Approval.query().where('changeRequestId', id).delete();
      await ChangeRequest.query().deleteById(id);

      logger.info('Deleted', {
        changeRequestId: id,
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Change request deleted',
      });
    }
  );

  /**
   * Get my pending change requests (as requester or approver)
   * GET /api/v1/admin/change-requests/my
   */
  static getMyRequests = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.userId;

      if (!userId) {
        throw new GatrixError('User not authenticated', 401);
      }

      // Return CRs from ALL environments (not filtered by active env)
      // so the floating banner works regardless of which env is active
      const asRequester = await ChangeRequest.query()
        .where('requesterId', userId)
        .whereIn('status', ['draft', 'open', 'rejected'])
        .withGraphFetched('changeItems')
        .orderBy('updatedAt', 'desc');

      const pendingApproval = await ChangeRequest.query()
        .where('status', 'open')
        .whereNotIn('id', (qb) => {
          qb.select('changeRequestId')
            .from('g_approvals')
            .where('approverId', userId);
        })
        .withGraphFetched('[requester, changeItems]')
        .orderBy('updatedAt', 'desc');

      // Separate drafts from other own requests for banner display
      const myDrafts = asRequester.filter((cr) => cr.status === 'draft');
      const myNonDraftRequests = asRequester.filter(
        (cr) => cr.status !== 'draft'
      );

      res.json({
        success: true,
        data: {
          myRequests: myNonDraftRequests,
          myDrafts,
          pendingApproval,
        },
      });
    }
  );

  /**
   * Preview revert - shows what changes would be made without creating the CR
   * GET /api/v1/admin/change-requests/:id/revert-preview
   */
  static previewRevert = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const preview = await ChangeRequestService.previewRevert(id);

      res.json({
        success: true,
        data: preview,
      });
    }
  );

  /**
   * Revert an applied change request
   * POST /api/v1/admin/change-requests/:id/revert
   */
  static revert = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new GatrixError('User not authenticated', 401);
      }

      const newCr = await ChangeRequestService.revertChangeRequest(id, userId);

      logger.info('Reverted', {
        originalId: id,
        newId: newCr.id,
        userId,
      });

      res.json({
        success: true,
        data: newCr,
        message: 'Revert change request created',
      });
    }
  );
  /**
   * Get change request statistics
   * GET /api/v1/admin/change-requests/stats
   */
  static getStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const projectId = req.projectId as string;
      const userId = req.user?.userId;

      if (!userId) {
        throw new GatrixError('User not authenticated', 401);
      }

      const stats = await ChangeRequestService.getChangeRequestCounts(
        projectId,
        userId
      );

      res.json({
        success: true,
        data: stats,
      });
    }
  );

  /**
   * Delete a draft change request
   * DELETE /api/v1/admin/change-requests/:id
   */
  static remove = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      await withMinimumDelay(
        (async () => {
          const cr = await ChangeRequest.query().findById(id);
          if (!cr) {
            throw new GatrixError('Change Request not found', 404);
          }
          if (!['draft', 'rejected', 'conflict'].includes(cr.status)) {
            throw new GatrixError(
              'Only draft, rejected, or conflict change requests can be deleted',
              400
            );
          }

          // Delete related items first
          await ChangeItem.query().where('changeRequestId', id).delete();
          await ActionGroup.query().where('changeRequestId', id).delete();
          await Approval.query().where('changeRequestId', id).delete();
          await ChangeRequest.query().deleteById(id);

          logger.info('Deleted', {
            changeRequestId: id,
            userId: req.user?.userId,
          });
        })()
      );

      res.json({
        success: true,
        message: 'Change request deleted',
      });
    }
  );

  /**
   * Delete a specific change item from a draft change request
   * DELETE /api/v1/admin/change-requests/:id/items/:itemId
   */
  static deleteChangeItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id, itemId } = req.params;

      const cr = await ChangeRequest.query().findById(id);
      if (!cr) {
        throw new GatrixError('Change Request not found', 404);
      }
      if (cr.status !== 'draft') {
        throw new GatrixError(
          'Can only delete items from draft change requests',
          400
        );
      }

      const item = await ChangeItem.query().findById(itemId);
      if (!item || item.changeRequestId !== id) {
        throw new GatrixError('Change Item not found in this request', 404);
      }

      await ChangeItem.query().deleteById(itemId);

      // Check if action group is now empty and delete if so
      if (item.actionGroupId) {
        const remainingItems = await ChangeItem.query().where(
          'actionGroupId',
          item.actionGroupId
        );
        if (remainingItems.length === 0) {
          await ActionGroup.query().deleteById(item.actionGroupId);
        }
      }

      logger.info('Item deleted', {
        changeRequestId: id,
        itemId,
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Change item deleted',
      });
    }
  );

  /**
   * Generate AI summary (title + description) for a CR
   * POST /api/v1/admin/change-requests/:id/generate-summary
   */
  static generateSummary = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      // Load CR with change items
      const cr = await ChangeRequest.query()
        .findById(id)
        .withGraphFetched('[changeItems, actionGroups]');

      if (!cr) {
        throw new GatrixError('Change Request not found', 404);
      }

      const orgId = req.orgId;
      if (!orgId) {
        throw new GatrixError('Organization not found', 400);
      }

      const { AICRSummaryService } =
        await import('../services/ai/ai-cr-summary-service');

      try {
        const language = req.body?.language as string | undefined;

        // Collect environment IDs from draftData keys to resolve display names
        const envIds = new Set<string>();
        (cr.changeItems || []).forEach((item) => {
          if (item.draftData) {
            Object.keys(item.draftData)
              .filter((k) => !k.startsWith('_') && k.length >= 20) // ULID-like keys
              .forEach((k) => envIds.add(k));
          }
        });

        let envNameMap: Record<string, string> = {};
        if (envIds.size > 0) {
          const { Environment } = await import('../models/environment');
          const envs = await Environment.query()
            .whereIn('id', [...envIds])
            .select('id', 'displayName');
          envs.forEach((env) => {
            envNameMap[env.id] = env.displayName;
          });
        }

        const result = await AICRSummaryService.generateSummary(
          orgId,
          {
            changeItems: (cr.changeItems || []).map((item) => ({
              targetTable: item.targetTable,
              targetId: item.targetId,
              displayName: item.displayName,
              opType: item.opType,
              ops: item.ops,
              draftData: item.draftData,
              beforeDraftData: item.beforeDraftData,
            })),
            actionGroups: (cr.actionGroups || []).map((g) => ({
              title: g.title,
              actionType: g.actionType,
            })),
            envNameMap,
          },
          language
        );

        res.json({ success: true, data: result });
      } catch (error: any) {
        if (error.message === 'AI_NOT_CONFIGURED') {
          throw new GatrixError(
            'AI is not configured. Please set up AI settings first.',
            400,
            true,
            'AI_NOT_CONFIGURED'
          );
        }
        throw error;
      }
    }
  );
}
