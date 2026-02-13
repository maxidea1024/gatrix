import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { releaseFlowService } from '../services/ReleaseFlowService';
import { GatrixError } from '../middleware/errorHandler';

export class ReleaseFlowController {
    /**
     * List all release flow templates
     */
    static async listTemplates(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const search = req.query.search as string;
            const templates = await releaseFlowService.getTemplates();

            // Basic filtering if search provided
            let filtered = templates;
            if (search) {
                const s = search.toLowerCase();
                filtered = templates.filter(t =>
                    t.flowName.toLowerCase().includes(s) ||
                    t.displayName?.toLowerCase().includes(s) ||
                    t.description?.toLowerCase().includes(s)
                );
            }

            res.json({
                success: true,
                data: filtered,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a new release flow template
     */
    static async createTemplate(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const template = await releaseFlowService.createTemplate(req.body, userId);
            res.status(201).json({
                success: true,
                data: template,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get a single release flow template by ID (with milestones)
     */
    static async getTemplate(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { id } = req.params;
            const template = await releaseFlowService.getTemplateById(id);
            res.json({
                success: true,
                data: template,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update an existing release flow template
     */
    static async updateTemplate(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { id } = req.params;
            const template = await releaseFlowService.updateTemplate(id, req.body, userId);
            res.json({
                success: true,
                data: template,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete (archive) a release flow template
     */
    static async deleteTemplate(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { id } = req.params;
            await releaseFlowService.deleteTemplate(id, userId);
            res.json({
                success: true,
                message: 'Template archived successfully',
            });
        } catch (error) {
            next(error);
        }
    }


    /**
     * Get a release flow plan for a specific feature flag and environment
     */
    static async getPlan(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { flagId, environment } = req.params;
            const plan = await releaseFlowService.getPlanForFlag(flagId, environment);

            res.json({
                success: true,
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Apply a template to a feature flag
     */
    static async applyTemplate(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { flagId, environment, templateId } = req.body;
            if (!flagId || !environment || !templateId) {
                throw new GatrixError('flagId, environment, and templateId are required', 400);
            }

            const plan = await releaseFlowService.applyTemplateToFlag(flagId, environment, templateId, userId);
            res.status(201).json({
                success: true,
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Start/Activate a milestone in a release plan
     */
    static async startMilestone(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { planId, milestoneId } = req.params;
            const plan = await releaseFlowService.startMilestone(planId, milestoneId, userId);

            res.json({
                success: true,
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Start a release plan (first milestone)
     */
    static async startPlan(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { id } = req.params;
            const plan = await releaseFlowService.startPlan(id, userId);

            res.json({
                success: true,
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Pause a running release plan
     */
    static async pausePlan(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { id } = req.params;
            const plan = await releaseFlowService.pausePlan(id, userId);

            res.json({
                success: true,
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Resume a paused release plan
     */
    static async resumePlan(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { id } = req.params;
            const plan = await releaseFlowService.resumePlan(id, userId);

            res.json({
                success: true,
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Manually progress to the next milestone
     */
    static async progressToNext(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { id } = req.params;
            const plan = await releaseFlowService.progressToNextMilestone(id, userId);

            res.json({
                success: true,
                data: plan,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Set transition condition on a milestone
     */
    static async setTransitionCondition(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { milestoneId } = req.params;
            const { intervalMinutes } = req.body;

            if (!intervalMinutes || intervalMinutes < 1) {
                throw new GatrixError('intervalMinutes must be at least 1', 400);
            }

            const milestone = await releaseFlowService.setTransitionCondition(
                milestoneId,
                { intervalMinutes },
                userId
            );

            res.json({
                success: true,
                data: milestone,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Remove transition condition from a milestone
     */
    static async removeTransitionCondition(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new GatrixError('Unauthorized', 401);

            const { milestoneId } = req.params;
            const milestone = await releaseFlowService.removeTransitionCondition(milestoneId, userId);

            res.json({
                success: true,
                data: milestone,
            });
        } catch (error) {
            next(error);
        }
    }
}
