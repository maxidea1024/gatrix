/**
 * Feature Flag Types for Server SDK
 */

// ==================== Core Types ====================

export type FlagType =
  | "release"
  | "experiment"
  | "operational"
  | "killSwitch"
  | "permission";
export type PayloadType = "string" | "number" | "boolean" | "json";
export type FieldType = "string" | "number" | "boolean" | "date" | "semver";

export type ConstraintOperator =
  // String operators (legacy)
  | "eq"
  | "neq"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "in"
  | "notIn"
  // String operators (prefixed - backend format)
  | "str_eq"
  | "str_neq"
  | "str_contains"
  | "str_starts_with"
  | "str_ends_with"
  | "str_in"
  | "str_not_in"
  // Number operators (legacy)
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  // Number operators (prefixed - backend format)
  | "num_eq"
  | "num_gt"
  | "num_gte"
  | "num_lt"
  | "num_lte"
  // Boolean operators
  | "is"
  | "bool_is"
  // Date operators (legacy)
  | "after"
  | "before"
  // Date operators (prefixed - backend format)
  | "date_gt"
  | "date_gte"
  | "date_lt"
  | "date_lte"
  // Semver operators (legacy)
  | "semverEq"
  | "semverGt"
  | "semverGte"
  | "semverLt"
  | "semverLte"
  // Semver operators (prefixed - backend format)
  | "semver_eq"
  | "semver_gt"
  | "semver_gte"
  | "semver_lt"
  | "semver_lte";

// ==================== Evaluation Context ====================

/**
 * Context passed to flag evaluation
 */
export interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  environmentName?: string;
  appName?: string;
  appVersion?: string;
  country?: string;
  city?: string;
  ip?: string;
  userAgent?: string;
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

export interface VariantOverride {
  contextName: string;
  values: string[];
}

// ==================== Variant ====================

export interface Variant {
  name: string;
  weight: number;
  payload?: any;
  payloadType?: PayloadType;
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
  name: string;
  isEnabled: boolean;
  impressionDataEnabled: boolean; // Whether to emit impression events
  strategies: FeatureStrategy[];
  variants: Variant[];
}

// ==================== Evaluation Result ====================

export type EvaluationReason =
  | "enabled"
  | "disabled"
  | "strategy_match"
  | "constraint_match"
  | "rollout"
  | "default"
  | "not_found"
  | "error";

export interface EvaluationResult {
  flagName: string;
  enabled: boolean;
  variant?: Variant;
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
