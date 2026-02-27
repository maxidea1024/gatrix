/**
 * Feature Flag Evaluation Module
 * Exports evaluator and all evaluation-related types
 */
export { FeatureFlagEvaluator } from './FeatureFlagEvaluator';
export { VALUE_SOURCE } from './valueSource';
export { EvaluationUtils, truncateToMinute, buildContextQueryParams } from './EvaluationUtils';
export type { ValueSourceName } from './valueSource';
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
} from './types';
