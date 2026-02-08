/**
 * Feature Flag Types for Server SDK
 */

// ==================== Core Types ====================

export type FlagType = 'release' | 'experiment' | 'operational' | 'killSwitch' | 'permission';
export type PayloadType = 'string' | 'number' | 'json';
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'semver';

export type ConstraintOperator =
  // String operators
  | 'str_eq'
  | 'str_neq'
  | 'str_contains'
  | 'str_starts_with'
  | 'str_ends_with'
  | 'str_in'
  | 'str_not_in'
  | 'str_regex'
  // Number operators
  | 'num_eq'
  | 'num_gt'
  | 'num_gte'
  | 'num_lt'
  | 'num_lte'
  | 'num_in'
  | 'num_not_in'
  // Boolean operators
  | 'bool_is'
  // Date operators
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
  | 'semver_not_in';

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
  // Custom properties
  properties?: Record<string, string | number | boolean>;
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
  payload?: any;
  payloadType?: PayloadType;
  enabled?: boolean;
}

// ==================== Segment ====================

/**
 * Feature Segment - reusable set of constraints
 * Segments are global (not environment-specific)
 * Contains only data fields required for runtime evaluation
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
 * Strategies are already sorted by backend, no need for sortOrder
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
 * Feature Flag - core flag definition
 * Contains only data fields required for runtime evaluation
 */
export interface FeatureFlag {
  id: string; // Unique identifier (ULID)
  name: string;
  isEnabled: boolean;
  impressionDataEnabled: boolean; // Whether to emit impression events
  strategies: FeatureStrategy[];
  variants: Variant[];
  variantType?: PayloadType; // Type of variant payload
  baselinePayload?: any; // Payload value when flag evaluates to false
  version?: number; // Flag version (increments on update)
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
