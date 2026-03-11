/**
 * Feature Flag Evaluation Types
 * Shared across backend, server-sdk, and other packages
 */

// ==================== Core Types ====================

/**
 * Supported value types for feature flag values.
 * Determines how enabledValue/disabledValue are interpreted and coerced.
 * - 'string': plain text value
 * - 'number': numeric value
 * - 'boolean': true/false toggle
 * - 'json': arbitrary JSON object or array
 */
export type ValueType = 'string' | 'number' | 'boolean' | 'json';

/**
 * Operators used in constraints to compare context values against target values.
 * Each operator group works with a specific data type.
 * Use the `inverted` flag on the Constraint to negate any operator's result.
 */
export type ConstraintOperator =
  // String operators (use inverted flag for negation)
  /** Exact string equality */
  | 'str_eq'
  /** Checks if context value contains the target substring */
  | 'str_contains'
  /** Checks if context value starts with the target string */
  | 'str_starts_with'
  /** Checks if context value ends with the target string */
  | 'str_ends_with'
  /** Checks if context value is one of the target values list */
  | 'str_in'
  /** Matches context value against a regular expression pattern */
  | 'str_regex'
  /** Checks if context value (IP address) matches any of the CIDR ranges in the values list */
  | 'cidr_match'
  // Number operators
  /** Numeric equality */
  | 'num_eq'
  /** Greater than */
  | 'num_gt'
  /** Greater than or equal to */
  | 'num_gte'
  /** Less than */
  | 'num_lt'
  /** Less than or equal to */
  | 'num_lte'
  /** Checks if numeric value is one of the target values list */
  | 'num_in'
  // Boolean operators
  /** Checks if boolean value matches target ('true' or 'false' as string) */
  | 'bool_is'
  // Date operators (ISO 8601 string comparison)
  /** Date equality */
  | 'date_eq'
  /** Date is after target */
  | 'date_gt'
  /** Date is on or after target */
  | 'date_gte'
  /** Date is before target */
  | 'date_lt'
  /** Date is on or before target */
  | 'date_lte'
  // Semver operators (semantic versioning comparison)
  /** Semver equality */
  | 'semver_eq'
  /** Semver is newer than target */
  | 'semver_gt'
  /** Semver is same or newer than target */
  | 'semver_gte'
  /** Semver is older than target */
  | 'semver_lt'
  /** Semver is same or older than target */
  | 'semver_lte'
  /** Checks if semver matches one of the target versions */
  | 'semver_in'
  // Common operators (type-agnostic)
  /** Checks if the context field exists and is not null */
  | 'exists'
  /** Checks if the context field is missing or null */
  | 'not_exists'
  // Array operators (context value must be string[])
  /** At least one of the target values exists in the context array */
  | 'arr_any'
  /** All target values exist in the context array */
  | 'arr_all'
  /** Context array is empty, undefined, or not an array */
  | 'arr_empty';

// ==================== Evaluation Context ====================

/**
 * Context passed to flag evaluation.
 * Provides runtime information about the current user, session, and environment.
 * Strategy and constraint logic use these fields to determine flag state.
 */
export interface EvaluationContext {
  /** Unique identifier for the current user. Used by userWithId, gradualRolloutUserId, and flexibleRollout (stickiness) strategies. */
  userId?: string;
  /** Unique identifier for the current session. Used by gradualRolloutSessionId and flexibleRollout (stickiness) strategies. */
  sessionId?: string;
  /** Application name. Used as a fallback groupId for percentage-based strategies. */
  appName?: string;
  /** Application version string. Typically used with semver constraint operators. */
  appVersion?: string;
  /** Client IP address. Used by the remoteAddress strategy for IP/CIDR matching. */
  remoteAddress?: string;
  /** Current timestamp for date-based constraint evaluation. */
  currentTime?: Date;
  /**
   * Custom key-value properties for constraint evaluation.
   * Keys are matched against Constraint.contextName.
   * Also supports string[] for array-type constraint operators (arr_any, arr_all, arr_empty).
   */
  properties?: Record<string, string | number | boolean | string[]>;
}

// ==================== Strategy & Constraint ====================

/**
 * Parameters that configure strategy-specific behavior.
 * Each strategy type uses a different subset of these fields.
 */
