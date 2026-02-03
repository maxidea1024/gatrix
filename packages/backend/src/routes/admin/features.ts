/**
 * Feature Flags Admin Routes
 * API endpoints for managing feature flags
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { featureFlagService } from '../../services/FeatureFlagService';
import { FeatureFlagTypeModel } from '../../models/FeatureFlagType';
import { networkTrafficService } from '../../services/NetworkTrafficService';

const router = Router();

// ==================== Network Traffic ====================

// Get detailed network traffic data (includes appName)
router.get(
  '/network/traffic',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    // Default to last 24 hours
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getDetailedTraffic({
      environments: environments ? (environments as string).split(',') : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  })
);

// Get aggregated network traffic data for charts
router.get(
  '/network/traffic/aggregated',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getAggregatedTraffic({
      environments: environments ? (environments as string).split(',') : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  })
);

// Get aggregated network traffic data by app for charts
router.get(
  '/network/traffic/aggregated/by-app',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getAggregatedTrafficByApp({
      environments: environments ? (environments as string).split(',') : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  })
);

// Get traffic summary
router.get(
  '/network/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const summary = await networkTrafficService.getTrafficSummary({
      environments: environments ? (environments as string).split(',') : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { summary } });
  })
);

// Get active applications
router.get(
  '/network/applications',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const applications = await networkTrafficService.getActiveApplications({
      environments: environments ? (environments as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { applications } });
  })
);

// Get flag evaluation summary (from g_feature_metrics)
router.get(
  '/network/evaluations',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const evaluations = await networkTrafficService.getFlagEvaluationSummary({
      environments: environments ? (environments as string).split(',') : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { evaluations } });
  })
);

// Get flag evaluation time series (from g_feature_metrics)
router.get(
  '/network/evaluations/timeseries',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const timeseries = await networkTrafficService.getFlagEvaluationTimeSeries({
      environments: environments ? (environments as string).split(',') : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { timeseries } });
  })
);

// Get flag evaluation time series by app (from g_feature_metrics)
router.get(
  '/network/evaluations/timeseries/by-app',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const timeseries = await networkTrafficService.getFlagEvaluationTimeSeriesByApp({
      environments: environments ? (environments as string).split(',') : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { timeseries } });
  })
);

// ==================== Flag Types ====================

// List all flag types
router.get(
  '/types',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const types = await FeatureFlagTypeModel.findAll();
    res.json({ success: true, data: { types } });
  })
);

// Update a flag type
router.put(
  '/types/:flagType',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const flagType = await FeatureFlagTypeModel.update(req.params.flagType, req.body);
    res.json({ success: true, data: { flagType } });
  })
);

// ==================== Segments (MUST be before /:flagName routes) ====================

// List segments (segments are now global)
router.get(
  '/segments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search } = req.query;

    const segments = await featureFlagService.listSegments(search as string);

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

// Create a segment (segments are now global)
router.post(
  '/segments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const segment = await featureFlagService.createSegment(req.body, userId!);

    res.status(201).json({ success: true, data: { segment } });
  })
);

// Update a segment
router.put(
  '/segments/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const segment = await featureFlagService.updateSegment(req.params.id, req.body, userId!);

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

// ==================== Context Fields (MUST be before /:flagName routes) ====================

// List context fields
router.get(
  '/context-fields',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search } = req.query;
    const fields = await featureFlagService.listContextFields(search as string | undefined);

    res.json({ success: true, data: { contextFields: fields } });
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

// ==================== Feature Flags ====================

// Helper function to validate environment
const requireEnvironment = (req: AuthenticatedRequest, res: Response): string | null => {
  const environment = req.environment;
  if (!environment) {
    res.status(400).json({
      success: false,
      error: 'Environment is required (x-environment header)',
    });
    return null;
  }
  return environment;
};

// List feature flags
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const { search, flagType, flagUsage, isEnabled, isArchived, tags, page, limit, sortBy, sortOrder } =
      req.query;

    const result = await featureFlagService.listFlags({
      environment,
      search: search as string,
      flagType: flagType as string,
      flagUsage: flagUsage as 'flag' | 'remoteConfig',
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

// Create a feature flag
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.createFlag({ ...req.body, environment }, userId!);

    res.status(201).json({ success: true, data: { flag } });
  })
);

// Get a single feature flag (MUST be after /segments and /context-fields)
router.get(
  '/:flagName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const flag = await featureFlagService.getFlag(environment, req.params.flagName);

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
    const environment = requireEnvironment(req, res);
    if (!environment) return;

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
    // Allow environment from body, otherwise use request environment (header)
    const environment = req.body.environment || req.environment;
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
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.archiveFlag(environment, req.params.flagName, userId!);

    res.json({ success: true, data: { flag } });
  })
);

// Revive an archived flag
router.post(
  '/:flagName/revive',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.reviveFlag(environment, req.params.flagName, userId!);

    res.json({ success: true, data: { flag } });
  })
);

// Toggle favorite status
router.post(
  '/:flagName/favorite',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;
    const { isFavorite } = req.body;

    const flag = await featureFlagService.toggleFavorite(
      environment,
      req.params.flagName,
      isFavorite,
      userId!
    );

    res.json({ success: true, data: { flag } });
  })
);

// Mark flag as stale
router.post(
  '/:flagName/mark-stale',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.markAsStale(environment, req.params.flagName, userId!);

    res.json({ success: true, data: { flag } });
  })
);

// Unmark flag as stale
router.post(
  '/:flagName/unmark-stale',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.markAsNotStale(environment, req.params.flagName, userId!);

    res.json({ success: true, data: { flag } });
  })
);

// Delete a flag
router.delete(
  '/:flagName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    await featureFlagService.deleteFlag(environment, req.params.flagName, userId!);

    res.json({ success: true, message: 'Flag deleted successfully' });
  })
);

// ==================== Strategies ====================

// Add a strategy to a flag
router.post(
  '/:flagName/strategies',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

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

// Update all strategies for a flag (bulk replace)
router.put(
  '/:flagName/strategies',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const strategies = await featureFlagService.updateStrategies(
      environment,
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
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const variants = await featureFlagService.updateVariants(
      environment,
      req.params.flagName,
      req.body.variants || [],
      userId!,
      req.body.variantType, // Pass variantType to service
      req.body.baselinePayload, // Pass baselinePayload to service
      req.body.clearVariantPayloads // Pass flag to clear existing variant payloads
    );

    res.json({ success: true, data: { variants } });
  })
);

// ==================== Metrics ====================

// Get metrics for a flag
router.get(
  '/:flagName/metrics',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const { startDate, endDate, appName } = req.query;

    // Parse appName: undefined = all apps, 'null' = only null appName, otherwise specific app
    let appNameFilter: string | null | undefined;
    if (appName === 'null') {
      appNameFilter = null;
    } else if (appName && typeof appName === 'string') {
      appNameFilter = appName;
    }

    const metrics = await featureFlagService.getMetrics(
      environment,
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
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const { startDate, endDate } = req.query;

    const appNames = await featureFlagService.getMetricsAppNames(
      environment,
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
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const { enabled, variantName } = req.body;

    await featureFlagService.recordMetrics(environment, req.params.flagName, enabled, variantName);

    res.json({ success: true });
  })
);

// ==================== Playground ====================

// Evaluate all flags with custom context (for playground testing)
router.post(
  '/playground',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, context, flagNames } = req.body;

    if (!environments || !Array.isArray(environments) || environments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one environment is required',
      });
    }

    const results: Record<string, any[]> = {};

    // Load all segments (global)
    const segments = await featureFlagService.listSegments();
    const segmentsMap = new Map(segments.map((s) => [s.segmentName, s]));

    // If specific flags are requested, create a Set for faster lookup
    const flagNamesSet = flagNames && Array.isArray(flagNames) && flagNames.length > 0
      ? new Set(flagNames)
      : null;

    for (const env of environments) {
      try {
        // Load all flags for this environment
        const flagsResult = await featureFlagService.listFlags({
          environment: env,
          isArchived: false,
          page: 1,
          limit: 10000,
        });

        const envResults: any[] = [];

        for (const flagSummary of flagsResult.data) {
          // Skip if specific flags are requested and this flag is not in the list
          if (flagNamesSet && !flagNamesSet.has(flagSummary.flagName)) {
            continue;
          }

          // Get detailed flag info
          const flag = await featureFlagService.getFlag(env, flagSummary.flagName);
          if (!flag) continue;

          // Evaluate the flag
          const evalResult = evaluateFlagWithDetails(flag, context || {}, segmentsMap);

          envResults.push({
            flagName: flag.flagName,
            displayName: flag.displayName,
            flagUsage: flag.flagUsage,
            enabled: evalResult.enabled,
            variant: evalResult.variant,
            reason: evalResult.reason,
            reasonDetails: evalResult.reasonDetails,
            evaluationSteps: evalResult.evaluationSteps,
          });
        }

        // Sort by flag name
        envResults.sort((a, b) => a.flagName.localeCompare(b.flagName));
        results[env] = envResults;
      } catch (error: any) {
        results[env] = [];
      }
    }

    res.json({ success: true, data: { results } });
  })
);

// Helper function for detailed flag evaluation
function evaluateFlagWithDetails(
  flag: any,
  context: Record<string, any>,
  segmentsMap: Map<string, any>
): {
  enabled: boolean;
  variant?: { name: string; payload?: any };
  reason: string;
  reasonDetails?: any;
  evaluationSteps?: any[];
} {
  const evaluationSteps: any[] = [];

  // Step 2: Check if flag is enabled in environment
  // flag.isEnabled is already the correct value for the requested environment (set by getFlag)
  if (!flag.isEnabled) {
    evaluationSteps.push({
      step: 'ENVIRONMENT_CHECK',
      passed: false,
      message: 'Flag is disabled in this environment',
    });
    return { enabled: false, reason: 'FLAG_DISABLED', evaluationSteps };
  }
  evaluationSteps.push({
    step: 'ENVIRONMENT_CHECK',
    passed: true,
    message: 'Flag is enabled in this environment',
  });

  const strategies = flag.strategies || [];

  // Step 3: Check if strategies exist
  if (strategies.length === 0) {
    evaluationSteps.push({
      step: 'STRATEGY_COUNT',
      passed: true,
      message: 'No strategies defined - enabled by default',
    });
    const variant = selectVariantForFlag(flag, context);
    return {
      enabled: true,
      variant,
      reason: 'NO_STRATEGIES',
      evaluationSteps,
    };
  }
  evaluationSteps.push({
    step: 'STRATEGY_COUNT',
    passed: true,
    message: `${strategies.length} strategy(s) to evaluate`,
  });

  // Step 4+: Evaluate each strategy
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    const strategyStep: any = {
      step: 'STRATEGY_EVALUATION',
      strategyIndex: i,
      strategyName: strategy.strategyName,
      isEnabled: strategy.isEnabled,
      checks: [],
    };

    if (!strategy.isEnabled) {
      strategyStep.passed = null; // Skipped
      strategyStep.message = 'Strategy is disabled - skipped';
      evaluationSteps.push(strategyStep);
      continue;
    }

    // Evaluate segments
    let segmentsPassed = true;
    if (strategy.segments && strategy.segments.length > 0) {
      for (const segmentName of strategy.segments) {
        const segment = segmentsMap.get(segmentName);
        if (!segment) {
          strategyStep.checks.push({
            type: 'SEGMENT',
            name: segmentName,
            passed: true,
            message: 'Segment not found - skipped',
          });
          continue;
        }

        if (segment.constraints && segment.constraints.length > 0) {
          for (const constraint of segment.constraints) {
            const constraintPassed = evaluateConstraint(constraint, context);
            strategyStep.checks.push({
              type: 'SEGMENT_CONSTRAINT',
              segment: segmentName,
              constraint: constraint,
              passed: constraintPassed,
              contextValue: getContextValue(constraint.contextName, context),
            });
            if (!constraintPassed) {
              segmentsPassed = false;
            }
          }
        }
      }
    }

    // Evaluate strategy constraints
    let constraintsPassed = true;
    if (strategy.constraints && strategy.constraints.length > 0) {
      for (const constraint of strategy.constraints) {
        const constraintPassed = evaluateConstraint(constraint, context);
        strategyStep.checks.push({
          type: 'STRATEGY_CONSTRAINT',
          constraint: constraint,
          passed: constraintPassed,
          contextValue: getContextValue(constraint.contextName, context),
        });
        if (!constraintPassed) {
          constraintsPassed = false;
        }
      }
    }

    // Evaluate rollout
    let rolloutPassed = true;
    const rollout = strategy.parameters?.rollout ?? 100;
    if (rollout < 100) {
      const stickiness = strategy.parameters?.stickiness || 'default';
      const groupId = strategy.parameters?.groupId || flag.flagName;
      const percentage = calculatePercentage(context, stickiness, groupId);
      rolloutPassed = percentage <= rollout;
      strategyStep.checks.push({
        type: 'ROLLOUT',
        rollout: rollout,
        percentage: percentage,
        passed: rolloutPassed,
      });
    }

    // Determine if strategy matched
    const strategyMatched = segmentsPassed && constraintsPassed && rolloutPassed;
    strategyStep.passed = strategyMatched;
    strategyStep.message = strategyMatched
      ? 'All conditions met'
      : 'One or more conditions failed';
    evaluationSteps.push(strategyStep);

    if (strategyMatched) {
      const variant = selectVariantForFlag(flag, context, strategy);
      return {
        enabled: true,
        variant,
        reason: 'STRATEGY_MATCHED',
        reasonDetails: {
          strategyName: strategy.strategyName,
          strategyIndex: i,
          constraints: strategy.constraints,
          segments: strategy.segments,
        },
        evaluationSteps,
      };
    }
  }

  // No strategy matched
  return {
    enabled: false,
    reason: 'NO_MATCHING_STRATEGY',
    reasonDetails: {
      strategiesCount: strategies.length,
    },
    evaluationSteps,
  };
}

function evaluateStrategyWithDetails(
  strategy: any,
  context: Record<string, any>,
  flag: any,
  segmentsMap: Map<string, any>,
  strategyIndex: number
): { matched: boolean; failReason?: string; details?: any } {
  // Check segments
  if (strategy.segments && strategy.segments.length > 0) {
    for (const segmentName of strategy.segments) {
      const segment = segmentsMap.get(segmentName);
      if (!segment) continue;

      if (segment.constraints && segment.constraints.length > 0) {
        for (const constraint of segment.constraints) {
          if (!evaluateConstraint(constraint, context)) {
            return {
              matched: false,
              failReason: 'SEGMENT_NOT_MATCHED',
              details: {
                failedSegment: segmentName,
                failedConstraint: constraint,
              },
            };
          }
        }
      }
    }
  }

  // Check constraints
  if (strategy.constraints && strategy.constraints.length > 0) {
    for (const constraint of strategy.constraints) {
      if (!evaluateConstraint(constraint, context)) {
        return {
          matched: false,
          failReason: 'CONSTRAINT_NOT_MATCHED',
          details: { failedConstraint: constraint },
        };
      }
    }
  }

  // Check rollout
  const rollout = strategy.parameters?.rollout ?? 100;
  if (rollout < 100) {
    const stickiness = strategy.parameters?.stickiness || 'default';
    const groupId = strategy.parameters?.groupId || flag.flagName;
    const percentage = calculatePercentage(context, stickiness, groupId);
    if (percentage > rollout) {
      return {
        matched: false,
        failReason: 'ROLLOUT_EXCLUDED',
        details: { rollout, percentage },
      };
    }
  }

  return { matched: true };
}

function evaluateConstraint(constraint: any, context: Record<string, any>): boolean {
  const contextValue = getContextValue(constraint.contextName, context);
  if (contextValue === undefined) {
    return constraint.inverted ? true : false;
  }

  const stringValue = String(contextValue);
  const compareValue = constraint.caseInsensitive ? stringValue.toLowerCase() : stringValue;
  const targetValue = constraint.value
    ? constraint.caseInsensitive
      ? constraint.value.toLowerCase()
      : constraint.value
    : '';
  const targetValues =
    constraint.values?.map((v: string) => (constraint.caseInsensitive ? v.toLowerCase() : v)) || [];

  let result = false;

  switch (constraint.operator) {
    case 'str_eq':
      result = compareValue === targetValue;
      break;
    case 'str_neq':
      result = compareValue !== targetValue;
      break;
    case 'str_contains':
      result = compareValue.includes(targetValue);
      break;
    case 'str_starts_with':
      result = compareValue.startsWith(targetValue);
      break;
    case 'str_ends_with':
      result = compareValue.endsWith(targetValue);
      break;
    case 'str_in':
      result = targetValues.includes(compareValue);
      break;
    case 'str_not_in':
      result = !targetValues.includes(compareValue);
      break;
    case 'str_regex':
      try {
        const flags = constraint.caseInsensitive ? 'i' : '';
        const regex = new RegExp(constraint.value || '', flags);
        result = regex.test(stringValue);
      } catch {
        result = false;
      }
      break;
    case 'num_eq':
      result = Number(contextValue) === Number(constraint.value);
      break;
    case 'num_gt':
      result = Number(contextValue) > Number(constraint.value);
      break;
    case 'num_gte':
      result = Number(contextValue) >= Number(constraint.value);
      break;
    case 'num_lt':
      result = Number(contextValue) < Number(constraint.value);
      break;
    case 'num_lte':
      result = Number(contextValue) <= Number(constraint.value);
      break;
    case 'bool_is':
      result = Boolean(contextValue) === (constraint.value === 'true');
      break;
    case 'date_gt':
      result = new Date(stringValue) > new Date(targetValue);
      break;
    case 'date_gte':
      result = new Date(stringValue) >= new Date(targetValue);
      break;
    case 'date_lt':
      result = new Date(stringValue) < new Date(targetValue);
      break;
    case 'date_lte':
      result = new Date(stringValue) <= new Date(targetValue);
      break;
    default:
      result = false;
  }

  return constraint.inverted ? !result : result;
}

function getContextValue(name: string, context: Record<string, any>): any {
  switch (name) {
    case 'userId':
      return context.userId;
    case 'sessionId':
      return context.sessionId;
    case 'appName':
      return context.appName;
    case 'appVersion':
      return context.appVersion;
    case 'remoteAddress':
      return context.remoteAddress;
    default:
      return context.properties?.[name] ?? context[name];
  }
}

function calculatePercentage(
  context: Record<string, any>,
  stickiness: string,
  groupId: string
): number {
  let stickinessValue = '';
  if (stickiness === 'default' || stickiness === 'userId') {
    stickinessValue = context.userId || context.sessionId || String(Math.random());
  } else if (stickiness === 'sessionId') {
    stickinessValue = context.sessionId || String(Math.random());
  } else if (stickiness === 'random') {
    stickinessValue = String(Math.random());
  } else {
    stickinessValue = String(getContextValue(stickiness, context) || Math.random());
  }

  const seed = `${groupId}:${stickinessValue}`;
  // Simple hash function (murmurhash would be better but this works for playground)
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 10000) / 100;
}

function selectVariantForFlag(
  flag: any,
  context: Record<string, any>,
  matchedStrategy?: any
): { name: string; payload?: any; payloadType?: string; payloadSource?: string } | undefined {
  const variants = flag.variants || [];
  if (variants.length === 0) return undefined;

  const totalWeight = variants.reduce((sum: number, v: any) => sum + v.weight, 0);
  if (totalWeight <= 0) return undefined;

  const stickiness = matchedStrategy?.parameters?.stickiness || 'default';
  const percentage = calculatePercentage(context, stickiness, `${flag.flagName}-variant`);
  const targetWeight = (percentage / 100) * totalWeight;

  let cumulativeWeight = 0;
  for (const variant of variants) {
    cumulativeWeight += variant.weight;
    if (targetWeight <= cumulativeWeight) {
      // Determine payload and its source
      let payload = variant.payload;
      let payloadSource: 'variant' | 'baseline' = 'variant';
      if (payload === undefined || payload === null) {
        payload = flag.baselinePayload;
        payloadSource = 'baseline';
      }
      return {
        name: variant.variantName || variant.name,
        payload,
        payloadType: flag.variantType || 'string',
        payloadSource: payload !== undefined ? payloadSource : undefined,
      };
    }
  }
  const lastVariant = variants[variants.length - 1];
  let payload = lastVariant.payload;
  let payloadSource: 'variant' | 'baseline' = 'variant';
  if (payload === undefined || payload === null) {
    payload = flag.baselinePayload;
    payloadSource = 'baseline';
  }
  return {
    name: lastVariant.variantName || lastVariant.name,
    payload,
    payloadType: flag.variantType || 'string',
    payloadSource: payload !== undefined ? payloadSource : undefined,
  };
}

// ==================== Clone ====================

// Clone a feature flag to a new name
router.post(
  '/clone',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;
    const { sourceFlagName, newFlagName } = req.body;

    if (!sourceFlagName || !newFlagName) {
      return res.status(400).json({
        success: false,
        error: 'sourceFlagName and newFlagName are required',
      });
    }

    if (sourceFlagName === newFlagName) {
      return res.status(400).json({
        success: false,
        error: 'newFlagName must be different from sourceFlagName',
      });
    }

    // Check if source flag exists
    const sourceFlag = await featureFlagService.getFlag(environment, sourceFlagName);
    if (!sourceFlag) {
      return res.status(404).json({
        success: false,
        error: 'Source flag not found',
      });
    }

    // Check if new flag name already exists
    const existingFlag = await featureFlagService.getFlag(environment, newFlagName);
    if (existingFlag) {
      return res.status(409).json({
        success: false,
        error: 'A flag with the new name already exists',
      });
    }

    // Create new flag with same settings but different name
    const newFlag = await featureFlagService.createFlag(
      {
        environment,
        flagName: newFlagName,
        displayName: sourceFlag.displayName ? `${sourceFlag.displayName} (Copy)` : undefined,
        description: sourceFlag.description,
        flagType: sourceFlag.flagType || 'release',
        flagUsage: sourceFlag.flagUsage || 'flag',
        isEnabled: false, // New flags start disabled for safety
        impressionDataEnabled: sourceFlag.impressionDataEnabled ?? false,
        tags: sourceFlag.tags,
        strategies: (sourceFlag.strategies || []).map((s: any) => ({
          strategyName: s.strategyName || s.name,
          parameters: s.parameters,
          constraints: s.constraints,
          segments: s.segments,
          sortOrder: s.sortOrder,
          isEnabled: s.isEnabled ?? true,
        })),
        variants: (sourceFlag.variants || []).map((v: any) => ({
          variantName: v.variantName || v.name,
          weight: v.weight,
          payload: v.payload,
          payloadType: v.payloadType || 'json',
          weightLock: v.weightLock ?? false,
          overrides: v.overrides,
        })),
      },
      userId!
    );

    res.status(201).json({ success: true, data: { flag: newFlag } });
  })
);

// ==================== Import ====================

// Import feature flags from JSON
router.post(
  '/import',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;
    const { segments = [], flags = [] } = req.body;

    const result = {
      segments: { created: 0, skipped: 0, skippedNames: [] as string[] },
      flags: {
        created: 0,
        skipped: 0,
        skippedNames: [] as string[],
        errors: [] as string[],
      },
    };

    // 1. Import segments (global, skip if exists)
    for (const segmentData of segments) {
      try {
        // Check if segment exists by name
        const existingSegments = await featureFlagService.listSegments(segmentData.segmentName);
        const exists = existingSegments.some((s) => s.segmentName === segmentData.segmentName);

        if (exists) {
          result.segments.skipped++;
          result.segments.skippedNames.push(segmentData.segmentName);
          continue;
        }

        // Create new segment
        await featureFlagService.createSegment(
          {
            segmentName: segmentData.segmentName,
            displayName: segmentData.displayName,
            description: segmentData.description,
            constraints: segmentData.constraints || [],
            isActive: true,
            tags: segmentData.tags,
          },
          userId!
        );

        result.segments.created++;
      } catch (error: any) {
        // If duplicate error, count as skipped
        if (error.code === 'DUPLICATE_ENTRY') {
          result.segments.skipped++;
          result.segments.skippedNames.push(segmentData.segmentName);
        }
      }
    }

    // 2. Import flags (environment-specific, skip if exists)
    for (const flagData of flags) {
      try {
        // Check if flag exists
        const existingFlag = await featureFlagService.getFlag(environment, flagData.flagName);

        if (existingFlag) {
          result.flags.skipped++;
          result.flags.skippedNames.push(flagData.flagName);
          continue;
        }

        // Create new flag with strategies and variants
        await featureFlagService.createFlag(
          {
            environment,
            flagName: flagData.flagName,
            displayName: flagData.displayName,
            description: flagData.description,
            flagType: flagData.flagType || 'release',
            flagUsage: flagData.flagUsage || 'flag',
            isEnabled: flagData.enabled ?? false,
            impressionDataEnabled: flagData.impressionDataEnabled ?? false,
            tags: flagData.tags,
            variantType: flagData.variantType,
            baselinePayload: flagData.baselinePayload,
            strategies: (flagData.strategies || []).map((s: any) => ({
              strategyName: s.strategyName,
              parameters: s.parameters,
              constraints: s.constraints,
              segments: s.segments,
              sortOrder: s.sortOrder,
              isEnabled: s.isEnabled ?? true,
            })),
            variants: (flagData.variants || []).map((v: any) => ({
              variantName: v.variantName,
              weight: v.weight,
              payload: v.payload,
              payloadType: v.payloadType || 'json',
              weightLock: v.weightLock ?? false,
              overrides: v.overrides,
            })),
          },
          userId!
        );

        result.flags.created++;
      } catch (error: any) {
        // If duplicate error, count as skipped
        if (error.code === 'DUPLICATE_ENTRY') {
          result.flags.skipped++;
          result.flags.skippedNames.push(flagData.flagName);
        } else {
          result.flags.errors.push(`${flagData.flagName}: ${error.message}`);
        }
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          segmentsCreated: result.segments.created,
          segmentsSkipped: result.segments.skipped,
          flagsCreated: result.flags.created,
          flagsSkipped: result.flags.skipped,
          errors: result.flags.errors.length,
        },
        details: result,
      },
    });
  })
);

export default router;
