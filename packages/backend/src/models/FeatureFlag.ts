import db from '../config/knex';
import logger from '../config/logger';
import { ulid } from 'ulid';

// ==================== Types ====================

export type FlagType = 'release' | 'experiment' | 'operational' | 'killSwitch' | 'permission';
export type PayloadType = 'string' | 'number' | 'boolean' | 'json';
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'semver';

export type ConstraintOperator =
    // String operators
    | 'str_eq' | 'str_neq' | 'str_contains' | 'str_starts_with' | 'str_ends_with' | 'str_in' | 'str_not_in'
    // Number operators
    | 'num_eq' | 'num_gt' | 'num_gte' | 'num_lt' | 'num_lte'
    // Boolean operators
    | 'bool_is'
    // Date operators
    | 'date_gt' | 'date_gte' | 'date_lt' | 'date_lte'
    // Semver operators
    | 'semver_eq' | 'semver_gt' | 'semver_gte' | 'semver_lt' | 'semver_lte';

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

// ==================== Interfaces ====================

export interface FeatureFlagAttributes {
    id: string;
    environment: string;
    flagName: string;
    displayName?: string;
    description?: string;
    flagType: FlagType;
    isEnabled: boolean;
    isArchived: boolean;
    archivedAt?: Date;
    impressionDataEnabled: boolean;
    lastSeenAt?: Date;
    staleAfterDays: number;
    tags?: string[];
    createdBy: number;
    updatedBy?: number;
    createdAt?: Date;
    updatedAt?: Date;
    // Relations
    strategies?: FeatureStrategyAttributes[];
    variants?: FeatureVariantAttributes[];
}

export interface FeatureStrategyAttributes {
    id: string;
    flagId: string;
    strategyName: string;
    parameters?: StrategyParameters;
    constraints?: Constraint[];
    sortOrder: number;
    isEnabled: boolean;
    createdBy: number;
    updatedBy?: number;
    createdAt?: Date;
    updatedAt?: Date;
    // Relations
    segments?: FeatureSegmentAttributes[];
}

