/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { createLogger } from '../config/logger';

const logger = createLogger('EvaluationHelper');
import { sdkManager } from '../services/sdkManager';
import { EvaluationUtils } from '@gatrix/shared';

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

    const { environment, applicationName } = clientContext;

    // 1. Extract context and flag names from request
    const { context, flagNames } = EvaluationUtils.extractFromRequest(req);

    // Default context values
    if (!context.appName) {
      context.appName = applicationName;
    }
    context.environment = environment;

    // 2. Evaluate flags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Record<string, any> = {};

    // If no keys specified, evaluate ALL
    let keysToEvaluate =
      flagNames.length > 0
        ? flagNames
        : sdk.featureFlag.getCached(environment).map((f: any) => f.name);

    // Sort keys to ensure consistent iteration order
    keysToEvaluate = [...keysToEvaluate].sort();

    for (const key of keysToEvaluate) {
      const result = sdk.featureFlag.evaluate(key, context, environment);
      const flagDef = sdk.featureFlag.getFlagByName(environment, key);

      // Format result using common utility
      results[key] = EvaluationUtils.formatResult(
        key,
        result,
        {
          id: flagDef?.id,
          valueType: flagDef?.valueType,
          version: flagDef?.version,
          impressionDataEnabled: flagDef?.impressionDataEnabled,
          // SDK already resolved these, but we pass them if needed for formatResult
          enabledValue: result.enabled ? (result.variant?.value ?? undefined) : undefined,
          disabledValue: !result.enabled ? (result.variant?.value ?? undefined) : undefined,
        },
        environment
      );
    }

    const flagsArray = Object.values(results).sort((a, b) => a.name.localeCompare(b.name));

    const responseData = {
      success: true,
      data: {
        flags: flagsArray,
      },
      meta: {
        environment,
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
