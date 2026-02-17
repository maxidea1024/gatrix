/**
 * Feature Flag Evaluator
 * Central evaluation logic shared across all Gatrix packages.
 *
 * Key design decisions:
 * - isArchived is NOT checked here. It is a management-only field.
 * - Segment constraints are evaluated BEFORE strategy constraints.
 * - isActive on segments is for UI display only, not for evaluation.
 */

const murmurhash = require('murmurhash');
import {
  FeatureFlag,
  FeatureStrategy,
  EvaluationContext,
  EvaluationResult,
  EvaluationReason,
  Variant,
  FeatureSegment,
  Constraint,
} from './types';
import { VARIANT_SOURCE } from './variantSource';

export class FeatureFlagEvaluator {
  /**
   * Evaluate a single flag
   */
  static evaluate(
    flag: FeatureFlag,
    context: EvaluationContext,
    segmentsMap: Map<string, FeatureSegment>
  ): EvaluationResult {
    let reason: EvaluationReason = 'disabled';

    if (flag.isEnabled) {
      const activeStrategies = flag.strategies?.filter((s) => s.isEnabled) || [];

      if (activeStrategies.length > 0) {
        for (const strategy of activeStrategies) {
          if (this.evaluateStrategy(strategy, context, flag, segmentsMap)) {
            const variantData = this.selectVariant(flag, context, strategy);
            const variant: Variant = {
              name: variantData?.name || VARIANT_SOURCE.FLAG_DEFAULT_ENABLED,
              weight: variantData?.weight || 100,
              value: this.getFallbackValue(variantData?.value ?? flag.enabledValue, flag.valueType),
              valueType: flag.valueType || 'string',
              enabled: true,
            };

            return {
              id: flag.id || '',
              flagName: flag.name,
              enabled: true,
              reason: 'strategy_match',
              variant,
            };
          }
        }
        // Strategies exist but none matched
        reason = 'default';
      } else {
        // No strategies or all disabled - enabled by default
        const variantData = this.selectVariant(flag, context);
        const variant: Variant = {
          name: variantData?.name || VARIANT_SOURCE.FLAG_DEFAULT_ENABLED,
          weight: variantData?.weight || 100,
          value: this.getFallbackValue(variantData?.value ?? flag.enabledValue, flag.valueType),
          valueType: flag.valueType || 'string',
          enabled: true,
        };

        return {
          id: flag.id || '',
          flagName: flag.name,
          enabled: true,
          reason: 'default',
          variant,
        };
      }
    } else {
      reason = 'disabled';
    }

    // Disabled or no strategy matched
    return {
      id: flag.id || '',
      flagName: flag.name,
      enabled: false,
      reason,
      variant: {
        name: VARIANT_SOURCE.FLAG_DEFAULT_DISABLED,
        weight: 100,
        value: this.getFallbackValue(flag.disabledValue, flag.valueType),
        valueType: flag.valueType || 'string',
        enabled: false,
      },
    };
  }

  /**
   * Evaluate a single strategy
   * Order: segments -> constraints -> rollout
   */
  private static evaluateStrategy(
    strategy: FeatureStrategy,
    context: EvaluationContext,
    flag: FeatureFlag,
    segmentsMap: Map<string, FeatureSegment>
  ): boolean {
    // 1. Check segment constraints (all referenced segments must pass)
    if (strategy.segments && strategy.segments.length > 0) {
      for (const segmentName of strategy.segments) {
        const segment = segmentsMap.get(segmentName);
        // isActive is for UI display only, not for evaluation
        if (!segment) continue;

        if (segment.constraints && segment.constraints.length > 0) {
          const segmentPass = segment.constraints.every((c) => this.evaluateConstraint(c, context));
          if (!segmentPass) return false;
        }
      }
    }

    // 2. Check strategy constraints
    if (strategy.constraints && strategy.constraints.length > 0) {
      const allConstraintsPass = strategy.constraints.every((c) =>
        this.evaluateConstraint(c, context)
      );
      if (!allConstraintsPass) return false;
    }

    // 3. Check rollout percentage
    const rollout = strategy.parameters?.rollout ?? 100;
    if (rollout < 100) {
      const stickiness = strategy.parameters?.stickiness || 'default';
      const groupId = strategy.parameters?.groupId || flag.name;
      const percentage = this.calculatePercentage(context, stickiness, groupId);
      if (percentage > rollout) return false;
    }

    return true;
  }

