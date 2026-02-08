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
  ConstraintOperator,
  PayloadType,
} from '../types/featureFlags';

export class FeatureFlagEvaluator {
  /**
   * Evaluate a single flag
   */
  static evaluate(
    flag: FeatureFlag,
    context: EvaluationContext,
    segmentsMap: Map<string, FeatureSegment>
  ): EvaluationResult {
    // Basic state
    let reason: EvaluationReason = 'disabled';

    if (flag.isEnabled) {
      const activeStrategies = flag.strategies?.filter((s) => s.isEnabled) || [];

      if (activeStrategies.length > 0) {
        for (const strategy of activeStrategies) {
          if (this.evaluateStrategy(strategy, context, flag, segmentsMap)) {
            const variantData = this.selectVariant(flag, context, strategy);
            const variant: Variant = variantData
              ? { ...variantData, enabled: true }
              : {
                  name: 'default',
                  weight: 100,
                  payload: flag.baselinePayload ?? null,
                  payloadType: flag.variantType || 'string',
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
        // If we have strategies but none matched
        reason = 'default';
      } else {
        // No strategies or all strategies are disabled - enabled by default
        const variantData = this.selectVariant(flag, context);
        const variant: Variant = variantData
          ? { ...variantData, enabled: true }
          : {
              name: 'default',
              weight: 100,
              payload: flag.baselinePayload ?? null,
              payloadType: flag.variantType || 'string',
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

    // Default return path (disabled or no strategy matched)
    return {
      id: flag.id || '',
      flagName: flag.name,
      enabled: false,
      reason,
      variant: {
        name: 'disabled',
        weight: 100,
        payload: flag.baselinePayload ?? null,
        payloadType: flag.variantType || 'string',
        enabled: false,
      },
    };
  }

  private static evaluateStrategy(
    strategy: FeatureStrategy,
    context: EvaluationContext,
    flag: FeatureFlag,
    segmentsMap: Map<string, FeatureSegment>
  ): boolean {
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

    if (strategy.constraints && strategy.constraints.length > 0) {
      const allConstraintsPass = strategy.constraints.every((c) =>
        this.evaluateConstraint(c, context)
      );
      if (!allConstraintsPass) return false;
    }

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

    if (contextValue === undefined) {
      return constraint.inverted ? true : false;
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
      case 'str_neq':
        result = compareValue !== targetValue;
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
      case 'str_not_in':
        result = !targetValues.includes(compareValue);
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
      case 'num_not_in':
        result = !targetValues.map(Number).includes(Number(contextValue));
        break;
      // Boolean
      case 'bool_is':
        result = Boolean(contextValue) === (constraint.value === 'true');
        break;
      // Date
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
      case 'semver_not_in':
        result = !targetValues.some((v) => this.compareSemver(stringValue, v) === 0);
        break;
      default:
        result = false;
    }

    return constraint.inverted ? !result : result;
  }

  private static getContextValue(name: string, context: EvaluationContext): any {
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
