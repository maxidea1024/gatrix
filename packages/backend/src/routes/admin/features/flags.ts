/**
 * Feature Flags Core Routes
 * API endpoints for feature flag CRUD, strategies, variants, and metrics
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/errorHandler';
import { featureFlagService } from '../../../services/FeatureFlagService';
import { requireEnvironment, getRequestContext } from './_helpers';
import { flagCodeReferencesRouter } from './codeReferences';

const router = Router();

// ==================== Feature Flags ====================

// List feature flags
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const {
      search,
      flagType,
      isEnabled,
      isArchived,
      tags,
      page,
      limit,
      sortBy,
      sortOrder,
      projectId,
    } = req.query;

    const result = await featureFlagService.listFlags({
      environmentId,
      search: search as string,
      flagType: flagType as string,
      isEnabled: isEnabled === 'true' ? true : isEnabled === 'false' ? false : undefined,
      isArchived: isArchived === 'true' ? true : isArchived === 'false' ? false : undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
      projectId: req.projectId,
    });

    res.json({ success: true, data: result });
  })
);

// Create a feature flag
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.createFlag(
      { ...req.body, environmentId, projectId: req.projectId },
      userId!,
      getRequestContext(req)
    );

    res.status(201).json({ success: true, data: { flag } });
  })
);

// Get a single feature flag (MUST be after /segments and /context-fields)
router.get(
  '/:flagName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const flag = await featureFlagService.getFlag(environmentId, req.params.flagName);

    if (!flag) {
      return res.status(404).json({ success: false, error: 'Flag not found' });
    }

    res.json({ success: true, data: { flag } });
  })
);

// Update a feature flag
router.put(
  '/:flagName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.updateFlag(
      environmentId,
      req.params.flagName,
      req.body,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, data: { flag } });
  })
);

// Toggle flag enabled state
router.post(
  '/:flagName/toggle',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Allow environment from body, otherwise use request environment (header)
    const environmentId = req.body.environmentId || req.environmentId;
    const userId = req.user?.id;
    const { isEnabled } = req.body;

    const flag = await featureFlagService.toggleFlag(
      environmentId,
      req.params.flagName,
      isEnabled,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, data: { flag } });
  })
);

// Archive a flag
router.post(
  '/:flagName/archive',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.archiveFlag(
      environmentId,
      req.params.flagName,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, data: { flag } });
  })
);

// Revive an archived flag
router.post(
  '/:flagName/revive',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.reviveFlag(
      environmentId,
      req.params.flagName,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, data: { flag } });
  })
);

// Toggle favorite status
router.post(
  '/:flagName/favorite',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;
    const { isFavorite } = req.body;

    const flag = await featureFlagService.toggleFavorite(
      environmentId,
      req.params.flagName,
      isFavorite,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, data: { flag } });
  })
);

// Mark flag as stale
router.post(
  '/:flagName/mark-stale',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.markAsStale(
      environmentId,
      req.params.flagName,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, data: { flag } });
  })
);

// Unmark flag as stale
router.post(
  '/:flagName/unmark-stale',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.markAsNotStale(
      environmentId,
      req.params.flagName,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, data: { flag } });
  })
);

// Delete a flag
router.delete(
  '/:flagName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    await featureFlagService.deleteFlag(
      environmentId,
      req.params.flagName,
      userId!,
      getRequestContext(req)
    );

    res.json({ success: true, message: 'Flag deleted successfully' });
  })
);

// ==================== Strategies ====================

// Add a strategy to a flag
router.post(
  '/:flagName/strategies',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const strategy = await featureFlagService.addStrategy(
      environmentId,
      req.params.flagName,
      req.body,
      userId!
    );

    res.status(201).json({ success: true, data: { strategy } });
  })
);

// Update all strategies for a flag (bulk replace)
router.put(
  '/:flagName/strategies',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const strategies = await featureFlagService.updateStrategies(
      environmentId,
      req.params.flagName,
      req.body.strategies || [],
      userId!
    );

    res.json({ success: true, data: { strategies } });
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
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;

    const variants = await featureFlagService.updateVariants(
      environmentId,
      req.params.flagName,
      req.body.variants || [],
      userId!,
      req.body.valueType, // Pass valueType to service
      req.body.enabledValue, // Pass enabledValue
      req.body.disabledValue, // Pass disabledValue
      req.body.clearVariantValues // Pass flag to clear existing variant values
    );

    res.json({ success: true, data: { variants } });
  })
);

// ==================== Metrics ====================

// Get metrics for a flag
router.get(
  '/:flagName/metrics',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const { startDate, endDate, appName } = req.query;

    // Parse appName: undefined = all apps, 'null' = only null appName, otherwise specific app
    let appNameFilter: string | null | undefined;
    if (appName === 'null') {
      appNameFilter = null;
    } else if (appName && typeof appName === 'string') {
      appNameFilter = appName;
    }

    const metrics = await featureFlagService.getMetrics(
      environmentId,
      req.params.flagName,
      new Date((startDate as string) || Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date((endDate as string) || Date.now()),
      appNameFilter
    );

    res.json({ success: true, data: { metrics } });
  })
);

// Get app names used in metrics for a flag
router.get(
  '/:flagName/metrics/apps',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const { startDate, endDate } = req.query;

    const appNames = await featureFlagService.getMetricsAppNames(
      environmentId,
      req.params.flagName,
      new Date((startDate as string) || Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date((endDate as string) || Date.now())
    );

    res.json({ success: true, data: { appNames } });
  })
);

// Record metrics for a flag evaluation
router.post(
  '/:flagName/metrics',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const { enabled, variantName } = req.body;

    await featureFlagService.recordMetrics(
      environmentId,
      req.params.flagName,
      enabled,
      variantName
    );

    res.json({ success: true });
  })
);

// ==================== Code References (per-flag) ====================

router.use('/:flagName/code-references', flagCodeReferencesRouter);

export default router;
