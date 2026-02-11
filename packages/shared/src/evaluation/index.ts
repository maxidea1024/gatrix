/**
 * Feature Flag Evaluation Module
 * Exports evaluator and all evaluation-related types
 */
export { FeatureFlagEvaluator } from './FeatureFlagEvaluator';
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
