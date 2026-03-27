/**
 * Feature Flags Core Routes
 * API endpoints for feature flag CRUD, strategies, variants, and metrics
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { featureFlagService } from '../../../services/feature-flag-service';
import { requireEnvironment, getRequestContext } from './_helpers';
import { flagCodeReferencesRouter } from './code-references';

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
      isEnabled:
        isEnabled === 'true' ? true : isEnabled === 'false' ? false : undefined,
      isArchived:
        isArchived === 'true'
          ? true
          : isArchived === 'false'
            ? false
            : undefined,
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

// Get all pending drafts for feature flags in the current project
router.get(
  '/pending-drafts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ChangeRequestService } = await import('../../../services/change-request-service');
    const drafts = await ChangeRequestService.getAllPendingDraftsForTable(
      'g_feature_flags',
      req.projectId!
    );

    res.json({ success: true, data: drafts });
  })
);

// Get a single feature flag (MUST be after /segments and /context-fields)
router.get(
  '/:flagName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const flag = await featureFlagService.getFlag(
      environmentId,
      req.params.flagName,
      req.projectId
    );

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

// ==================== Change Request Integration ====================

// Save feature flag draft data to a Change Request
router.post(
  '/:flagName/change-request',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const activeEnvironmentId = requireEnvironment(req, res);
    if (!activeEnvironmentId) return;

    const userId = req.user?.id;
    const { draftData, targetEnvironmentId } = req.body;

    // Use target environment if explicitly provided (e.g., modifying Production
    // while Development is active), otherwise fall back to active environment
    const environmentId = targetEnvironmentId || activeEnvironmentId;

    if (!draftData || typeof draftData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'draftData is required',
      });
    }

    // Get flagId from flagName
    const flag = await featureFlagService.getFlag(
      environmentId,
      req.params.flagName,
      req.projectId
    );
    if (!flag) {
      return res.status(404).json({ success: false, error: 'Flag not found' });
    }

    const { ChangeRequestService } =
      await import('../../../services/change-request-service');

    // Build beforeDraftData with matching environment key structure for accurate diff comparison
    // draftData is structured as { envId: { strategies, variants, isEnabled, ... } }
    // so beforeDraftData must use the same structure
    const beforeDraftData: Record<string, any> = {};
    const envKeys = Object.keys(draftData).filter(k => !k.startsWith('_'));
    for (const envKey of envKeys) {
      // The flag object itself represents the current state for this environment
      const { id, flagName, createdAt, updatedAt, createdBy, updatedBy, environmentId: eid, projectId, ...envFields } = flag as any;
      beforeDraftData[envKey] = envFields;
    }

    const result = await ChangeRequestService.upsertDraftDataItem(
      userId!,
      environmentId,
      'g_feature_flags',
      flag.id,
      { ...draftData, _flagName: flag.flagName },
      `[feature_flags] Update: ${flag.flagName}`,
      beforeDraftData
    );

    res.json({ success: true, data: result });
  })
);

// Get pending Change Request for a feature flag
router.get(
  '/:flagName/pending-change-request',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    // Get flagId from flagName
    const flag = await featureFlagService.getFlag(
      environmentId,
      req.params.flagName,
      req.projectId
    );
    if (!flag) {
      return res.status(404).json({ success: false, error: 'Flag not found' });
    }

    const { ChangeRequestService } =
      await import('../../../services/change-request-service');

    const pendingDraft = await ChangeRequestService.getPendingDraftForTarget(
      'g_feature_flags',
      flag.id
    );

    res.json({ success: true, data: pendingDraft });
  })
);

// ==================== Code References (per-flag) ====================

router.use('/:flagName/code-references', flagCodeReferencesRouter);

export default router;
