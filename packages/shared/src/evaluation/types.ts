/**
 * Feature Flag Evaluation Types
 * Shared across backend, server-sdk, and other packages
 */

// ==================== Core Types ====================

export type ValueType = 'string' | 'number' | 'boolean' | 'json';

export type ConstraintOperator =
  // String operators (use inverted flag for negation)
  | 'str_eq'
  | 'str_contains'
  | 'str_starts_with'
  | 'str_ends_with'
  | 'str_in'
  | 'str_regex'
  // Number operators
  | 'num_eq'
  | 'num_gt'
  | 'num_gte'
  | 'num_lt'
  | 'num_lte'
  | 'num_in'
  // Boolean operators
  | 'bool_is'
  // Date operators
  | 'date_eq'
  | 'date_gt'
  | 'date_gte'
  | 'date_lt'
  | 'date_lte'
  // Semver operators
  | 'semver_eq'
  | 'semver_gt'
  | 'semver_gte'
  | 'semver_lt'
  | 'semver_lte'
  | 'semver_in'
  // Common operators (type-agnostic)
  | 'exists'
  | 'not_exists'
  // Array operators
  | 'arr_includes'
  | 'arr_all'
  | 'arr_empty';

// ==================== Evaluation Context ====================

/**
 * Context passed to flag evaluation
 */
export interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  appName?: string;
  appVersion?: string;
  remoteAddress?: string;
  environment?: string;
  currentTime?: Date;
  // Custom properties (string[] for array-type context fields)
  properties?: Record<string, string | number | boolean | string[]>;
}

// ==================== Strategy & Constraint ====================

export interface StrategyParameters {
  rollout?: number;
  stickiness?: string;
  groupId?: string;
}

export interface Constraint {
  contextName: string;
  operator: ConstraintOperator;
  value?: string;
  values?: string[];
  caseInsensitive?: boolean;
  inverted?: boolean;
}

// ==================== Variant ====================

export interface Variant {
  name: string;
  weight: number;
  value?: any;
  valueType?: ValueType;
  enabled?: boolean;
}

// ==================== Segment ====================

/**
 * Feature Segment - reusable set of constraints
 * Segments are global (not environment-specific)
 * isActive is for UI display only, not for evaluation
 */
export interface FeatureSegment {
  name: string;
  constraints: Constraint[];
  isActive: boolean;
}

// ==================== Strategy ====================

/**
 * Feature Strategy - targeting rule
 * Contains only data fields required for runtime evaluation
 */
export interface FeatureStrategy {
  name: string;
  parameters?: StrategyParameters;
  constraints?: Constraint[];
  segments?: string[]; // Segment names (references, not objects)
  isEnabled: boolean;
}

// ==================== Feature Flag ====================

/**
 * Feature Flag - core flag definition for evaluation
 * Contains only data fields required for runtime evaluation
 * isArchived is intentionally excluded - it is a management-only field
 */
export interface FeatureFlag {
  id: string;
  name: string;
  isEnabled: boolean;
  impressionDataEnabled: boolean;
  strategies: FeatureStrategy[];
  variants: Variant[];
  valueType?: ValueType;
  enabledValue?: any;
  disabledValue?: any;
  version?: number;
}

// ==================== Evaluation Result ====================

export type EvaluationReason =
  | 'enabled'
  | 'disabled'
  | 'strategy_match'
  | 'constraint_match'
  | 'rollout'
  | 'default'
  | 'not_found'
  | 'error';

export interface EvaluationResult {
  id: string;
  flagName: string;
  enabled: boolean;
  variant: Variant;
  reason: EvaluationReason;
}

export interface EvaluationResultWithDetails extends EvaluationResult {
  matchedStrategy?: string;
  evaluationTimeMs?: number;
}
