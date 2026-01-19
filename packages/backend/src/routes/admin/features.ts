/**
 * Feature Flags Admin Routes
 * API endpoints for managing feature flags
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { featureFlagService } from '../../services/FeatureFlagService';

const router = Router();

// ==================== Feature Flags ====================

// List feature flags
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const { search, flagType, isEnabled, isArchived, tags, page, limit, sortBy, sortOrder } = req.query;

        const result = await featureFlagService.listFlags({
            environment,
            search: search as string,
            flagType: flagType as string,
            isEnabled: isEnabled === 'true' ? true : isEnabled === 'false' ? false : undefined,
            isArchived: isArchived === 'true' ? true : isArchived === 'false' ? false : undefined,
            tags: tags ? (tags as string).split(',') : undefined,
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 50,
            sortBy: sortBy as string,
            sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
        });

        res.json({ success: true, data: result });
    })
);

// Get a single feature flag
router.get(
    '/:flagName',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const flag = await featureFlagService.getFlag(environment, req.params.flagName);

        if (!flag) {
            return res.status(404).json({ success: false, error: 'Flag not found' });
        }

        res.json({ success: true, data: { flag } });
    })
);

// Create a feature flag
router.post(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        const flag = await featureFlagService.createFlag(
            { ...req.body, environment },
            userId!
        );

        res.status(201).json({ success: true, data: { flag } });
    })
);

// Update a feature flag
router.put(
    '/:flagName',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        const flag = await featureFlagService.updateFlag(
            environment,
            req.params.flagName,
            req.body,
            userId!
        );

        res.json({ success: true, data: { flag } });
    })
);

// Toggle flag enabled state
router.post(
    '/:flagName/toggle',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;
        const { isEnabled } = req.body;

        const flag = await featureFlagService.toggleFlag(
            environment,
            req.params.flagName,
            isEnabled,
            userId!
        );

        res.json({ success: true, data: { flag } });
    })
);

// Archive a flag
router.post(
    '/:flagName/archive',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        const flag = await featureFlagService.archiveFlag(
            environment,
            req.params.flagName,
            userId!
        );

        res.json({ success: true, data: { flag } });
    })
);

// Revive an archived flag
router.post(
    '/:flagName/revive',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        const flag = await featureFlagService.reviveFlag(
            environment,
            req.params.flagName,
            userId!
        );

        res.json({ success: true, data: { flag } });
    })
);

// Delete a flag
router.delete(
    '/:flagName',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        await featureFlagService.deleteFlag(
            environment,
            req.params.flagName,
            userId!
        );

        res.json({ success: true, message: 'Flag deleted successfully' });
    })
);

// ==================== Strategies ====================

// Add a strategy to a flag
router.post(
    '/:flagName/strategies',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        const strategy = await featureFlagService.addStrategy(
            environment,
            req.params.flagName,
            req.body,
            userId!
        );

        res.status(201).json({ success: true, data: { strategy } });
    })
);

// Update a strategy
router.put(
    '/:flagName/strategies/:strategyId',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;

        const strategy = await featureFlagService.updateStrategy(
            req.params.strategyId,
            req.body,
            userId!
        );

        res.json({ success: true, data: { strategy } });
    })
);

// Delete a strategy
router.delete(
    '/:flagName/strategies/:strategyId',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;

        await featureFlagService.deleteStrategy(req.params.strategyId, userId!);

        res.json({ success: true, message: 'Strategy deleted successfully' });
    })
);

// ==================== Variants ====================

// Update variants for a flag (bulk replace)
router.put(
    '/:flagName/variants',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        const variants = await featureFlagService.updateVariants(
            environment,
            req.params.flagName,
            req.body.variants || [],
            userId!
        );

        res.json({ success: true, data: { variants } });
    })
);

// ==================== Segments ====================

// List segments
router.get(
    '/segments/list',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const { search } = req.query;

        const segments = await featureFlagService.listSegments(environment, search as string);

        res.json({ success: true, data: { segments } });
    })
);

// Get segment by ID
router.get(
    '/segments/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const segment = await featureFlagService.getSegment(req.params.id);

        if (!segment) {
            return res.status(404).json({ success: false, error: 'Segment not found' });
        }

        res.json({ success: true, data: { segment } });
    })
);

// Create a segment
router.post(
    '/segments',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const userId = req.user?.id;

        const segment = await featureFlagService.createSegment(
            { ...req.body, environment },
            userId!
        );

        res.status(201).json({ success: true, data: { segment } });
    })
);

// Update a segment
router.put(
    '/segments/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;

        const segment = await featureFlagService.updateSegment(
            req.params.id,
            req.body,
            userId!
        );

        res.json({ success: true, data: { segment } });
    })
);

// Delete a segment
router.delete(
    '/segments/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;

        await featureFlagService.deleteSegment(req.params.id, userId!);

        res.json({ success: true, message: 'Segment deleted successfully' });
    })
);

// ==================== Context Fields ====================

// List context fields
router.get(
    '/context-fields/list',
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
        const fields = await featureFlagService.listContextFields();

        res.json({ success: true, data: { fields } });
    })
);

// Create a context field
router.post(
    '/context-fields',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;

        const field = await featureFlagService.createContextField(req.body, userId!);

        res.status(201).json({ success: true, data: { field } });
    })
);

// Update a context field
router.put(
    '/context-fields/:fieldName',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;

        const field = await featureFlagService.updateContextField(
            req.params.fieldName,
            req.body,
            userId!
        );

        res.json({ success: true, data: { field } });
    })
);

// Delete a context field
router.delete(
    '/context-fields/:fieldName',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.id;

        await featureFlagService.deleteContextField(req.params.fieldName, userId!);

        res.json({ success: true, message: 'Context field deleted successfully' });
    })
);

// ==================== Metrics ====================

// Get metrics for a flag
router.get(
    '/:flagName/metrics',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const environment = req.environment || 'development';
        const { startDate, endDate } = req.query;

        const metrics = await featureFlagService.getMetrics(
            environment,
            req.params.flagName,
            new Date(startDate as string || Date.now() - 7 * 24 * 60 * 60 * 1000),
            new Date(endDate as string || Date.now())
        );

        res.json({ success: true, data: { metrics } });
    })
);

export default router;
