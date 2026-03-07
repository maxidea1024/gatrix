/**
 * Feature Flag Types and Constants
 * Shared type definitions used across all Gatrix packages (frontend, backend, evaluator, SDK).
 * Evaluation logic lives in @gatrix/evaluator.
 */
export { VALUE_SOURCE } from './value-source';
export type { ValueSourceName } from './value-source';
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
} from './types';
