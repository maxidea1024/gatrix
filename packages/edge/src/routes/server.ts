import { Router, Request, Response, NextFunction } from 'express';
import { tokenMirrorService } from '../services/token-mirror-service';
import { metricsAggregator } from '../services/metrics-aggregator';
import { performEvaluation } from '../utils/evaluation-helper';
import { environmentRegistry } from '../services/environment-registry';
import {
  ErrorCodes,
  sendUnauthorized,
  sendBadRequest,
  sendInternalError,
} from '../utils/api-response';
import { createLogger } from '../config/logger';

const logger = createLogger('ServerRoute');

const router = Router();

// Unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
const UNSECURED_TOKEN_REGEX =
  /^unsecured-([^:]+):([^:]+):(.+)-(server|client|edge)-api-token$/;

// Legacy unsecured tokens — auto-resolve to default/default/development
const LEGACY_TOKENS: Record<string, boolean> = {
  'gatrix-unsecured-client-api-token': true,
  'gatrix-unsecured-server-api-token': true,
  'gatrix-unsecured-edge-api-token': true,
};
const LEGACY_ENV_NAME = 'development';

/**
 * Extended request with resolved environment
 */
interface ServerRequest extends Request {
  environmentId?: string;
  cacheKey?: string;
  applicationName?: string;
}

/**
 * Server SDK authentication middleware for Edge
 * Resolves environment from token (no :env path parameter)
 */
function serverAuth(
  req: ServerRequest,
  res: Response,
  next: NextFunction
): void {
  const apiToken = req.headers['x-api-token'] as string;

  if (!apiToken) {
    sendUnauthorized(
      res,
      'x-api-token header is required',
      ErrorCodes.AUTH_TOKEN_REQUIRED
    );
    return;
  }

  // 1. Try unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
  const unsecuredMatch = apiToken.match(UNSECURED_TOKEN_REGEX);
  if (unsecuredMatch) {
    const [, , , envId] = unsecuredMatch;
    // The token IS the cache key for the SDK
    req.cacheKey = apiToken;
    // Resolve actual environment ID from the registry
    req.environmentId =
      environmentRegistry.resolveEnvironmentId(envId) || envId;
    req.applicationName =
      (req.headers['x-application-name'] as string) || 'unknown';
    return next();
  }

  // 2. Legacy unsecured tokens → resolve to development
  if (LEGACY_TOKENS[apiToken]) {
    const cacheKey =
      environmentRegistry.resolveEnvironmentToken(LEGACY_ENV_NAME);
    if (!cacheKey) {
      sendUnauthorized(
        res,
        'Could not resolve environment for legacy token',
        ErrorCodes.AUTH_TOKEN_INVALID
      );
      return;
    }
    req.cacheKey = cacheKey;
    // Get actual environment ID
    req.environmentId =
      environmentRegistry.resolveEnvironmentId(LEGACY_ENV_NAME) ||
      LEGACY_ENV_NAME;
    req.applicationName =
      (req.headers['x-application-name'] as string) || 'unknown';
    return next();
  }

  // 3. Real production token — validate and resolve environment
  const validation = tokenMirrorService.validateToken(apiToken, 'server');
  if (!validation.valid) {
    sendUnauthorized(
      res,
      'Invalid or unauthorized server API token',
      ErrorCodes.AUTH_TOKEN_INVALID
    );
    return;
  }

  // Resolve environment from token's environments array
  const token = validation.token;
  const envName = token?.environments?.[0];
  if (!envName || envName === '*') {
    sendUnauthorized(
      res,
      'Token does not have a specific environment binding',
      ErrorCodes.AUTH_TOKEN_INVALID
    );
    return;
  }

  const cacheKey = environmentRegistry.resolveEnvironmentToken(envName);
  if (!cacheKey) {
    sendUnauthorized(
      res,
      `Could not resolve environment: ${envName}`,
      ErrorCodes.AUTH_TOKEN_INVALID
    );
    return;
  }

  req.cacheKey = cacheKey;
  req.environmentId =
    environmentRegistry.resolveEnvironmentId(envName) || envName;
  req.applicationName =
    (req.headers['x-application-name'] as string) || 'unknown';

  next();
}

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
  }
);

/**
 * GET /api/v1/server/segments
 * Returns all cached segments
 */
router.get(
  '/segments',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
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
