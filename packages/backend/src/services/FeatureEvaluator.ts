/**
 * Feature Flag Evaluator
 * Handles feature flag evaluation logic including constraints, rollout, and variants
 */

import murmurhash from 'murmurhash';
import logger from '../config/logger';
import {
  FeatureFlagAttributes,
  FeatureStrategyAttributes,
  FeatureVariantAttributes,
  Constraint,
  ConstraintOperator,
} from '../models/FeatureFlag';

// ==================== Types ====================

// Extended flag type that includes environment-specific isEnabled
export type EvaluatableFlagAttributes = FeatureFlagAttributes & {
  isEnabled: boolean;
};

export interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  environmentName?: string;
  appName?: string;
  appVersion?: string;
  country?: string;
  city?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface EvaluationResult {
  enabled: boolean;
  variant?: string;
  payload?: any;
  reason: EvaluationReason;
}

export interface EvaluationReason {
  kind:
    | 'enabled'
    | 'disabled'
    | 'notFound'
    | 'constraintFailed'
    | 'rolloutFailed'
    | 'fallback'
    | 'archived';
  message?: string;
  failedConstraint?: {
    contextName: string;
    operator: string;
    value?: string;
  };
}

// ==================== Evaluator Class ====================

export class FeatureEvaluator {
  /**
   * Evaluate a feature flag for a given context
   */
  evaluate(flag: EvaluatableFlagAttributes | null, context: EvaluationContext): EvaluationResult {
    // Flag not found
    if (!flag) {
      return {
        enabled: false,
        reason: { kind: 'notFound', message: 'Flag not found' },
      };
    }

    // Flag is archived
    if (flag.isArchived) {
      return {
        enabled: false,
        reason: { kind: 'archived', message: 'Flag is archived' },
      };
    }

    // Flag is disabled
    if (!flag.isEnabled) {
      return {
        enabled: false,
        reason: { kind: 'disabled', message: 'Flag is disabled' },
      };
    }

    // No strategies means flag is enabled for everyone
    if (!flag.strategies || flag.strategies.length === 0) {
      return this.selectVariant(flag, context, {
        enabled: true,
        reason: { kind: 'enabled', message: 'No strategies, default enabled' },
      });
    }

    // Sort strategies by sortOrder
    const sortedStrategies = [...flag.strategies].sort((a, b) => a.sortOrder - b.sortOrder);

    // Evaluate each strategy in order
    for (const strategy of sortedStrategies) {
      if (!strategy.isEnabled) continue;

      const strategyResult = this.evaluateStrategy(strategy, context);
      if (strategyResult.enabled) {
        return this.selectVariant(flag, context, strategyResult);
      }
    }

    // No strategy matched
    return {
      enabled: false,
      reason: { kind: 'constraintFailed', message: 'No strategy matched' },
    };
  }

  /**
   * Evaluate a single strategy
   */
  private evaluateStrategy(
    strategy: FeatureStrategyAttributes,
    context: EvaluationContext
  ): EvaluationResult {
    // Check constraints
    if (strategy.constraints && strategy.constraints.length > 0) {
      for (const constraint of strategy.constraints) {
        if (!this.evaluateConstraint(constraint, context)) {
          return {
            enabled: false,
            reason: {
              kind: 'constraintFailed',
              message: `Constraint failed: ${constraint.contextName}`,
              failedConstraint: {
                contextName: constraint.contextName,
                operator: constraint.operator,
                value: constraint.value || constraint.values?.join(', '),
              },
            },
          };
        }
      }
    }

    // Check rollout percentage if defined
    const params = strategy.parameters;
    if (params?.rollout !== undefined && params.rollout < 100) {
      const stickiness = params.stickiness || 'userId';
      const groupId = params.groupId || strategy.id;
      const stickinessValue = String(
        context[stickiness] || context.sessionId || context.userId || ''
      );

      const hash = this.normalizedHash(groupId, stickinessValue);
      if (hash > params.rollout) {
        return {
          enabled: false,
          reason: {
            kind: 'rolloutFailed',
            message: `Rollout percentage not met: ${hash} > ${params.rollout}`,
          },
        };
      }
    }

    return {
      enabled: true,
      reason: {
        kind: 'enabled',
        message: `Strategy ${strategy.strategyName} matched`,
      },
    };
  }

  /**
   * Evaluate a constraint against context
   */
  private evaluateConstraint(constraint: Constraint, context: EvaluationContext): boolean {
    const contextValue = context[constraint.contextName];
    const { operator, value, values, caseInsensitive, inverted } = constraint;

    let result = false;

    try {
      result = this.evaluateOperator(operator, contextValue, value, values, caseInsensitive);
    } catch (error) {
      logger.warn(`Error evaluating constraint ${constraint.contextName}:`, error);
      result = false;
    }

    return inverted ? !result : result;
  }

  /**
   * Evaluate an operator against values
   */
  private evaluateOperator(
    operator: ConstraintOperator,
    contextValue: any,
    constraintValue?: string,
    constraintValues?: string[],
    caseInsensitive?: boolean
  ): boolean {
    // Normalize for case insensitive comparison
    const normalize = (v: any): string => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      return caseInsensitive ? str.toLowerCase() : str;
    };

