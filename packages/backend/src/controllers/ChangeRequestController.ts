import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { ChangeRequestService } from '../services/ChangeRequestService';
import { ChangeRequest } from '../models/ChangeRequest';
import { ChangeItem } from '../models/ChangeItem';
import { Approval } from '../models/Approval';
import logger from '../config/logger';

// Helper to get environment from request
function getEnvironment(req: AuthenticatedRequest): string {
    const env = req.environment;
    if (!env) {
        throw new GatrixError('Environment not specified', 400);
    }
    return env;
}

export class ChangeRequestController {
    /**
     * Get list of change requests for current environment
     * GET /api/v1/admin/change-requests
     */
    static list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = getEnvironment(req);
        const status = req.query.status as string | undefined;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;
        const userId = req.user?.id;

        let query = ChangeRequest.query()
            .where('environment', environment)
            .withGraphFetched('[requester, rejector, environmentModel, changeItems, approvals]')
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .offset(offset);

        if (status) {
            query = query.where('status', status);
            // If filtering by draft, only show own drafts
            if (status === 'draft' && userId) {
                query = query.where('requesterId', userId);
            }
        } else {
            // When showing all statuses, exclude others' drafts
            // Show: all non-draft OR (draft AND own)
            query = query.where((builder) => {
                builder.whereNot('status', 'draft')
                    .orWhere((subBuilder) => {
                        subBuilder.where('status', 'draft').where('requesterId', userId || 0);
                    });
            });
        }