  private static evaluateConstraint(constraint: Constraint, context: EvaluationContext): boolean {
    const contextValue = this.getContextValue(constraint.contextName, context);

    // Handle exists/not_exists BEFORE undefined check
    if (constraint.operator === 'exists') {
      const result = contextValue !== undefined && contextValue !== null;
      return constraint.inverted ? !result : result;
    }
    if (constraint.operator === 'not_exists') {
      const result = contextValue === undefined || contextValue === null;
      return constraint.inverted ? !result : result;
    }

    // Handle arr_empty BEFORE undefined check (undefined is considered empty)
    if (constraint.operator === 'arr_empty') {
      const result = !Array.isArray(contextValue) || contextValue.length === 0;
      return constraint.inverted ? !result : result;
    }

    if (contextValue === undefined) {
      return constraint.inverted ? true : false;
    }

    // Array operators
    if (constraint.operator === 'arr_any' || constraint.operator === 'arr_all') {
      const arr = Array.isArray(contextValue) ? contextValue.map(String) : [];
      const targetValues =
        constraint.values?.map((v) => (constraint.caseInsensitive ? v.toLowerCase() : v)) || [];
      const compareArr = constraint.caseInsensitive ? arr.map((v) => v.toLowerCase()) : arr;

      let result = false;
      if (constraint.operator === 'arr_any') {
        // At least one target value is in the array
        result = targetValues.some((tv) => compareArr.includes(tv));
      } else {
        // All target values are in the array
        result = targetValues.length > 0 && targetValues.every((tv) => compareArr.includes(tv));
      }
      return constraint.inverted ? !result : result;
    }

    const stringValue = String(contextValue);
    const compareValue = constraint.caseInsensitive ? stringValue.toLowerCase() : stringValue;
    const targetValue = constraint.value
      ? constraint.caseInsensitive
        ? constraint.value.toLowerCase()
        : constraint.value
      : '';
    const targetValues =
      constraint.values?.map((v) => (constraint.caseInsensitive ? v.toLowerCase() : v)) || [];

    let result = false;

    switch (constraint.operator) {
      // String
      case 'str_eq':
        result = compareValue === targetValue;
        break;
      case 'str_contains':
        result = compareValue.includes(targetValue);
        break;
      case 'str_starts_with':
        result = compareValue.startsWith(targetValue);
        break;
      case 'str_ends_with':
        result = compareValue.endsWith(targetValue);
        break;
      case 'str_in':
        result = targetValues.includes(compareValue);
        break;
      case 'str_regex':
        try {
          const flags = constraint.caseInsensitive ? 'i' : '';
          const regex = new RegExp(constraint.value || '', flags);
          result = regex.test(stringValue);
        } catch {
          result = false;
        }
        break;
      // Number
      case 'num_eq':
        result = Number(contextValue) === Number(constraint.value);
        break;
      case 'num_gt':
        result = Number(contextValue) > Number(constraint.value);
        break;
      case 'num_gte':
        result = Number(contextValue) >= Number(constraint.value);
        break;
      case 'num_lt':
        result = Number(contextValue) < Number(constraint.value);
        break;
      case 'num_lte':
        result = Number(contextValue) <= Number(constraint.value);
        break;
      case 'num_in':
        result = targetValues.map(Number).includes(Number(contextValue));
        break;
      // Boolean
      case 'bool_is':
        result = Boolean(contextValue) === (constraint.value === 'true');
        break;
      // Date
      case 'date_eq':
        result = new Date(stringValue).getTime() === new Date(targetValue).getTime();
        break;
      case 'date_gt':
        result = new Date(stringValue) > new Date(targetValue);
        break;
      case 'date_gte':
        result = new Date(stringValue) >= new Date(targetValue);
        break;
      case 'date_lt':
        result = new Date(stringValue) < new Date(targetValue);
        break;
      case 'date_lte':
        result = new Date(stringValue) <= new Date(targetValue);
        break;
      // Semver
      case 'semver_eq':
        result = this.compareSemver(stringValue, targetValue) === 0;
        break;
      case 'semver_gt':
        result = this.compareSemver(stringValue, targetValue) > 0;
        break;
      case 'semver_gte':
        result = this.compareSemver(stringValue, targetValue) >= 0;
        break;
      case 'semver_lt':
        result = this.compareSemver(stringValue, targetValue) < 0;
        break;
      case 'semver_lte':
        result = this.compareSemver(stringValue, targetValue) <= 0;
        break;
      case 'semver_in':
        result = targetValues.some((v) => this.compareSemver(stringValue, v) === 0);
        break;
      default:
        result = false;
    }

    return constraint.inverted ? !result : result;
  }

  private static getContextValue(
    name: string,
    context: EvaluationContext
  ): string | number | boolean | string[] | undefined {
    switch (name) {
      case 'userId':
        return context.userId;
      case 'sessionId':
        return context.sessionId;
      case 'appName':
        return context.appName;
      case 'appVersion':
        return context.appVersion;
      case 'remoteAddress':
        return context.remoteAddress;
      default:
        return context.properties?.[name];
    }
  }

  private static calculatePercentage(
    context: EvaluationContext,
    stickiness: string,
    groupId: string
  ): number {
    let stickinessValue = '';
    if (stickiness === 'default' || stickiness === 'userId') {
      stickinessValue = context.userId || context.sessionId || String(Math.random());
    } else if (stickiness === 'sessionId') {
      stickinessValue = context.sessionId || String(Math.random());
    } else if (stickiness === 'random') {
      stickinessValue = String(Math.random());
    } else {
      stickinessValue = String(this.getContextValue(stickiness, context) || Math.random());
    }

    const seed = `${groupId}:${stickinessValue}`;
    const hash = murmurhash.v3(seed);
    return (hash % 10000) / 100;
  }

  /**
   * Get a fallback value for a given type if the primary value is null/undefined.
   */
  public static getFallbackValue(value: any, valueType?: string): any {
    if (value !== undefined && value !== null) {
      return value;
    }

    switch (valueType) {
      case 'boolean':
        return false;
      case 'number':
        return 0;
      case 'json':
        return {};
      case 'string':
      default:
        return '';
    }
  }

  private static selectVariant(
    flag: FeatureFlag,
    context: EvaluationContext,
    matchedStrategy?: FeatureStrategy
  ): Variant | undefined {
    if (!flag.variants || flag.variants.length === 0) return undefined;

    const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight <= 0) return undefined;

    const stickiness = matchedStrategy?.parameters?.stickiness || 'default';
    const percentage = this.calculatePercentage(context, stickiness, `${flag.name}-variant`);
    const targetWeight = (percentage / 100) * totalWeight;

    let cumulativeWeight = 0;
    for (const variant of flag.variants) {
      cumulativeWeight += variant.weight;
      if (targetWeight <= cumulativeWeight) return variant;
    }
    return flag.variants[flag.variants.length - 1];
  }

  private static compareSemver(a: string, b: string): number {
    const parseVersion = (v: string): number[] => {
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
