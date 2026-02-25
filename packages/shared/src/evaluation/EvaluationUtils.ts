import crypto from 'crypto';
import { EvaluationContext, FeatureFlag, FeatureSegment, EvaluationResult, Variant } from './types';
import { VARIANT_SOURCE } from './variantSource';

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
      // GET: context from parameters (Unleash Proxy style) or header
      const contextHeader = req.headers?.['x-gatrix-feature-context'];
      if (contextHeader) {
        try {
          const jsonStr = Buffer.from(contextHeader, 'base64').toString('utf-8');
          context = JSON.parse(jsonStr);
        } catch (error) {
          // ignore parse error
        }
      }

      if (Object.keys(context).length === 0 && req.query?.context) {
        try {
          const contextStr = req.query.context as string;
          const jsonStr = Buffer.from(contextStr, 'base64').toString('utf-8');
          if (jsonStr.trim().startsWith('{')) {
            context = JSON.parse(jsonStr);
          } else {
            context = JSON.parse(contextStr);
          }
        } catch (e) {
          try {
            context = JSON.parse(req.query.context as string);
          } catch (e2) {
            // ignore
          }
        }
      }

      // Fallback: Parse individual query parameters
      const query = req.query || {};
      if (!context.userId && query.userId) context.userId = query.userId as string;
      if (!context.sessionId && query.sessionId) context.sessionId = query.sessionId as string;
      if (!context.remoteAddress && query.remoteAddress) context.remoteAddress = query.remoteAddress as string;
      if (!context.appName && query.appName) context.appName = query.appName as string;

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

    if (enabled && resultVariant && resultVariant.name !== VARIANT_SOURCE.FLAG_DEFAULT_ENABLED && resultVariant.name !== VARIANT_SOURCE.FLAG_DEFAULT_DISABLED) {
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
            ? VARIANT_SOURCE.ENV_DEFAULT_ENABLED
            : VARIANT_SOURCE.FLAG_DEFAULT_ENABLED;
      } else {
        variantName =
          dbFlag.valueSource === 'environment'
            ? VARIANT_SOURCE.ENV_DEFAULT_DISABLED
            : VARIANT_SOURCE.FLAG_DEFAULT_DISABLED;
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
      if (valueType === 'json' && typeof finalVariant.value === 'string' && finalVariant.value.trim() !== '') {
        try {
          finalVariant.value = JSON.parse(finalVariant.value);
        } catch (e) { /* ignore */ }
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