    const ctx = normalize(contextValue);
    const val = constraintValue ? normalize(constraintValue) : '';
    const vals = constraintValues?.map(normalize) || [];

    switch (operator) {
      // String operators
      case 'str_in':
        return vals.includes(ctx);

      case 'str_not_in':
        return !vals.includes(ctx);

      case 'str_eq':
        return ctx === val;

      case 'str_neq':
        return ctx !== val;

      case 'str_ends_with':
        return ctx.endsWith(val);

      case 'str_starts_with':
        return ctx.startsWith(val);

      case 'str_contains':
        return ctx.includes(val);

      case 'str_regex':
        try {
          const flags = caseInsensitive ? 'i' : '';
          const regex = new RegExp(constraintValue || '', flags);
          return regex.test(String(contextValue));
        } catch {
          return false;
        }

      // Boolean operators
      case 'bool_is':
        return (
          ctx === val || (val === 'true' && !!contextValue) || (val === 'false' && !contextValue)
        );

      // Number operators
      case 'num_eq':
        return parseFloat(contextValue) === parseFloat(constraintValue || '0');

      case 'num_gt':
        return parseFloat(contextValue) > parseFloat(constraintValue || '0');

      case 'num_gte':
        return parseFloat(contextValue) >= parseFloat(constraintValue || '0');

      case 'num_lt':
        return parseFloat(contextValue) < parseFloat(constraintValue || '0');

      case 'num_lte':
        return parseFloat(contextValue) <= parseFloat(constraintValue || '0');

      case 'num_in':
        return vals.map(Number).includes(Number(contextValue));

      case 'num_not_in':
        return !vals.map(Number).includes(Number(contextValue));

      // Date operators
      case 'date_gt':
        return new Date(contextValue) > new Date(constraintValue || '');

      case 'date_gte':
        return new Date(contextValue) >= new Date(constraintValue || '');

      case 'date_lt':
        return new Date(contextValue) < new Date(constraintValue || '');

      case 'date_lte':
        return new Date(contextValue) <= new Date(constraintValue || '');

      // Semver operators
      case 'semver_eq':
        return this.compareSemver(contextValue, constraintValue || '') === 0;

      case 'semver_gt':
        return this.compareSemver(contextValue, constraintValue || '') > 0;

      case 'semver_gte':
        return this.compareSemver(contextValue, constraintValue || '') >= 0;

      case 'semver_lt':
        return this.compareSemver(contextValue, constraintValue || '') < 0;

      case 'semver_lte':
        return this.compareSemver(contextValue, constraintValue || '') <= 0;

      case 'semver_in':
        return vals.some((v) => this.compareSemver(contextValue, v) === 0);

      case 'semver_not_in':
        return !vals.some((v) => this.compareSemver(contextValue, v) === 0);

      default:
        logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Select a variant for the context if variants are defined
   */
  private selectVariant(
    flag: FeatureFlagAttributes,
    context: EvaluationContext,
    baseResult: EvaluationResult
  ): EvaluationResult {
    if (!flag.variants || flag.variants.length === 0) {
      return baseResult;
    }

    // Calculate variant based on stickiness (use default since stickiness is not per-variant)
    const stickiness = 'userId';
    const stickinessValue = String(
      context[stickiness] || context.sessionId || context.userId || ''
    );
    const seed = `${flag.id}:${stickinessValue}`;
    const hash = this.normalizedHash(flag.id, stickinessValue);

    // Calculate cumulative weights
    let cumulativeWeight = 0;
    for (const variant of flag.variants) {
      cumulativeWeight += variant.weight;
      if (hash <= cumulativeWeight) {
        return {
          ...baseResult,
          variant: variant.variantName,
          payload: this.parsePayload(variant),
        };
      }
    }

    // Fallback to first variant if weights don't sum to 100
    if (flag.variants.length > 0) {
      const firstVariant = flag.variants[0];
      return {
        ...baseResult,
        variant: firstVariant.variantName,
        payload: this.parsePayload(firstVariant),
      };
    }

    return baseResult;
  }

  /**
   * Parse variant payload based on type
   */
  private parsePayload(variant: FeatureVariantAttributes): any {
    if (!variant.payload) return undefined;

    switch (variant.payloadType) {
      case 'number':
        return Number(variant.payload);
      case 'json':
        if (typeof variant.payload === 'string') {
          try {
            return JSON.parse(variant.payload);
          } catch {
            return variant.payload;
          }
        }
        return variant.payload;
      case 'string':
      default:
        return String(variant.payload);
    }
  }

  /**
   * Generate normalized hash (0-100) for consistent bucketing
   * Uses MurmurHash3 algorithm for consistency with server-sdk
   */
  private normalizedHash(groupId: string, stickinessValue: string): number {
    const seed = `${groupId}:${stickinessValue}`;
    const hash = murmurhash.v3(seed);

    // Normalize to 0-100
    return (hash % 10000) / 100;
  }

  /**
   * Compare semver versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  private compareSemver(a: string, b: string): number {
    const parseVersion = (v: string): number[] => {
      // Remove 'v' prefix if present and split
      const cleaned = v.replace(/^v/, '');
      return cleaned.split('.').map((n) => parseInt(n, 10) || 0);
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLen; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;

      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }

    return 0;
  }
}

export const featureEvaluator = new FeatureEvaluator();
