/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { sdkManager } from '../services/sdk-manager';
import { environmentRegistry } from '../services/environment-registry';
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

    const { environmentId, applicationName, cacheKey: contextCacheKey } = clientContext;

    // Use pre-resolved cacheKey from middleware, or resolve here as fallback
    const cacheKey = contextCacheKey || environmentRegistry.resolveEnvironmentToken(environmentId) || environmentId;

    // 1. Extract context and flag names from request
    const { context, flagNames } = EvaluationUtils.extractFromRequest(req);

    // Default context values
    if (!context.appName) {
      context.appName = applicationName;
    }
    context.environment = environmentId;

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

    for (const key of keysToEvaluate) {
      const result = sdk.featureFlag.evaluate(key, context, cacheKey);
      const flagDef = sdk.featureFlag.getFlagByName(cacheKey, key);

      // Format result using common utility
      results[key] = EvaluationUtils.formatResult(
        key,
        result,
        {
          id: flagDef?.id,
          valueType: flagDef?.valueType,
          version: flagDef?.version,
          impressionDataEnabled: flagDef?.impressionDataEnabled,
          valueSource: flagDef?.valueSource,
          // SDK already resolved these, but we pass them if needed for formatResult
          enabledValue: result.enabled ? (result.variant?.value ?? undefined) : undefined,
          disabledValue: !result.enabled ? (result.variant?.value ?? undefined) : undefined,
        },
        environmentId
      );
    }

    const flagsArray = Object.values(results).sort((a, b) => a.name.localeCompare(b.name));

    const responseData = {
      success: true,
      data: {
        flags: flagsArray,
      },
      meta: {
        environmentId,
        evaluatedAt: new Date().toISOString(),
      },
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
