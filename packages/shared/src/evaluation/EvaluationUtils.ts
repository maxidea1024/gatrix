import crypto from 'crypto';
import { EvaluationContext, FeatureFlag, FeatureSegment, EvaluationResult, Variant } from './types';
import { VALUE_SOURCE } from './valueSource';

/**
 * Truncate an ISO 8601 time string to minute precision.
 * Prevents frequent cache invalidation from sub-minute changes.
 * e.g. "2025-01-15T10:30:45.123Z" ??"2025-01-15T10:30:00.000Z"
 */
export function truncateToMinute(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString; // Return as-is if invalid
  date.setSeconds(0, 0);
  return date.toISOString();
}

/**
 * Build query parameters from an EvaluationContext onto a URL.
 * Used by client SDKs for GET eval requests.
 */
export function buildContextQueryParams(url: URL, context: Record<string, any>): void {
  const systemAndTopLevel = [
    'appName',
    'environment',
    'userId',
    'sessionId',
    'remoteAddress',
    'currentTime',
  ];

  for (const key of systemAndTopLevel) {
    const value = context[key];
    if (value === undefined || value === null) continue;
    if (key === 'currentTime') {
      url.searchParams.set(key, truncateToMinute(String(value)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  if (context.properties && typeof context.properties === 'object') {
    for (const [propKey, propValue] of Object.entries(context.properties)) {
      if (propValue !== undefined && propValue !== null) {
        url.searchParams.set(`properties[${propKey}]`, String(propValue));
      }
    }
  }
}

/**
 * Common utilities for feature flag evaluation across different packages (Edge, Backend, etc.)
 */
export class EvaluationUtils {
  /**
   * Extract evaluation context and flag names from an Express-like request object
   */
  static extractFromRequest(req: any): { context: EvaluationContext; flagNames: string[] } {
    let context: EvaluationContext = {};
    let flagNames: string[] = [];

    if (req.method === 'POST') {
      context = req.body?.context || {};
      flagNames = req.body?.flagNames || req.body?.keys || [];
    } else {
      // GET: context from query parameters only
      const query = req.query || {};
      if (query.userId) context.userId = query.userId as string;
      if (query.sessionId) context.sessionId = query.sessionId as string;
      if (query.remoteAddress) context.remoteAddress = query.remoteAddress as string;
      if (query.appName) context.appName = query.appName as string;
      if (query.appVersion) context.appVersion = query.appVersion as string;
      if (query.environment) context.environment = query.environment as string;
      if (query.currentTime) {
        context.currentTime = new Date(truncateToMinute(query.currentTime as string));
      }

      // Handle properties[key]=value
      if (query.properties && typeof query.properties === 'object') {
        context.properties = {
          ...(context.properties || {}),
          ...query.properties,
        };
      }

      const flagNamesParam = query.flagNames as string;
      if (flagNamesParam) {
        flagNames = flagNamesParam.split(',');
      }
    }

    return { context, flagNames };
  }

  /**
   * Generate a stable hash for the evaluation context
   */
  static getContextHash(req: any, context: EvaluationContext): string {
    const headerHash = req.headers?.['x-gatrix-context-hash'];
    if (headerHash) return headerHash;

    const keys = Object.keys(context).sort();
    const stableContext: any = {};
    for (const key of keys) {
      stableContext[key] = (context as any)[key];
    }
    return crypto.createHash('md5').update(JSON.stringify(stableContext)).digest('hex');
  }

  /**
   * Generate ETag for the evaluation response
   */
  static generateETag(contextHash: string, flagsArray: any[]): string {
    const etagSource =
      contextHash +
      '|' +
      flagsArray
        .map((f: any) => {
          const variantPart = f.variant ? `${f.variant.name}:${f.variant.enabled}` : 'no-variant';
          return `${f.name}:${f.version}:${f.enabled}:${variantPart}`;
        })
        .join('|');
    return `"${crypto.createHash('sha256').update(etagSource).digest('hex')}"`;
  }

  /**
   * Format the evaluation result into the standard Gatrix response format
   */
  static formatResult(
    flagName: string,
    evalResult: EvaluationResult,
    dbFlag: Partial<FeatureFlag>,
    environment: string
  ): any {
    const { enabled, variant: resultVariant } = evalResult;

    // Determine the final variant and value to return
    let finalVariant: {
      name: string;
      value?: any;
      enabled: boolean;
    };

    if (
      enabled &&
      resultVariant &&
      resultVariant.name !== VALUE_SOURCE.FLAG_DEFAULT_ENABLED &&
      resultVariant.name !== VALUE_SOURCE.FLAG_DEFAULT_DISABLED &&
      resultVariant.name !== VALUE_SOURCE.ENV_DEFAULT_ENABLED &&
      resultVariant.name !== VALUE_SOURCE.ENV_DEFAULT_DISABLED
    ) {
      // Active variant from strategy/rollout (not a default)
      finalVariant = {
        name: resultVariant.name,
        enabled: true,
        value: resultVariant.value,
      };
    } else {
      // Use resolved enabled/disabled values
      const rawValue = enabled ? dbFlag.enabledValue : dbFlag.disabledValue;
      const valueToReturn =
        rawValue ??
        (dbFlag.valueType === 'boolean'
          ? false
          : dbFlag.valueType === 'number'
            ? 0
            : dbFlag.valueType === 'json'
              ? {}
              : '');

      // Determine explicit variant name based on value source
      let variantName: string;
      if (enabled) {
        variantName =
          dbFlag.valueSource === 'environment'
            ? VALUE_SOURCE.ENV_DEFAULT_ENABLED
            : VALUE_SOURCE.FLAG_DEFAULT_ENABLED;
      } else {
        variantName =
          dbFlag.valueSource === 'environment'
            ? VALUE_SOURCE.ENV_DEFAULT_DISABLED
            : VALUE_SOURCE.FLAG_DEFAULT_DISABLED;
      }

      finalVariant = {
        name: variantName,
        enabled: enabled,
        value: valueToReturn,
      };
    }

    // Process JSON/Number value types if they are still strings (Edge legacy support)
    if (finalVariant.value !== undefined && finalVariant.value !== null) {
      const valueType = dbFlag.valueType || 'string';
      if (
        valueType === 'json' &&
        typeof finalVariant.value === 'string' &&
        finalVariant.value.trim() !== ''
      ) {
        try {
          finalVariant.value = JSON.parse(finalVariant.value);
        } catch (e) {
          /* ignore */
        }
      } else if (valueType === 'number' && typeof finalVariant.value === 'string') {
        const parsed = Number(finalVariant.value);
        if (!isNaN(parsed)) finalVariant.value = parsed;
      }
    }

    return {
      id: dbFlag.id,
      name: flagName,
      enabled: enabled,
      variant: finalVariant,
      valueType: dbFlag.valueType || 'string',
      version: dbFlag.version || 1,
      ...(dbFlag.impressionDataEnabled && { impressionData: true }),
    };
  }
}
