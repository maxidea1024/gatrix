/**
 * Feature Flag Types for Server SDK
 * Re-exports evaluation types from @gatrix/shared and adds SDK-specific types
 */

// Re-export all evaluation types from shared
export type {
  ValueType,
  ConstraintOperator,
  EvaluationContext,
  StrategyParameters,
  Constraint,
  Variant,
  FeatureSegment,
  FeatureStrategy,
  FeatureFlag,
  EvaluationReason,
  EvaluationResult,
  EvaluationResultWithDetails,
} from '@gatrix/shared';

// Import types for local usage
import type { FeatureFlag } from '@gatrix/shared';

// SDK-specific types below
export type FlagType =
  | 'release'
  | 'experiment'
  | 'operational'
  | 'killSwitch'
  | 'permission'
  | 'remoteConfig';
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'semver';

// ==================== API Response Types ====================

export interface FeatureFlagsResponse {
  flags: FeatureFlag[];
}

export interface FeatureFlagResponse {
  flag: FeatureFlag;
}

// ==================== Metrics ====================

export interface FlagMetric {
  environment: string;
  flagName: string;
  enabled: boolean;
  variantName?: string;
  timestamp: Date;
}
