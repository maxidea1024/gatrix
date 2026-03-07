/**
 * Feature Flag Evaluation Module
 * Exports evaluator and all evaluation-related utilities.
 * Type definitions are re-exported from @gatrix/shared.
 */
export { FeatureFlagEvaluator } from './FeatureFlagEvaluator';
export { EvaluationUtils, truncateToMinute, buildContextQueryParams } from './EvaluationUtils';
export {
  getStrategy,
  evaluateStrategyIsEnabled,
  evaluateStrategyWithDetails,
  normalizedStrategyValue,
} from './strategies/index';

// Re-export types and constants from @gatrix/shared for convenience
export { VALUE_SOURCE } from '@gatrix/shared';
export type { ValueSourceName } from '@gatrix/shared';
export type {
  FeatureFlag,
  FeatureStrategy,
  FeatureSegment,
  Variant,
  Constraint,
  ConstraintOperator,
  StrategyParameters,
  EvaluationContext,
  EvaluationResult,
  EvaluationResultWithDetails,
  EvaluationReason,
  ValueType,
  StrategyEvaluationResult,
} from '@gatrix/shared';
