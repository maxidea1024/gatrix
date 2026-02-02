/**
 * Feature Flags Admin Routes
 * API endpoints for managing feature flags
 */

import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { featureFlagService } from "../../services/FeatureFlagService";
import { FeatureFlagTypeModel } from "../../models/FeatureFlagType";
import { networkTrafficService } from "../../services/NetworkTrafficService";

const router = Router();

// ==================== Network Traffic ====================

// Get detailed network traffic data (includes appName)
router.get(
  "/network/traffic",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    // Default to last 24 hours
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getDetailedTraffic({
      environments: environments
        ? (environments as string).split(",")
        : undefined,
      appNames: appNames ? (appNames as string).split(",") : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  }),
);

// Get aggregated network traffic data for charts
router.get(
  "/network/traffic/aggregated",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getAggregatedTraffic({
      environments: environments
        ? (environments as string).split(",")
        : undefined,
      appNames: appNames ? (appNames as string).split(",") : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  }),
);

// Get aggregated network traffic data by app for charts
router.get(
  "/network/traffic/aggregated/by-app",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getAggregatedTrafficByApp({
      environments: environments
        ? (environments as string).split(",")
        : undefined,
      appNames: appNames ? (appNames as string).split(",") : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  }),
);

// Get traffic summary
router.get(
  "/network/summary",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const summary = await networkTrafficService.getTrafficSummary({
      environments: environments
        ? (environments as string).split(",")
        : undefined,
      appNames: appNames ? (appNames as string).split(",") : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { summary } });
  }),
);

// Get active applications
router.get(
  "/network/applications",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const applications = await networkTrafficService.getActiveApplications({
      environments: environments
        ? (environments as string).split(",")
        : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { applications } });
  }),
);

// Get flag evaluation summary (from g_feature_metrics)
router.get(
  "/network/evaluations",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const evaluations = await networkTrafficService.getFlagEvaluationSummary({
      environments: environments
        ? (environments as string).split(",")
        : undefined,
      appNames: appNames ? (appNames as string).split(",") : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { evaluations } });
  }),
);

// Get flag evaluation time series (from g_feature_metrics)
router.get(
  "/network/evaluations/timeseries",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const timeseries = await networkTrafficService.getFlagEvaluationTimeSeries({
      environments: environments
        ? (environments as string).split(",")
        : undefined,
      appNames: appNames ? (appNames as string).split(",") : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { timeseries } });
  }),
);

// Get flag evaluation time series by app (from g_feature_metrics)
router.get(
  "/network/evaluations/timeseries/by-app",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const timeseries =
      await networkTrafficService.getFlagEvaluationTimeSeriesByApp({
        environments: environments
          ? (environments as string).split(",")
          : undefined,
        appNames: appNames ? (appNames as string).split(",") : undefined,
        startDate: start,
        endDate: end,
      });

    res.json({ success: true, data: { timeseries } });
  }),
);

// ==================== Flag Types ====================

// List all flag types
router.get(
  "/types",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const types = await FeatureFlagTypeModel.findAll();
    res.json({ success: true, data: { types } });
  }),
);

// Update a flag type
router.put(
  "/types/:flagType",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const flagType = await FeatureFlagTypeModel.update(
      req.params.flagType,
      req.body,
    );
    res.json({ success: true, data: { flagType } });
  }),
);

// ==================== Segments (MUST be before /:flagName routes) ====================

// List segments (segments are now global)
router.get(
  "/segments",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search } = req.query;

    const segments = await featureFlagService.listSegments(search as string);

    res.json({ success: true, data: { segments } });
  }),
);

// Get segment by ID
router.get(
  "/segments/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const segment = await featureFlagService.getSegment(req.params.id);

    if (!segment) {
      return res
        .status(404)
        .json({ success: false, error: "Segment not found" });
    }

    res.json({ success: true, data: { segment } });
  }),
);

// Create a segment (segments are now global)
router.post(
  "/segments",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const segment = await featureFlagService.createSegment(req.body, userId!);

    res.status(201).json({ success: true, data: { segment } });
  }),
);

// Update a segment
router.put(
  "/segments/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const segment = await featureFlagService.updateSegment(
      req.params.id,
      req.body,
      userId!,
    );

    res.json({ success: true, data: { segment } });
  }),
);

// Delete a segment
router.delete(
  "/segments/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    await featureFlagService.deleteSegment(req.params.id, userId!);

    res.json({ success: true, message: "Segment deleted successfully" });
  }),
);

// ==================== Context Fields (MUST be before /:flagName routes) ====================

// List context fields
router.get(
  "/context-fields",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search } = req.query;
    const fields = await featureFlagService.listContextFields(
      search as string | undefined,
    );

    res.json({ success: true, data: { contextFields: fields } });
  }),
);