export interface StrategyParameters {
  /** Target rollout percentage (0-100). Used by flexibleRollout strategy. */
  rollout?: number;
  /** Determines which context field is used for consistent bucketing. Values: 'default' (userId→sessionId fallback), 'userId', 'sessionId', 'random', or a custom property name. Used by flexibleRollout strategy. */
  stickiness?: string;
  /** Group identifier for hash-based bucketing. Ensures different flags produce different bucket distributions for the same user. Used by flexibleRollout, gradualRolloutUserId, gradualRolloutSessionId strategies. */
  groupId?: string;
  /** Target percentage (0-100). Used by gradualRolloutUserId, gradualRolloutRandom, gradualRolloutSessionId strategies. */
  percentage?: number;
  /** Comma-separated list of user IDs to target. Used by userWithId strategy. */
  userIds?: string;
  /** Comma-separated list of IP addresses or CIDR ranges (e.g., "192.168.1.0/24"). Used by remoteAddress strategy. */
  IPs?: string;
  /** Comma-separated list of allowed hostnames. Used by applicationHostname strategy. */
  hostNames?: string;
}

/**
 * A single constraint rule that compares a context value against target value(s).
 * Constraints are evaluated as part of strategy or segment targeting.
 */
export interface Constraint {
  /** Name of the context field to evaluate (e.g., 'userId', 'appVersion', or a custom property key). */
  contextName: string;
  /** Comparison operator to apply between the context value and target value(s). */
  operator: ConstraintOperator;
  /** Single target value for comparison. Used by most operators (str_eq, num_gt, date_lt, etc.). */
  value?: string;
  /** Multiple target values for list-based operators (str_in, num_in, semver_in, arr_any, arr_all). */
  values?: string[];
  /** When true, string comparisons are performed in a case-insensitive manner. Applies to string and array operators. */
  caseInsensitive?: boolean;
  /** When true, the final result of the constraint evaluation is negated (logical NOT). */
  inverted?: boolean;
}

// ==================== Variant ====================

/**
 * A named variation of a feature flag's value.
 * When a flag is enabled and has variants, one variant is selected
 * based on weighted distribution using the evaluation context.
 */
export interface Variant {
  /** Unique name identifying this variant (e.g., 'control', 'treatment-a'). Also serves as the variant key in metrics. */
  name: string;
  /** Relative weight for random distribution (0-100). Higher weight = higher probability of selection. Total weights across all variants determine the distribution ratio. */
  weight: number;
  /** The value returned when this variant is selected. Type depends on the flag's valueType (string, number, boolean, or JSON object). */
  value: any;
  /** Whether this variant represents an "enabled" state. Always true for variants selected from enabled flags. */
  enabled: boolean;
}

// ==================== Segment ====================

/**
 * Feature Segment - a reusable, named set of constraints.
 * Segments are global (not environment-specific) and can be
 * referenced by multiple strategies across different flags.
 * This allows sharing common targeting rules without duplication.
 */
export interface FeatureSegment {
  /** Unique segment name. Referenced by FeatureStrategy.segments. */
  name: string;
  /** List of constraints that must ALL pass for this segment to match (AND logic). */
  constraints: Constraint[];
  /** UI-only toggle for segment visibility. NOT used in evaluation logic — even inactive segments are evaluated when referenced. */
  isActive: boolean;
}

// ==================== Strategy ====================

/**
 * Feature Strategy - a targeting rule attached to a feature flag.
 * Evaluation order: segments → constraints → strategy-specific logic (rollout, etc.)
 * A flag is enabled if ANY of its enabled strategies match (OR logic between strategies).
 */
export interface FeatureStrategy {
  /** Strategy type name. Must match a registered strategy class (e.g., 'default', 'flexibleRollout', 'userWithId', 'gradualRolloutUserId', 'gradualRolloutRandom', 'gradualRolloutSessionId', 'remoteAddress', 'applicationHostname'). */
  name: string;
  /** Strategy-specific configuration parameters. Each strategy type uses different parameter fields. */
  parameters?: StrategyParameters;
  /** Constraints that must ALL pass before strategy logic is evaluated (AND logic). Checked after segment constraints. */
  constraints?: Constraint[];
  /** Segment names referenced by this strategy. All referenced segments must pass (AND logic). Evaluated before strategy constraints. */
  segments?: string[];
  /** Whether this strategy is active. Disabled strategies are skipped during evaluation. */
  isEnabled: boolean;
}

