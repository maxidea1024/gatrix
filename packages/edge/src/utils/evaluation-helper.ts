/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { sdkManager } from '../services/sdk-manager';
import { metricsAggregator } from '../services/metrics-aggregator';
import { EvaluationUtils } from '@gatrix/evaluator';

import { createLogger } from '../config/logger';
const logger = createLogger('EvaluationHelper');

/**
 * Get SDK instance or return 503 error
 */
export function getSDKOrError(res: Response) {
  const sdk = sdkManager.getSDK();
  if (!sdk) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'SDK not initialized',
      },
    });
    return null;
  }
  return sdk;
}

/**
 * Shared evaluation helper for both Client and Server routes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function performEvaluation(
  req: Request,
  res: Response,
  clientContext: any,
  isPost: boolean
) {
  try {
    const sdk = getSDKOrError(res);
    if (!sdk) return;

    const {
      environmentId,
      applicationName,
      cacheKey: contextCacheKey,
    } = clientContext;

    // Use pre-resolved cacheKey from middleware, or environmentId as fallback
    // SDK cache uses environmentId as key (no longer token-based)
    const cacheKey = contextCacheKey || environmentId;

    // 1. Extract context and flag names from request
    const { context, flagNames } = EvaluationUtils.extractFromRequest(req);

    // Default context values
    if (!context.appName) {
      context.appName = applicationName;
    }

    // Collect context field usage (fire-and-forget, non-blocking)
    try {
      const fieldNames: string[] = [];
      const systemFields = ['userId', 'sessionId', 'appName', 'appVersion', 'remoteAddress', 'currentTime'];
      
      // Extract all keys from context
      if (context && typeof context === 'object') {
        for (const key of Object.keys(context)) {
          if (key !== 'properties' && (context as any)[key] !== undefined && (context as any)[key] !== null) {
            fieldNames.push(key);
          }
        }
      }
      
      // Custom properties explicitly in 'properties'
      if (context.properties && typeof context.properties === 'object') {
        for (const key of Object.keys(context.properties)) {
          if (!fieldNames.includes(key) && context.properties[key] !== undefined && context.properties[key] !== null) {
            fieldNames.push(key);
          }
        }
      }
      if (fieldNames.length > 0) {
        const sdkVersion = req.headers['x-sdk-version'] as string | undefined;
        metricsAggregator.addContextFieldUsage(
          environmentId,
          applicationName || 'unknown',
          fieldNames,
          sdkVersion
        );
      }
    } catch (ctxErr) {
      // Non-critical, don't block evaluation
      logger.debug('Failed to collect context field usage', { error: ctxErr });
    }

    // 2. Evaluate flags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Record<string, any> = {};

    // If no keys specified, evaluate ALL
    let keysToEvaluate =
      flagNames.length > 0
        ? flagNames
        : sdk.featureFlag.getCached(cacheKey).map((f: any) => f.name);

    // Sort keys to ensure consistent iteration order
    keysToEvaluate = [...keysToEvaluate].sort();

    // Track missing flags when specific flagNames are requested
    const missingFlags: string[] = [];

    for (const key of keysToEvaluate) {
      // Skip flags that don't exist in cache
      // getFlagByName signature: getFlagByName(flagName, environmentId?)
      const flagDef = sdk.featureFlag.getFlagByName(key, cacheKey);
      if (!flagDef) {
        // Only track as missing when specific flagNames were requested
        if (flagNames.length > 0) {
          missingFlags.push(key);
        }
        continue;
      }

      const result = sdk.featureFlag.evaluate(key, context, cacheKey);

      // Format result using common utility
      // Pass the cached flag definition directly to preserve all fields (especially valueSource)
      results[key] = EvaluationUtils.formatResult(key, result, flagDef);
    }

    const flagsArray = Object.values(results).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta: any = {
      environmentId,
      evaluatedAt: new Date().toISOString(),
    };
    if (missingFlags.length > 0) {
      meta.missing = missingFlags;
    }

    const responseData = {
      success: true,
      data: {
        flags: flagsArray,
      },
      meta,
    };

    // 3. Generate ETag and check If-None-Match
    const contextHash = EvaluationUtils.getContextHash(req, context);
    const etag = EvaluationUtils.generateETag(contextHash, flagsArray);

    const requestEtag = req.headers['if-none-match'];
    if (requestEtag === etag) {
      return res.status(304).end();
    }

    res.set('ETag', etag);
    res.json(responseData);
  } catch (error) {
    logger.error('Error evaluating feature flags in edge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to evaluate feature flags',
      },
    });
  }
}
