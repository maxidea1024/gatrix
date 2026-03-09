import { Router, Response } from 'express';
import { metricsAggregator } from '../services/metrics-aggregator';
import { performEvaluation } from '../utils/evaluation-helper';
import {
  ErrorCodes,
  sendBadRequest,
  sendInternalError,
} from '../utils/api-response';
import { createLogger } from '../config/logger';
import { serverAuth, ServerRequest } from '../middleware/server-auth';

const logger = createLogger('ServerRoute');

const router = Router();

/**
 * GET /api/v1/server/features
 * Returns cached feature flags and segments for the token's environment
 */
router.get(
  '/features',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const cacheKey = req.cacheKey!;
      let flags = sdk.featureFlag.getCached(cacheKey);

      // Filter by flagNames query parameter (comma-separated) if provided
      const flagNamesParam = req.query.flagNames as string | undefined;
      if (flagNamesParam) {
        const flagNamesFilter = new Set(
          flagNamesParam
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        );
        flags = flags.filter((f: any) => flagNamesFilter.has(f.name));
      }

      // Resolve projectId for segment scoping
      const projectId = sdk.featureFlag.getProjectIdForEnvironment(cacheKey);

      // When flagNames filter is applied, only include segments referenced by the filtered flags
      let segments: any[];
      if (flagNamesParam) {
        const referencedSegmentNames = new Set<string>();
        for (const flag of flags) {
          for (const strategy of (flag as any).strategies || []) {
            for (const segName of strategy.segments || []) {
              referencedSegmentNames.add(segName);
            }
          }
        }
        const allSegments = sdk.featureFlag.getAllSegments(projectId);
        segments = Array.from(allSegments.values()).filter((s: any) =>
          referencedSegmentNames.has(s.name)
        );
      } else {
        segments = Array.from(
          sdk.featureFlag.getAllSegments(projectId).values()
        );
      }

      // Parse compact option
      const compact = req.query.compact === 'true' || req.query.compact === '1';

      // When compact mode is enabled, strip evaluation data from disabled flags
      const responseFlags = compact
        ? flags.map((f: any) => {
            if (!f.isEnabled) {
              const { strategies, variants, enabledValue, ...rest } = f;
              return { ...rest, compact: true };
            }
            return f;
          })
        : flags;

      const data: { flags: any[]; segments?: any[] } = { flags: responseFlags };
      if (segments.length > 0) {
        data.segments = segments;
      }

      res.json({
        success: true,
        data,
        cached: true,
      });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to serve features from edge',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
);

/**
 * GET /api/v1/server/segments
 * Returns cached segments for the token's project
 */
router.get(
  '/segments',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      // Resolve projectId from cacheKey for project-scoped segments
      const cacheKey = req.cacheKey!;
      const projectId = sdk.featureFlag.getProjectIdForEnvironment(cacheKey);
      let segments = Array.from(
        sdk.featureFlag.getAllSegments(projectId).values()
      );

      // Filter by segmentNames query parameter (comma-separated) if provided
      const segmentNamesParam = req.query.segmentNames as string | undefined;
      if (segmentNamesParam) {
        const segmentNamesFilter = new Set(
          segmentNamesParam
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        );
        segments = segments.filter((s: any) => segmentNamesFilter.has(s.name));
      }

      res.json({
        success: true,
        data: { segments },
        cached: true,
      });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to serve segments from edge',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
);

/**
 * POST /api/v1/server/features/metrics
 * Buffers and aggregates server metrics
 */
router.post(
  '/features/metrics',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const environmentId = req.environmentId!;
      const appName = req.applicationName || 'unknown';
      const sdkVersion = req.headers['x-sdk-version'] as string | undefined;
      const { metrics } = req.body;

      if (!Array.isArray(metrics)) {
        return sendBadRequest(res, 'metrics must be an array');
      }

      metricsAggregator.addServerMetrics(
        environmentId,
        appName,
        metrics,
        sdkVersion
      );
      res.json({ success: true, buffered: true });
    } catch (error) {
      sendInternalError(res, 'Failed to buffer server metrics', error);
    }
  }
);

/**
 * POST /api/v1/server/features/unknown
 * Buffers and aggregates unknown flag reporting
 */
router.post(
  '/features/unknown',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const environmentId = req.environmentId!;
      const appName = req.applicationName || 'unknown';
      const sdkVersion = req.headers['x-sdk-version'] as string | undefined;
      const { flagName, count = 1 } = req.body;

      if (!flagName) {
        return sendBadRequest(res, 'flagName is required');
      }

      metricsAggregator.addServerUnknownReport(
        environmentId,
        appName,
        flagName,
        count,
        sdkVersion
      );
      res.json({ success: true, buffered: true });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to buffer server unknown flag report',
        error
      );
    }
  }
);

/**
 * POST /api/v1/server/features/eval
 */
router.post(
  '/features/eval',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    await performEvaluation(
      req,
      res,
      {
        environmentId: req.environmentId,
        applicationName: req.applicationName,
        cacheKey: req.cacheKey,
      },
      true
    );
  }
);

/**
 * GET /api/v1/server/features/eval
 */
router.get(
  '/features/eval',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    await performEvaluation(
      req,
      res,
      {
        environmentId: req.environmentId,
        applicationName: req.applicationName,
        cacheKey: req.cacheKey,
      },
      false
    );
  }
);

export default router;
