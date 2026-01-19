/**
 * Feature Flag Types for Server SDK
 */

// ==================== Core Types ====================

export type FlagType = 'release' | 'experiment' | 'operational' | 'permission';
export type PayloadType = 'string' | 'number' | 'boolean' | 'json';
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'semver';

export type ConstraintOperator =
    // String operators
    | 'eq' | 'neq' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn'
    // Number operators
    | 'gt' | 'gte' | 'lt' | 'lte'
    // Boolean operators
    | 'is'
    // Date operators
    | 'after' | 'before'
    // Semver operators
    | 'semverEq' | 'semverGt' | 'semverGte' | 'semverLt' | 'semverLte';

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