// ==================== Feature Flag ====================

/**
 * Feature Flag - core flag definition for evaluation.
 * Contains only data fields required for runtime evaluation.
 * isArchived is intentionally excluded — it is a management-only field
 * that should be filtered before evaluation.
 */
export interface FeatureFlag {
  /** Unique flag identifier (UUID). Used in evaluation results and metrics. */
  id: string;
  /** Human-readable flag name (unique per project). Used as a lookup key. */
  name: string;
  /** Master toggle. When false, the flag always returns disabledValue regardless of strategies. */
  isEnabled: boolean;
  /** When true, impression/metric events are emitted on each evaluation. Used for analytics integration. */
  impressionDataEnabled: boolean;
  /** Ordered list of targeting strategies. Evaluated sequentially; first match wins (OR logic). */
  strategies: FeatureStrategy[];
  /** Weighted variants for A/B testing. If empty, the flag returns enabledValue/disabledValue directly. */
  variants: Variant[];
  /** Declared type of the flag's value. Used for type coercion and validation of enabledValue/disabledValue. */
  valueType: ValueType;
  /** Value returned when the flag evaluates to enabled (after strategy matching). Type should match valueType. */
  enabledValue: any;
  /** Value returned when the flag evaluates to disabled (master toggle off or no strategy matched). Type should match valueType. */
  disabledValue: any;
  /** Where enabledValue/disabledValue originate: 'environment' if from env override, 'flag' if from global default. Affects the variant name in evaluation results. */
  valueSource?: 'environment' | 'flag';
  /** Flag configuration version, incremented on each modification. Can be used for change detection or caching. */
  version?: number;
  /** When true, this flag was returned in compact mode — strategies, variants, and enabledValue were stripped to reduce payload size. Compact flags always evaluate to disabled. */
  compact?: boolean;
}

// ==================== Evaluation Result ====================

/**
 * Reason codes indicating why a flag evaluated to its current state.
 * Useful for debugging, logging, and understanding evaluation flow.
 */
export type EvaluationReason =
  /** Flag is enabled (generic enabled state) */
  | 'enabled'
  /** Flag's isEnabled master toggle is false */
  | 'disabled'
  /** A specific strategy matched the evaluation context */
  | 'strategy_match'
  /** A constraint within a strategy matched */
  | 'constraint_match'
  /** Percentage-based rollout determined the result */
  | 'rollout'
  /** Default fallback when flag is enabled but no strategies exist, or strategies exist but none matched */
  | 'default'
  /** Flag was not found in the feature store */
  | 'not_found'
  /** An error occurred during evaluation */
  | 'error';

/**
 * Result of evaluating a feature flag.
 * Contains the final enabled/disabled state, selected variant, and evaluation reason.
 */
export interface EvaluationResult {
  /** Flag identifier (matches FeatureFlag.id) */
  id: string;
  /** Flag name (matches FeatureFlag.name) */
  flagName: string;
  /** Final evaluation result — whether the flag is enabled for the given context */
  enabled: boolean;
  /** Selected variant containing the returned value, weight, and name */
  variant: Variant;
  /** Why the flag evaluated to this state */
  reason: EvaluationReason;
}

/**
 * Extended evaluation result with additional debugging information.
 * Used by editor/playground for detailed evaluation inspection.
 */
export interface EvaluationResultWithDetails extends EvaluationResult {
  /** Name of the strategy that matched (if reason is 'strategy_match') */
  matchedStrategy?: string;
  /** Time taken to evaluate the flag in milliseconds */
  evaluationTimeMs?: number;
}

// ==================== Strategy Evaluation Result ====================

/**
 * Result returned by a strategy's isEnabledWithDetails() method.
 * Provides detailed reasoning for debugging and editor/playground use.
 * The regular isEnabled() method returns only the boolean for runtime performance.
 */
export interface StrategyEvaluationResult {
  /** Whether the strategy determined the flag should be enabled */
  enabled: boolean;
  /** Human-readable explanation of why the strategy returned this result */
  reason: string;
  /** Optional strategy-specific details (e.g., normalized hash values, matched ranges, stickiness info) */
  details?: Record<string, unknown>;
}
