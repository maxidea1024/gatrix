import { Model } from 'objection';
import { BaseModel } from './BaseModel';

/**
 * Feature Flag Model
 * Represents a feature flag definition
 */
export class FeatureFlag extends BaseModel {
    static tableName = 'g_feature_flags';

    id!: number;
    environment!: string;
    flagName!: string;
    displayName?: string;
    description?: string;
    flagType!: 'release' | 'experiment' | 'operational' | 'permission';
    isEnabled!: boolean;
    isArchived!: boolean;
    archivedAt?: Date;
    impressionDataEnabled!: boolean;
    lastSeenAt?: Date;
    staleAfterDays!: number;
    tags?: string[];
    createdBy!: number;
    updatedBy?: number;
    createdAt!: Date;
    updatedAt!: Date;

    // Relations
    strategies?: FeatureStrategy[];
    variants?: FeatureVariant[];

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['environment', 'flagName', 'createdBy'],
            properties: {
                id: { type: 'integer' },
                environment: { type: 'string', maxLength: 100 },
                flagName: { type: 'string', maxLength: 255 },
                displayName: { type: ['string', 'null'], maxLength: 500 },
                description: { type: ['string', 'null'] },
                flagType: { type: 'string', enum: ['release', 'experiment', 'operational', 'permission'] },
                isEnabled: { type: 'boolean' },
                isArchived: { type: 'boolean' },
                archivedAt: { type: ['string', 'null'], format: 'date-time' },
                impressionDataEnabled: { type: 'boolean' },
                lastSeenAt: { type: ['string', 'null'], format: 'date-time' },
                staleAfterDays: { type: 'integer' },
                tags: { type: ['array', 'null'], items: { type: 'string' } },
                createdBy: { type: 'integer' },
                updatedBy: { type: ['integer', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        };
    }

    static get relationMappings() {
        return {
            strategies: {
                relation: Model.HasManyRelation,
                modelClass: FeatureStrategy,
                join: {
                    from: 'g_feature_flags.id',
                    to: 'g_feature_strategies.flagId',
                },
            },
            variants: {
                relation: Model.HasManyRelation,
                modelClass: FeatureVariant,
                join: {
                    from: 'g_feature_flags.id',
                    to: 'g_feature_variants.flagId',
                },
            },
        };
    }
}

/**
 * Feature Strategy Model
 * Represents a targeting strategy for a feature flag
 */
export class FeatureStrategy extends BaseModel {
    static tableName = 'g_feature_strategies';

    id!: number;
    flagId!: number;
    strategyName!: string;
    parameters?: StrategyParameters;
    constraints?: Constraint[];
    sortOrder!: number;
    isEnabled!: boolean;
    createdBy!: number;
    updatedBy?: number;
    createdAt!: Date;
    updatedAt!: Date;

    // Relations
    flag?: FeatureFlag;
    segments?: FeatureSegment[];

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['flagId', 'strategyName', 'createdBy'],
            properties: {
                id: { type: 'integer' },
                flagId: { type: 'integer' },
                strategyName: { type: 'string', maxLength: 255 },
                parameters: { type: ['object', 'null'] },
                constraints: { type: ['array', 'null'] },
                sortOrder: { type: 'integer' },
                isEnabled: { type: 'boolean' },
                createdBy: { type: 'integer' },
                updatedBy: { type: ['integer', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        };
    }

    static get jsonAttributes() {
        return ['parameters', 'constraints'];
    }

    static get relationMappings() {
        return {
            flag: {
                relation: Model.BelongsToOneRelation,
                modelClass: FeatureFlag,
                join: {
                    from: 'g_feature_strategies.flagId',
                    to: 'g_feature_flags.id',
                },
            },
            segments: {
                relation: Model.ManyToManyRelation,
                modelClass: FeatureSegment,
                join: {
                    from: 'g_feature_strategies.id',
                    through: {
                        from: 'g_feature_flag_segments.strategyId',
                        to: 'g_feature_flag_segments.segmentId',
                    },
                    to: 'g_feature_segments.id',
                },
            },
        };
    }
}

/**
 * Feature Variant Model
 * Represents an A/B test variant
 */
export class FeatureVariant extends BaseModel {
    static tableName = 'g_feature_variants';

    id!: number;
    flagId!: number;
    variantName!: string;
    weight!: number;
    payload?: any;
    payloadType!: 'string' | 'number' | 'boolean' | 'json';
    stickiness!: string;
    overrides?: VariantOverride[];
    createdBy!: number;
    updatedBy?: number;
    createdAt!: Date;
    updatedAt!: Date;

