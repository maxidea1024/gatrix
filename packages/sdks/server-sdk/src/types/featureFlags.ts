/**
 * Feature Flag Types for Server SDK
 */

// ==================== Core Types ====================

export type FlagType = 'release' | 'experiment' | 'operational' | 'permission';
export type PayloadType = 'string' | 'number' | 'boolean' | 'json';
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'semver';

export type ConstraintOperator =
    // String operators (legacy)
    | 'eq' | 'neq' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn'
    // String operators (prefixed - backend format)
    | 'str_eq' | 'str_neq' | 'str_contains' | 'str_starts_with' | 'str_ends_with' | 'str_in' | 'str_not_in'
    // Number operators (legacy)
    | 'gt' | 'gte' | 'lt' | 'lte'
    // Number operators (prefixed - backend format)
    | 'num_eq' | 'num_gt' | 'num_gte' | 'num_lt' | 'num_lte'
    // Boolean operators
    | 'is' | 'bool_is'
    // Date operators (legacy)
    | 'after' | 'before'
    // Date operators (prefixed - backend format)
    | 'date_gt' | 'date_gte' | 'date_lt' | 'date_lte'
    // Semver operators (legacy)
    | 'semverEq' | 'semverGt' | 'semverGte' | 'semverLt' | 'semverLte'
    // Semver operators (prefixed - backend format)
    | 'semver_eq' | 'semver_gt' | 'semver_gte' | 'semver_lt' | 'semver_lte';

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
    payload?: any;
    payloadType?: PayloadType;
    weight: number;
    stickiness?: string;
}

// ==================== Strategy ====================

export interface FeatureStrategy {
    id: string;
    name: string;
    parameters?: StrategyParameters;
    constraints?: Constraint[];
    sortOrder: number;
    isEnabled: boolean;
}

// ==================== Feature Flag ====================

export interface FeatureFlag {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    type: FlagType;
    isEnabled: boolean;
    impressionDataEnabled: boolean;
    strategies: FeatureStrategy[];
    variants: Variant[];
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
    flagName: string;
    enabled: boolean;
    variantName?: string;
    timestamp: Date;
}