export interface FeatureVariantAttributes {
    id: string;
    flagId: string;
    variantName: string;
    weight: number;
    payload?: any;
    payloadType: PayloadType;
    stickiness: string;
    overrides?: VariantOverride[];
    createdBy: number;
    updatedBy?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface FeatureSegmentAttributes {
    id: string;
    environment: string;
    segmentName: string;
    displayName?: string;
    description?: string;
    constraints: Constraint[];
    isActive: boolean;
    tags?: string[];
    createdBy: number;
    updatedBy?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface FeatureContextFieldAttributes {
    id: string;
    fieldName: string;
    fieldType: FieldType;
    description?: string;
    legalValues?: string[];
    tags?: string[];
    stickiness: boolean;
    sortOrder: number;
    createdBy?: number;
    updatedBy?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface FeatureMetricsAttributes {
    id: string;
    environment: string;
    flagName: string;
    metricsBucket: Date;
    yesCount: number;
    noCount: number;
    variantCounts?: Record<string, number>;
    createdAt?: Date;
}

// ==================== Helper Functions ====================

function parseJsonField<T>(value: any): T | undefined {
    if (!value) return undefined;
    if (typeof value === 'object') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

// ==================== Feature Flag Model ====================

export class FeatureFlagModel {
    static async findAll(filters: {
        environment: string;
        search?: string;
        flagType?: string;
        isEnabled?: boolean;
        isArchived?: boolean;
        tags?: string[];
        limit?: number;
        offset?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{ flags: FeatureFlagAttributes[]; total: number }> {
        try {
            const { environment, search, flagType, isEnabled, isArchived, tags, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

            const baseQuery = () => db('g_feature_flags').where('environment', environment);

            const applyFilters = (query: any) => {
                if (search) {
                    query.where((qb: any) => {
                        qb.where('flagName', 'like', `%${search}%`)
                            .orWhere('displayName', 'like', `%${search}%`)
                            .orWhere('description', 'like', `%${search}%`);
                    });
                }
                if (flagType) query.where('flagType', flagType);
                if (typeof isEnabled === 'boolean') query.where('isEnabled', isEnabled);
                if (typeof isArchived === 'boolean') query.where('isArchived', isArchived);
                if (tags && tags.length > 0) {
                    for (const tag of tags) {
                        query.whereRaw('JSON_CONTAINS(tags, ?)', [JSON.stringify(tag)]);
                    }
                }
                return query;
            };

            const countResult = await applyFilters(baseQuery()).count('* as total').first();
            const flags = await applyFilters(baseQuery())
                .orderBy(sortBy, sortOrder)
                .limit(limit)
                .offset(offset);

            // Parse JSON fields
            const parsedFlags = flags.map((f: any) => ({
                ...f,
                isEnabled: Boolean(f.isEnabled),
                isArchived: Boolean(f.isArchived),
                impressionDataEnabled: Boolean(f.impressionDataEnabled),
                tags: parseJsonField<string[]>(f.tags) || [],
            }));

            return { flags: parsedFlags, total: countResult?.total || 0 };
        } catch (error) {
            logger.error('Error finding feature flags:', error);
            throw error;
        }
    }

    static async findByName(environment: string, flagName: string): Promise<FeatureFlagAttributes | null> {
        try {
            const flag = await db('g_feature_flags')
                .where('environment', environment)
                .where('flagName', flagName)
                .first();

            if (!flag) return null;

            // Load strategies and variants
            const strategies = await FeatureStrategyModel.findByFlagId(flag.id);
            const variants = await FeatureVariantModel.findByFlagId(flag.id);

            return {
                ...flag,
                isEnabled: Boolean(flag.isEnabled),
                isArchived: Boolean(flag.isArchived),
                impressionDataEnabled: Boolean(flag.impressionDataEnabled),
                tags: parseJsonField<string[]>(flag.tags) || [],
                strategies,
                variants,
            };
        } catch (error) {
            logger.error('Error finding feature flag by name:', error);
            throw error;
        }
    }

    static async findById(id: string): Promise<FeatureFlagAttributes | null> {
        try {
            const flag = await db('g_feature_flags').where('id', id).first();
            if (!flag) return null;

            const strategies = await FeatureStrategyModel.findByFlagId(id);
            const variants = await FeatureVariantModel.findByFlagId(id);

            return {
                ...flag,
                isEnabled: Boolean(flag.isEnabled),
                isArchived: Boolean(flag.isArchived),
                impressionDataEnabled: Boolean(flag.impressionDataEnabled),
                tags: parseJsonField<string[]>(flag.tags) || [],
                strategies,
                variants,
            };
        } catch (error) {
            logger.error('Error finding feature flag by ID:', error);
            throw error;
        }
    }

    static async create(data: Omit<FeatureFlagAttributes, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureFlagAttributes> {
        try {
            const id = ulid();
            await db('g_feature_flags').insert({
                id,
                environment: data.environment,
                flagName: data.flagName,
                displayName: data.displayName || data.flagName,
                description: data.description || null,
                flagType: data.flagType || 'release',
                isEnabled: data.isEnabled ?? true,
                isArchived: false,
                impressionDataEnabled: data.impressionDataEnabled ?? false,
                staleAfterDays: data.staleAfterDays ?? 30,
                tags: data.tags ? JSON.stringify(data.tags) : null,
                createdBy: data.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Note: Default strategy is created by frontend, not here

            return this.findById(id) as Promise<FeatureFlagAttributes>;
        } catch (error) {
            logger.error('Error creating feature flag:', error);
            throw error;
        }
    }

    static async update(id: string, data: Partial<FeatureFlagAttributes>): Promise<FeatureFlagAttributes> {
        try {
            const updateData: any = { updatedAt: new Date() };

            if (data.displayName !== undefined) updateData.displayName = data.displayName;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.flagType !== undefined) updateData.flagType = data.flagType;
            if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
            if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
            if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;
            if (data.impressionDataEnabled !== undefined) updateData.impressionDataEnabled = data.impressionDataEnabled;
            if (data.staleAfterDays !== undefined) updateData.staleAfterDays = data.staleAfterDays;
            if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
            if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

            await db('g_feature_flags').where('id', id).update(updateData);

            return this.findById(id) as Promise<FeatureFlagAttributes>;
        } catch (error) {
            logger.error('Error updating feature flag:', error);
            throw error;
        }
    }

    static async delete(id: string): Promise<void> {
        try {
            await db('g_feature_flags').where('id', id).del();
        } catch (error) {
            logger.error('Error deleting feature flag:', error);
            throw error;
        }
    }

    static async updateLastSeenAt(id: string): Promise<void> {
        try {
            await db('g_feature_flags').where('id', id).update({ lastSeenAt: new Date() });
        } catch (error) {
            logger.error('Error updating lastSeenAt:', error);
        }
    }
}

// ==================== Feature Strategy Model ====================

export class FeatureStrategyModel {
    static async findByFlagId(flagId: string): Promise<FeatureStrategyAttributes[]> {
        try {
            const strategies = await db('g_feature_strategies')
                .where('flagId', flagId)
                .orderBy('sortOrder', 'asc');

            // Load segments for each strategy
            const result = [];
            for (const s of strategies) {
                const segmentLinks = await db('g_feature_flag_segments')
                    .where('strategyId', s.id)
                    .select('segmentId');

                const segmentNames: string[] = [];
                for (const link of segmentLinks) {
                    const segment = await db('g_feature_segments')
                        .where('id', link.segmentId)
                        .first();
                    if (segment) {
                        segmentNames.push(segment.segmentName);
                    }
                }

                result.push({
                    ...s,
                    isEnabled: Boolean(s.isEnabled),
                    parameters: parseJsonField<StrategyParameters>(s.parameters),
                    constraints: parseJsonField<Constraint[]>(s.constraints) || [],
                    segments: segmentNames,
                });
            }

            return result;
        } catch (error) {
            logger.error('Error finding strategies by flag ID:', error);
            throw error;
        }
    }

    static async findById(id: string): Promise<FeatureStrategyAttributes | null> {
        try {
            const strategy = await db('g_feature_strategies').where('id', id).first();
            if (!strategy) return null;

            return {
                ...strategy,
                isEnabled: Boolean(strategy.isEnabled),
                parameters: parseJsonField<StrategyParameters>(strategy.parameters),
                constraints: parseJsonField<Constraint[]>(strategy.constraints) || [],
            };
        } catch (error) {
            logger.error('Error finding strategy by ID:', error);
            throw error;
        }
    }

    static async create(data: Omit<FeatureStrategyAttributes, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureStrategyAttributes> {
        try {
            const id = ulid();
            await db('g_feature_strategies').insert({
                id,
                flagId: data.flagId,
                strategyName: data.strategyName,
                parameters: data.parameters ? JSON.stringify(data.parameters) : null,
                constraints: data.constraints ? JSON.stringify(data.constraints) : '[]',
                sortOrder: data.sortOrder ?? 0,
                isEnabled: data.isEnabled ?? true,
                createdBy: data.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return this.findById(id) as Promise<FeatureStrategyAttributes>;
        } catch (error) {
            logger.error('Error creating strategy:', error);
            throw error;
        }
    }

    static async update(id: string, data: Partial<FeatureStrategyAttributes>): Promise<FeatureStrategyAttributes> {
        try {
            const updateData: any = { updatedAt: new Date() };

            if (data.strategyName !== undefined) updateData.strategyName = data.strategyName;
            if (data.parameters !== undefined) updateData.parameters = JSON.stringify(data.parameters);
            if (data.constraints !== undefined) updateData.constraints = JSON.stringify(data.constraints);
            if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
            if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
            if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

            await db('g_feature_strategies').where('id', id).update(updateData);

            return this.findById(id) as Promise<FeatureStrategyAttributes>;
        } catch (error) {
            logger.error('Error updating strategy:', error);
            throw error;
        }
    }

    static async delete(id: string): Promise<void> {
        try {
            await db('g_feature_strategies').where('id', id).del();
        } catch (error) {
            logger.error('Error deleting strategy:', error);
            throw error;
        }
    }
}

// ==================== Feature Variant Model ====================

export class FeatureVariantModel {
    static async findByFlagId(flagId: string): Promise<FeatureVariantAttributes[]> {
        try {
            const variants = await db('g_feature_variants').where('flagId', flagId);

            return variants.map((v: any) => ({
                ...v,
                payload: parseJsonField(v.payload),
                overrides: parseJsonField<VariantOverride[]>(v.overrides),
            }));
        } catch (error) {
            logger.error('Error finding variants by flag ID:', error);
            throw error;
        }
    }

    static async create(data: Omit<FeatureVariantAttributes, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureVariantAttributes> {
        try {
            const id = ulid();
            await db('g_feature_variants').insert({
                id,
                flagId: data.flagId,
                variantName: data.variantName,
                weight: data.weight,
                payload: data.payload ? JSON.stringify(data.payload) : null,
                payloadType: data.payloadType || 'json',
                stickiness: data.stickiness || 'default',
                overrides: data.overrides ? JSON.stringify(data.overrides) : null,
                createdBy: data.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const variant = await db('g_feature_variants').where('id', id).first();
            return {
                ...variant,
                payload: parseJsonField(variant.payload),
                overrides: parseJsonField<VariantOverride[]>(variant.overrides),
            };
        } catch (error) {
            logger.error('Error creating variant:', error);
            throw error;
        }
    }

    static async deleteByFlagId(flagId: string): Promise<void> {
        try {
            await db('g_feature_variants').where('flagId', flagId).del();
        } catch (error) {
            logger.error('Error deleting variants:', error);
            throw error;
        }
    }
}

// ==================== Feature Segment Model ====================

export class FeatureSegmentModel {
    static async findAll(environment: string, search?: string): Promise<FeatureSegmentAttributes[]> {
        try {
            let query = db('g_feature_segments').where('environment', environment);

            if (search) {
                query = query.where((qb: any) => {
                    qb.where('segmentName', 'like', `%${search}%`)
                        .orWhere('displayName', 'like', `%${search}%`)
                        .orWhere('description', 'like', `%${search}%`);
                });
            }

            const segments = await query.orderBy('createdAt', 'desc');

            return segments.map((s: any) => ({
                ...s,
                isActive: Boolean(s.isActive),
                constraints: parseJsonField<Constraint[]>(s.constraints) || [],
                tags: parseJsonField<string[]>(s.tags) || [],
            }));
        } catch (error) {
            logger.error('Error finding segments:', error);
            throw error;
        }
    }

    static async findById(id: string): Promise<FeatureSegmentAttributes | null> {
        try {
            const segment = await db('g_feature_segments').where('id', id).first();
            if (!segment) return null;

            return {
                ...segment,
                isActive: Boolean(segment.isActive),
                constraints: parseJsonField<Constraint[]>(segment.constraints) || [],
                tags: parseJsonField<string[]>(segment.tags) || [],
            };
        } catch (error) {
            logger.error('Error finding segment by ID:', error);
            throw error;
        }
    }

    static async findByName(environment: string, segmentName: string): Promise<FeatureSegmentAttributes | null> {
        try {
            const segment = await db('g_feature_segments')
                .where('environment', environment)
                .where('segmentName', segmentName)
                .first();
            if (!segment) return null;

            return {
                ...segment,
                isActive: Boolean(segment.isActive),
                constraints: parseJsonField<Constraint[]>(segment.constraints) || [],
                tags: parseJsonField<string[]>(segment.tags) || [],
            };
        } catch (error) {
            logger.error('Error finding segment by name:', error);
            throw error;
        }
    }

    static async create(data: Omit<FeatureSegmentAttributes, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureSegmentAttributes> {
        try {
            const id = ulid();
            await db('g_feature_segments').insert({
                id,
                environment: data.environment,
                segmentName: data.segmentName,
                displayName: data.displayName || data.segmentName,
                description: data.description || null,
                constraints: JSON.stringify(data.constraints),
                isActive: data.isActive ?? true,
                tags: data.tags ? JSON.stringify(data.tags) : null,
                createdBy: data.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return this.findById(id) as Promise<FeatureSegmentAttributes>;
        } catch (error) {
            logger.error('Error creating segment:', error);
            throw error;
        }
    }

    static async update(id: string, data: Partial<FeatureSegmentAttributes>): Promise<FeatureSegmentAttributes> {
        try {
            const updateData: any = { updatedAt: new Date() };

            if (data.displayName !== undefined) updateData.displayName = data.displayName;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.constraints !== undefined) updateData.constraints = JSON.stringify(data.constraints);
            if (data.isActive !== undefined) updateData.isActive = data.isActive;
            if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
            if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

            await db('g_feature_segments').where('id', id).update(updateData);

            return this.findById(id) as Promise<FeatureSegmentAttributes>;
        } catch (error) {
            logger.error('Error updating segment:', error);
            throw error;
        }
    }

    static async delete(id: string): Promise<void> {
        try {
            await db('g_feature_segments').where('id', id).del();
        } catch (error) {
            logger.error('Error deleting segment:', error);
            throw error;
        }
    }

    static async getUsageCount(id: string): Promise<number> {
        try {
            const result = await db('g_feature_flag_segments').where('segmentId', id).count('* as count').first();
            return Number(result?.count) || 0;
        } catch (error) {
            logger.error('Error getting segment usage count:', error);
            throw error;
        }
    }
}

// ==================== Feature Context Field Model ====================

export class FeatureContextFieldModel {
    static async findAll(search?: string): Promise<FeatureContextFieldAttributes[]> {
        try {
            let query = db('g_feature_context_fields');

            if (search) {
                query = query.where((qb: any) => {
                    qb.where('fieldName', 'like', `%${search}%`)
                        .orWhere('description', 'like', `%${search}%`);
                });
            }

            const fields = await query.orderBy('sortOrder', 'asc');

            return fields.map((f: any) => ({
                ...f,
                stickiness: Boolean(f.stickiness),
                legalValues: parseJsonField<string[]>(f.legalValues),
                tags: parseJsonField<string[]>(f.tags) || [],
            }));
        } catch (error) {
            logger.error('Error finding context fields:', error);
            throw error;
        }
    }

    static async findByFieldName(fieldName: string): Promise<FeatureContextFieldAttributes | null> {
        try {
            const field = await db('g_feature_context_fields').where('fieldName', fieldName).first();
            if (!field) return null;

            return {
                ...field,
                stickiness: Boolean(field.stickiness),
                legalValues: parseJsonField<string[]>(field.legalValues),
                tags: parseJsonField<string[]>(field.tags) || [],
            };
        } catch (error) {
            logger.error('Error finding context field:', error);
            throw error;
        }
    }

    static async create(data: Omit<FeatureContextFieldAttributes, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureContextFieldAttributes> {
        try {
            const id = ulid();
            await db('g_feature_context_fields').insert({
                id,
                fieldName: data.fieldName,
                fieldType: data.fieldType,
                description: data.description || null,
                legalValues: data.legalValues ? JSON.stringify(data.legalValues) : null,
                tags: data.tags ? JSON.stringify(data.tags) : null,
                stickiness: data.stickiness ?? false,
                sortOrder: data.sortOrder ?? 0,
                createdBy: data.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return this.findByFieldName(data.fieldName) as Promise<FeatureContextFieldAttributes>;
        } catch (error) {
            logger.error('Error creating context field:', error);
            throw error;
        }
    }

    static async update(fieldName: string, data: Partial<FeatureContextFieldAttributes>): Promise<FeatureContextFieldAttributes> {
        try {
            const updateData: any = { updatedAt: new Date() };

            if (data.fieldType !== undefined) updateData.fieldType = data.fieldType;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.legalValues !== undefined) updateData.legalValues = JSON.stringify(data.legalValues);
            if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
            if (data.stickiness !== undefined) updateData.stickiness = data.stickiness;
            if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
            if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

            await db('g_feature_context_fields').where('fieldName', fieldName).update(updateData);

            return this.findByFieldName(fieldName) as Promise<FeatureContextFieldAttributes>;
        } catch (error) {
            logger.error('Error updating context field:', error);
            throw error;
        }
    }

    static async delete(fieldName: string): Promise<void> {
        try {
            await db('g_feature_context_fields').where('fieldName', fieldName).del();
        } catch (error) {
            logger.error('Error deleting context field:', error);
            throw error;
        }
    }
}

// ==================== Feature Metrics Model ====================

export class FeatureMetricsModel {
    static async recordMetrics(
        environment: string,
        flagName: string,
        enabled: boolean,
        variantName?: string
    ): Promise<void> {
        try {
            const bucket = new Date();
            bucket.setMinutes(0, 0, 0);
            const id = ulid();

            await db.raw(
                `INSERT INTO g_feature_metrics (id, environment, flagName, metricsBucket, yesCount, noCount, variantCounts)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           yesCount = yesCount + VALUES(yesCount),
           noCount = noCount + VALUES(noCount),
           variantCounts = IF(
             variantCounts IS NULL,
             VALUES(variantCounts),
             JSON_MERGE_PATCH(variantCounts, VALUES(variantCounts))
           )`,
                [
                    id,
                    environment,
                    flagName,
                    bucket,
                    enabled ? 1 : 0,
                    enabled ? 0 : 1,
                    variantName ? JSON.stringify({ [variantName]: 1 }) : null,
                ]
            );
        } catch (error) {
            logger.error('Error recording metrics:', error);
        }
    }

    static async getMetrics(
        environment: string,
        flagName: string,
        startDate: Date,
        endDate: Date
    ): Promise<FeatureMetricsAttributes[]> {
        try {
            const metrics = await db('g_feature_metrics')
                .where('environment', environment)
                .where('flagName', flagName)
                .whereBetween('metricsBucket', [startDate, endDate])
                .orderBy('metricsBucket', 'asc');

            return metrics.map((m: any) => ({
                ...m,
                variantCounts: parseJsonField<Record<string, number>>(m.variantCounts),
            }));
        } catch (error) {
            logger.error('Error getting metrics:', error);
            throw error;
        }
    }

    /**
     * Delete metrics older than the specified date
     * @param cutoffDate Records older than this date will be deleted
     * @returns Number of deleted records
     */
    static async deleteOlderThan(cutoffDate: Date): Promise<number> {
        try {
            const result = await db('g_feature_metrics')
                .where('metricsBucket', '<', cutoffDate)
                .delete();

            return result;
        } catch (error) {
            logger.error('Error deleting old metrics:', error);
            throw error;
        }
    }
}