// Create a context field
router.post(
  "/context-fields",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const field = await featureFlagService.createContextField(
      req.body,
      userId!,
    );

    res.status(201).json({ success: true, data: { field } });
  }),
);

// Update a context field
router.put(
  "/context-fields/:fieldName",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const field = await featureFlagService.updateContextField(
      req.params.fieldName,
      req.body,
      userId!,
    );

    res.json({ success: true, data: { field } });
  }),
);

// Delete a context field
router.delete(
  "/context-fields/:fieldName",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    await featureFlagService.deleteContextField(req.params.fieldName, userId!);

    res.json({ success: true, message: "Context field deleted successfully" });
  }),
);

// ==================== Feature Flags ====================

// Helper function to validate environment
const requireEnvironment = (
  req: AuthenticatedRequest,
  res: Response,
): string | null => {
  const environment = req.environment;
  if (!environment) {
    res.status(400).json({
      success: false,
      error: "Environment is required (x-environment header)",
    });
    return null;
  }
  return environment;
};

// List feature flags
router.get(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

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
    } = req.query;

    const result = await featureFlagService.listFlags({
      environment,
      search: search as string,
      flagType: flagType as string,
      isEnabled:
        isEnabled === "true" ? true : isEnabled === "false" ? false : undefined,
      isArchived:
        isArchived === "true"
          ? true
          : isArchived === "false"
            ? false
            : undefined,
      tags: tags ? (tags as string).split(",") : undefined,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as "asc" | "desc") || "desc",
    });

    res.json({ success: true, data: result });
  }),
);

// Create a feature flag
router.post(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.createFlag(
      { ...req.body, environment },
      userId!,
    );

    res.status(201).json({ success: true, data: { flag } });
  }),
);

// Get a single feature flag (MUST be after /segments and /context-fields)
router.get(
  "/:flagName",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const flag = await featureFlagService.getFlag(
      environment,
      req.params.flagName,
    );

    if (!flag) {
      return res.status(404).json({ success: false, error: "Flag not found" });
    }

    res.json({ success: true, data: { flag } });
  }),
);

// Update a feature flag
router.put(
  "/:flagName",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.updateFlag(
      environment,
      req.params.flagName,
      req.body,
      userId!,
    );

    res.json({ success: true, data: { flag } });
  }),
);

// Toggle flag enabled state
router.post(
  "/:flagName/toggle",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Allow environment from body, otherwise use request environment (header)
    const environment = req.body.environment || req.environment;
    const userId = req.user?.id;
    const { isEnabled } = req.body;

    const flag = await featureFlagService.toggleFlag(
      environment,
      req.params.flagName,
      isEnabled,
      userId!,
    );

    res.json({ success: true, data: { flag } });
  }),
);

// Archive a flag
router.post(
  "/:flagName/archive",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.archiveFlag(
      environment,
      req.params.flagName,
      userId!,
    );

    res.json({ success: true, data: { flag } });
  }),
);

// Revive an archived flag
router.post(
  "/:flagName/revive",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.reviveFlag(
      environment,
      req.params.flagName,
      userId!,
    );

    res.json({ success: true, data: { flag } });
  }),
);

// Toggle favorite status
router.post(
  "/:flagName/favorite",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;
    const { isFavorite } = req.body;

    const flag = await featureFlagService.toggleFavorite(
      environment,
      req.params.flagName,
      isFavorite,
      userId!,
    );

    res.json({ success: true, data: { flag } });
  }),
);

// Mark flag as stale
router.post(
  "/:flagName/mark-stale",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.markAsStale(
      environment,
      req.params.flagName,
      userId!,
    );

    res.json({ success: true, data: { flag } });
  }),
);

// Unmark flag as stale
router.post(
  "/:flagName/unmark-stale",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const flag = await featureFlagService.markAsNotStale(
      environment,
      req.params.flagName,
      userId!,
    );

    res.json({ success: true, data: { flag } });
  }),
);

// Delete a flag
router.delete(
  "/:flagName",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    await featureFlagService.deleteFlag(
      environment,
      req.params.flagName,
      userId!,
    );

    res.json({ success: true, message: "Flag deleted successfully" });
  }),
);

// ==================== Strategies ====================

// Add a strategy to a flag
router.post(
  "/:flagName/strategies",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const strategy = await featureFlagService.addStrategy(
      environment,
      req.params.flagName,
      req.body,
      userId!,
    );

    res.status(201).json({ success: true, data: { strategy } });
  }),
);

// Update all strategies for a flag (bulk replace)
router.put(
  "/:flagName/strategies",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;

    const strategies = await featureFlagService.updateStrategies(
      environment,
      req.params.flagName,
      req.body.strategies || [],
      userId!,
    );

    res.json({ success: true, data: { strategies } });
  }),
);

// Update a strategy
router.put(
  "/:flagName/strategies/:strategyId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const strategy = await featureFlagService.updateStrategy(
      req.params.strategyId,
      req.body,
      userId!,
    );

    res.json({ success: true, data: { strategy } });
  }),
);