    // Relations
    flag?: FeatureFlag;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['flagId', 'variantName', 'createdBy'],
            properties: {
                id: { type: 'integer' },
                flagId: { type: 'integer' },
                variantName: { type: 'string', maxLength: 255 },
                weight: { type: 'integer', minimum: 0, maximum: 1000 },
                payload: { type: ['object', 'string', 'number', 'boolean', 'null'] },
                payloadType: { type: 'string', enum: ['string', 'number', 'boolean', 'json'] },
                stickiness: { type: 'string', maxLength: 100 },
                overrides: { type: ['array', 'null'] },
                createdBy: { type: 'integer' },
                updatedBy: { type: ['integer', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        };
    }

    static get jsonAttributes() {
        return ['payload', 'overrides'];
    }

    static get relationMappings() {
        return {
            flag: {
                relation: Model.BelongsToOneRelation,
                modelClass: FeatureFlag,
                join: {
                    from: 'g_feature_variants.flagId',
                    to: 'g_feature_flags.id',
                },
            },
        };
    }
}

/**
 * Feature Segment Model
 * Represents a reusable user segment
 */
export class FeatureSegment extends BaseModel {
    static tableName = 'g_feature_segments';

    id!: number;
    environment!: string;
    segmentName!: string;
    displayName?: string;
    description?: string;
    constraints!: Constraint[];
    isActive!: boolean;
    tags?: string[];
    createdBy!: number;
    updatedBy?: number;
    createdAt!: Date;
    updatedAt!: Date;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['environment', 'segmentName', 'constraints', 'createdBy'],
            properties: {
                id: { type: 'integer' },
                environment: { type: 'string', maxLength: 100 },
                segmentName: { type: 'string', maxLength: 255 },
                displayName: { type: ['string', 'null'], maxLength: 500 },
                description: { type: ['string', 'null'] },
                constraints: { type: 'array' },
                isActive: { type: 'boolean' },
                tags: { type: ['array', 'null'], items: { type: 'string' } },
                createdBy: { type: 'integer' },
                updatedBy: { type: ['integer', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        };
    }

    static get jsonAttributes() {
        return ['constraints'];
    }
}

/**
 * Feature Context Field Model
 * Represents a context field definition
 */
export class FeatureContextField extends BaseModel {
    static tableName = 'g_feature_context_fields';

    id!: number;
    fieldName!: string;
    fieldType!: 'string' | 'number' | 'boolean' | 'date' | 'semver';
    description?: string;
    legalValues?: string[];
    stickiness!: boolean;
    sortOrder!: number;
    createdBy?: number;
    updatedBy?: number;
    createdAt!: Date;
    updatedAt!: Date;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['fieldName', 'fieldType'],
            properties: {
                id: { type: 'integer' },
                fieldName: { type: 'string', maxLength: 255 },
                fieldType: { type: 'string', enum: ['string', 'number', 'boolean', 'date', 'semver'] },
                description: { type: ['string', 'null'] },
                legalValues: { type: ['array', 'null'] },
                stickiness: { type: 'boolean' },
                sortOrder: { type: 'integer' },
                createdBy: { type: ['integer', 'null'] },
                updatedBy: { type: ['integer', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        };
    }

    static get jsonAttributes() {
        return ['legalValues'];
    }
}

/**
 * Feature Metrics Model
 * Represents flag usage metrics
 */
export class FeatureMetrics extends BaseModel {
    static tableName = 'g_feature_metrics';

    id!: number;
    environment!: string;
    flagName!: string;
    metricsBucket!: Date;
    yesCount!: number;
    noCount!: number;
    variantCounts?: Record<string, number>;
    createdAt!: Date;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['environment', 'flagName', 'metricsBucket'],
            properties: {
                id: { type: 'integer' },
                environment: { type: 'string', maxLength: 100 },
                flagName: { type: 'string', maxLength: 255 },
                metricsBucket: { type: 'string', format: 'date-time' },
                yesCount: { type: 'integer' },
                noCount: { type: 'integer' },
                variantCounts: { type: ['object', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
            },
        };
    }

    static get jsonAttributes() {
        return ['variantCounts'];
    }
}

// Type definitions
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

export type FlagType = 'release' | 'experiment' | 'operational' | 'permission';
export type PayloadType = 'string' | 'number' | 'boolean' | 'json';
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'semver';
