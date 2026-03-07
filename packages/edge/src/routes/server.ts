import { Router, Request, Response, NextFunction } from 'express';
import { tokenMirrorService } from '../services/tokenMirrorService';
import { metricsAggregator } from '../services/metricsAggregator';
import { performEvaluation } from '../utils/evaluationHelper';
import {
  ErrorCodes,
  sendUnauthorized,
  sendBadRequest,
  sendInternalError,
} from '../utils/apiResponse';
import { createLogger } from '../config/logger';

const logger = createLogger('ServerRoute');

const router = Router();

/**
 * Server SDK authentication middleware for Edge
 */
function serverAuth(req: Request, res: Response, next: NextFunction): void {
  const apiToken = req.headers['x-api-token'] as string;
  const environment = req.params.env;

  if (!apiToken) {
    sendUnauthorized(res, 'x-api-token header is required', ErrorCodes.AUTH_TOKEN_REQUIRED);
    return;
  }

  const validation = tokenMirrorService.validateToken(apiToken, 'server', environment);
  if (!validation.valid) {
    sendUnauthorized(
      res,
      'Invalid or unauthorized server API token',
      ErrorCodes.AUTH_TOKEN_INVALID
    );
    return;
  }

  next();
}

/**
 * GET /api/v1/server/:env/features
 * Returns cached feature flags and segments for the given environment
 */
router.get('/:env/features', serverAuth, async (req: Request, res: Response) => {
  try {
    const { getSDKOrError } = await import('../utils/evaluationHelper');
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const env = req.params.env;
    let flags = sdk.featureFlag.getCached(env);

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
      const allSegments = sdk.featureFlag.getAllSegments();
      segments = Array.from(allSegments.values()).filter((s: any) =>
        referencedSegmentNames.has(s.name)
      );
    } else {
      segments = Array.from(sdk.featureFlag.getAllSegments().values());
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
});

/**
 * GET /api/v1/server/segments
 * Returns all cached segments
 */
router.get('/segments', serverAuth, async (req: Request, res: Response) => {
  try {
    const { getSDKOrError } = await import('../utils/evaluationHelper');
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    let segments = Array.from(sdk.featureFlag.getAllSegments().values());

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
});

/**
 * POST /api/v1/server/:env/features/metrics
 * Buffers and aggregates server metrics
 */
router.post('/:env/features/metrics', serverAuth, async (req: Request, res: Response) => {
  try {
    const env = req.params.env;
    const appName = (req.headers['x-application-name'] as string) || 'unknown';
    const sdkVersion = req.headers['x-sdk-version'] as string | undefined;
    const { metrics } = req.body;

    if (!Array.isArray(metrics)) {
      return sendBadRequest(res, 'metrics must be an array');
    }

    metricsAggregator.addServerMetrics(env, appName, metrics, sdkVersion);
    res.json({ success: true, buffered: true });
  } catch (error) {
    sendInternalError(res, 'Failed to buffer server metrics', error);
  }
});

/**
 * POST /api/v1/server/:env/features/unknown
 * Buffers and aggregates unknown flag reporting
 */
router.post('/:env/features/unknown', serverAuth, async (req: Request, res: Response) => {
  try {
    const env = req.params.env;
    const appName = (req.headers['x-application-name'] as string) || 'unknown';
    const sdkVersion = req.headers['x-sdk-version'] as string | undefined;
    const { flagName, count = 1 } = req.body;

    if (!flagName) {
      return sendBadRequest(res, 'flagName is required');
    }

    metricsAggregator.addServerUnknownReport(env, appName, flagName, count, sdkVersion);
    res.json({ success: true, buffered: true });
  } catch (error) {
    sendInternalError(res, 'Failed to buffer server unknown flag report', error);
  }
});

/**
 * POST /api/v1/server/:env/features/eval
 */
router.post('/:env/features/eval', serverAuth, async (req: Request, res: Response) => {
  const applicationName = (req.headers['x-application-name'] as string) || 'unknown';
  await performEvaluation(req, res, { environment: req.params.env, applicationName }, true);
});

/**
 * GET /api/v1/server/:env/features/eval
 */
router.get('/:env/features/eval', serverAuth, async (req: Request, res: Response) => {
  const applicationName = (req.headers['x-application-name'] as string) || 'unknown';
  await performEvaluation(req, res, { environment: req.params.env, applicationName }, false);
});

export default router;