// Delete a strategy
router.delete(
  "/:flagName/strategies/:strategyId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    await featureFlagService.deleteStrategy(req.params.strategyId, userId!);

    res.json({ success: true, message: "Strategy deleted successfully" });
  }),
);

// ==================== Variants ====================

// Update variants for a flag (bulk replace)
router.put(
  "/:flagName/variants",
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
      req.body.clearVariantPayloads, // Pass flag to clear existing variant payloads
    );

    res.json({ success: true, data: { variants } });
  }),
);

// ==================== Metrics ====================

// Get metrics for a flag
router.get(
  "/:flagName/metrics",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const { startDate, endDate, appName } = req.query;

    // Parse appName: undefined = all apps, 'null' = only null appName, otherwise specific app
    let appNameFilter: string | null | undefined;
    if (appName === "null") {
      appNameFilter = null;
    } else if (appName && typeof appName === "string") {
      appNameFilter = appName;
    }

    const metrics = await featureFlagService.getMetrics(
      environment,
      req.params.flagName,
      new Date((startDate as string) || Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date((endDate as string) || Date.now()),
      appNameFilter,
    );

    res.json({ success: true, data: { metrics } });
  }),
);

// Get app names used in metrics for a flag
router.get(
  "/:flagName/metrics/apps",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const { startDate, endDate } = req.query;

    const appNames = await featureFlagService.getMetricsAppNames(
      environment,
      req.params.flagName,
      new Date((startDate as string) || Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date((endDate as string) || Date.now()),
    );

    res.json({ success: true, data: { appNames } });
  }),
);

// Record metrics for a flag evaluation
router.post(
  "/:flagName/metrics",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const { enabled, variantName } = req.body;

    await featureFlagService.recordMetrics(
      environment,
      req.params.flagName,
      enabled,
      variantName,
    );

    res.json({ success: true });
  }),
);

// ==================== Clone ====================

// Clone a feature flag to a new name
router.post(
  "/clone",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = requireEnvironment(req, res);
    if (!environment) return;

    const userId = req.user?.id;
    const { sourceFlagName, newFlagName } = req.body;

    if (!sourceFlagName || !newFlagName) {
      return res.status(400).json({
        success: false,
        error: "sourceFlagName and newFlagName are required",
      });
    }

    if (sourceFlagName === newFlagName) {
      return res.status(400).json({
        success: false,
        error: "newFlagName must be different from sourceFlagName",
      });
    }

    // Check if source flag exists
    const sourceFlag = await featureFlagService.getFlag(
      environment,
      sourceFlagName,
    );
    if (!sourceFlag) {
      return res.status(404).json({
        success: false,
        error: "Source flag not found",
      });
    }

    // Check if new flag name already exists
    const existingFlag = await featureFlagService.getFlag(
      environment,
      newFlagName,
    );
    if (existingFlag) {
      return res.status(409).json({
        success: false,
        error: "A flag with the new name already exists",
      });
    }

    // Create new flag with same settings but different name
    const newFlag = await featureFlagService.createFlag(
      {
        environment,
        flagName: newFlagName,
        displayName: sourceFlag.displayName
          ? `${sourceFlag.displayName} (Copy)`
          : undefined,
        description: sourceFlag.description,
        flagType: sourceFlag.flagType || "release",
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
          payloadType: v.payloadType || "json",
          weightLock: v.weightLock ?? false,
          overrides: v.overrides,
        })),
      },
      userId!,
    );

    res.status(201).json({ success: true, data: { flag: newFlag } });
  }),
);

// ==================== Import ====================

// Import feature flags from JSON
router.post(
  "/import",
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
        const existingSegments = await featureFlagService.listSegments(
          segmentData.segmentName,
        );
        const exists = existingSegments.some(
          (s) => s.segmentName === segmentData.segmentName,
        );

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
          userId!,
        );

        result.segments.created++;
      } catch (error: any) {
        // If duplicate error, count as skipped
        if (error.code === "DUPLICATE_ENTRY") {
          result.segments.skipped++;
          result.segments.skippedNames.push(segmentData.segmentName);
        }
      }
    }

    // 2. Import flags (environment-specific, skip if exists)
    for (const flagData of flags) {
      try {
        // Check if flag exists
        const existingFlag = await featureFlagService.getFlag(
          environment,
          flagData.flagName,
        );

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
            flagType: flagData.flagType || "release",
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
              payloadType: v.payloadType || "json",
              weightLock: v.weightLock ?? false,
              overrides: v.overrides,
            })),
          },
          userId!,
        );

        result.flags.created++;
      } catch (error: any) {
        // If duplicate error, count as skipped
        if (error.code === "DUPLICATE_ENTRY") {
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
  }),
);

export default router;