        const [items, countResult] = await Promise.all([
            query,
            ChangeRequest.query()
                .where('environment', environment)
                .where((builder) => {
                    if (status) {
                        builder.where('status', status);
                        if (status === 'draft' && userId) {
                            builder.where('requesterId', userId);
                        }
                    } else {
                        builder.whereNot('status', 'draft')
                            .orWhere((subBuilder) => {
                                subBuilder.where('status', 'draft').where('requesterId', userId || 0);
                            });
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
    });

    /**
     * Get single change request details
     * GET /api/v1/admin/change-requests/:id
     */
    static getById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;

        let cr = await ChangeRequest.query()
            .findById(id)
            .withGraphFetched('[requester, rejector, environmentModel, changeItems, approvals.approver, executor]');

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
    });

    /**
     * Update change request metadata (Draft only)
     * PATCH /api/v1/admin/change-requests/:id
     */
    static updateMetadata = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;
        const { title, description, reason, impactAnalysis, priority, category } = req.body;

        const updated = await ChangeRequestService.updateChangeRequestMetadata(id, {
            title,
            description,
            reason,
            impactAnalysis,
            priority,
            category,
        });

        res.json({
            success: true,
            data: updated,
            message: 'Change request metadata updated',
        });
    });

    /**
     * Submit change request (Draft -> Open)
     * POST /api/v1/admin/change-requests/:id/submit
     */
    static submit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

        logger.info('[ChangeRequest] Submitted', { changeRequestId: id, userId: req.user?.userId });

        res.json({
            success: true,
            data: submitted,
            message: 'Change request submitted for review',
        });
    });

    /**
     * Approve change request
     * POST /api/v1/admin/change-requests/:id/approve
     */
    static approve = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;
        const { comment } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            throw new GatrixError('User not authenticated', 401);
        }

        const approved = await ChangeRequestService.approveChangeRequest(id, userId, comment);

        logger.info('[ChangeRequest] Approved', { changeRequestId: id, approverId: userId });

        res.json({
            success: true,
            data: approved,
            message: approved.status === 'approved'
                ? 'Change request fully approved'
                : 'Approval recorded, waiting for more approvers',
        });
    });

    /**
     * Reject change request
     * POST /api/v1/admin/change-requests/:id/reject
     */
    static reject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;
        const { comment } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            throw new GatrixError('User not authenticated', 401);
        }

        if (!comment) {
            throw new GatrixError('Rejection comment is required', 400);
        }

        const rejected = await ChangeRequestService.rejectChangeRequest(id, userId, comment);

        logger.info('[ChangeRequest] Rejected', { changeRequestId: id, rejectorId: userId });

        res.json({
            success: true,
            data: rejected,
            message: 'Change request rejected',
        });
    });

    /**
     * Reopen rejected change request (Reset to Draft)
     * POST /api/v1/admin/change-requests/:id/reopen
     */
    static reopen = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            throw new GatrixError('User not authenticated', 401);
        }

        const reopened = await ChangeRequestService.reopenChangeRequest(id, userId);

        logger.info('[ChangeRequest] Reopened', { changeRequestId: id, userId });

        res.json({
            success: true,
            data: reopened,
            message: 'Change request reopened as draft',
        });
    });

    /**
     * Execute approved change request
     * POST /api/v1/admin/change-requests/:id/execute
     */
    static execute = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            throw new GatrixError('User not authenticated', 401);
        }

        try {
            const executed = await ChangeRequestService.executeChangeRequest(id, userId);

            logger.info('[ChangeRequest] Executed', { changeRequestId: id, executorId: userId });

            res.json({
                success: true,
                data: executed,
                message: 'Change request applied successfully',
            });
        } catch (error: any) {
            // Check if it's a conflict error
            if (error instanceof GatrixError && error.code === 'CR_DATA_CONFLICT') {
                // Mark CR as rejected automatically since execution failed significantly
                try {
                    await ChangeRequestService.rejectChangeRequest(id, userId, 'System: Data conflict detected during execution (Live data changed)');
                } catch (rejectError) {
                    logger.error('[ChangeRequest] Failed to auto-reject conflicted CR', rejectError);
                }
                throw error; // Re-throw to be handled by global error handler
            }
            throw error;
        }
    });

    /**
     * Delete draft change request
     * DELETE /api/v1/admin/change-requests/:id
     */
    static delete = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;

        const cr = await ChangeRequest.query().findById(id);
        if (!cr) {
            throw new GatrixError('Change Request not found', 404);
        }

        if (cr.status !== 'draft' && cr.status !== 'rejected') {
            throw new GatrixError('Only draft or rejected change requests can be deleted', 400);
        }

        // Delete related items and approvals first
        await ChangeItem.query().where('changeRequestId', id).delete();
        await Approval.query().where('changeRequestId', id).delete();
        await ChangeRequest.query().deleteById(id);

        logger.info('[ChangeRequest] Deleted', { changeRequestId: id, userId: req.user?.userId });

        res.json({
            success: true,
            message: 'Change request deleted',
        });
    });

    /**
     * Get my pending change requests (as requester or approver)
     * GET /api/v1/admin/change-requests/my
     */
    static getMyRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = getEnvironment(req);
        const userId = req.user?.userId;

        if (!userId) {
            throw new GatrixError('User not authenticated', 401);
        }

        const asRequester = await ChangeRequest.query()
            .where('environment', environment)
            .where('requesterId', userId)
            .whereIn('status', ['draft', 'open', 'rejected'])
            .withGraphFetched('changeItems')
            .orderBy('updatedAt', 'desc');

        const pendingApproval = await ChangeRequest.query()
            .where('environment', environment)
            .where('status', 'open')
            .whereNotIn('id', (qb) => {
                qb.select('changeRequestId').from('g_approvals').where('approverId', userId);
            })
            .withGraphFetched('[requester, changeItems]')
            .orderBy('updatedAt', 'desc');

        res.json({
            success: true,
            data: {
                myRequests: asRequester,
                pendingApproval,
            },
        });
    });

    /**
     * Rollback an applied change request
     * POST /api/v1/admin/change-requests/:id/rollback
     */
    static rollback = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            throw new GatrixError('User not authenticated', 401);
        }

        const newCr = await ChangeRequestService.rollbackChangeRequest(id, userId);

        logger.info('[ChangeRequest] Rolled back', { originalId: id, newId: newCr.id, userId });

        res.json({
            success: true,
            data: newCr,
            message: 'Rollback change request created',
        });
    });
}
