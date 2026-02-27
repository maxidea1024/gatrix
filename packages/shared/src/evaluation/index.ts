/**
 * Feature Flag Evaluation Module
 * Exports evaluator and all evaluation-related types
 */
export { FeatureFlagEvaluator } from './FeatureFlagEvaluator';
export { VARIANT_SOURCE } from './variantSource';
export { EvaluationUtils, truncateToMinute, buildContextQueryParams } from './EvaluationUtils';
export type { VariantSourceName } from './variantSource';
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
