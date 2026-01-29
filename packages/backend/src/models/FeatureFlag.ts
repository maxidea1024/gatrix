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

// Feature Flag - Now GLOBAL (no environment column)
export interface FeatureFlagAttributes {
    id: string;
    flagName: string;
    displayName?: string;
    description?: string;
    flagType: FlagType;
    isArchived: boolean;
    archivedAt?: Date;
    impressionDataEnabled: boolean;
    staleAfterDays: number;
    tags?: string[];
    variantType?: 'string' | 'number' | 'json';
    createdBy: number;
    updatedBy?: number;
    createdAt?: Date;
    updatedAt?: Date;
    // Environment-specific fields (joined from g_feature_flag_environments)
    lastSeenAt?: Date;
    // Relations - loaded per environment when needed
    environments?: FeatureFlagEnvironmentAttributes[];
    strategies?: FeatureStrategyAttributes[];
    variants?: FeatureVariantAttributes[];
}

// NEW: Per-environment flag settings
export interface FeatureFlagEnvironmentAttributes {
    id: string;
    flagId: string;
    environment: string;
    isEnabled: boolean;
    lastSeenAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

// Strategy - now includes environment
export interface FeatureStrategyAttributes {
    id: string;
    flagId: string;
    environment: string;
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

// Variant - now includes environment
export interface FeatureVariantAttributes {
    id: string;
    flagId: string;
    environment: string;
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

// Segment - Now GLOBAL (no environment column)
export interface FeatureSegmentAttributes {
    id: string;
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
    displayName?: string;
    fieldType: FieldType;
    description?: string;
    legalValues?: string[];
    tags?: string[];
    stickiness: boolean;
    isEnabled?: boolean;
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
    /**
     * Find all flags with environment-specific enabled status
     * Flags are global, isEnabled comes from g_feature_flag_environments
     */
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
    }): Promise<{ flags: (FeatureFlagAttributes & { isEnabled: boolean })[]; total: number }> {
        try {
            const { environment, search, flagType, isEnabled, isArchived, tags, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

            // Join flags with environment-specific settings
            const baseQuery = () => db('g_feature_flags as f')
                .leftJoin('g_feature_flag_environments as e', function () {
                    this.on('f.id', '=', 'e.flagId').andOn('e.environment', '=', db.raw('?', [environment]));
                })
                .select('f.*', 'e.isEnabled', 'e.lastSeenAt');

            const applyFilters = (query: any) => {
                if (search) {
                    query.where((qb: any) => {
                        qb.where('f.flagName', 'like', `%${search}%`)
                            .orWhere('f.displayName', 'like', `%${search}%`)
                            .orWhere('f.description', 'like', `%${search}%`);
                    });
                }
                if (flagType) query.where('f.flagType', flagType);
                if (typeof isEnabled === 'boolean') query.where('e.isEnabled', isEnabled);
                if (typeof isArchived === 'boolean') query.where('f.isArchived', isArchived);
                if (tags && tags.length > 0) {
                    for (const tag of tags) {
                        query.whereRaw('JSON_CONTAINS(f.tags, ?)', [JSON.stringify(tag)]);
                    }
                }
                return query;
            };

            const countResult = await applyFilters(
                db('g_feature_flags as f')
                    .leftJoin('g_feature_flag_environments as e', function () {
                        this.on('f.id', '=', 'e.flagId').andOn('e.environment', '=', db.raw('?', [environment]));
                    })
            ).count('f.id as total').first();

            const flags = await applyFilters(baseQuery())
                .orderBy(`f.${sortBy}`, sortOrder)
                .limit(limit)
                .offset(offset);

            // Get all environment states for these flags
            const flagIds = flags.map((f: any) => f.id);
            let allEnvStates: any[] = [];
            if (flagIds.length > 0) {
                allEnvStates = await db('g_feature_flag_environments')
                    .whereIn('flagId', flagIds);
            }

            // Parse JSON fields and attach environments
            const parsedFlags = flags.map((f: any) => {
                const envStates = allEnvStates.filter(e => e.flagId === f.id);
                return {
                    ...f,
                    isEnabled: Boolean(f.isEnabled),
                    isArchived: Boolean(f.isArchived),
                    impressionDataEnabled: Boolean(f.impressionDataEnabled),
                    tags: parseJsonField<string[]>(f.tags) || [],
                    environments: envStates.map(e => ({
                        id: e.id,
                        flagId: e.flagId,
                        environment: e.environment,
                        isEnabled: Boolean(e.isEnabled),
                        lastSeenAt: e.lastSeenAt,
                    })),
                };
            });

            return { flags: parsedFlags, total: Number(countResult?.total) || 0 };
        } catch (error) {
            logger.error('Error finding feature flags:', error);
            throw error;
        }
    }

    /**
     * Find flag by name with environment-specific strategies and variants
     */
    static async findByName(environment: string, flagName: string): Promise<(FeatureFlagAttributes & { isEnabled: boolean }) | null> {
        try {
            // Get global flag
            const flag = await db('g_feature_flags')
                .where('flagName', flagName)
                .first();

            if (!flag) return null;

            // Get environment-specific settings
            const envSettings = await db('g_feature_flag_environments')
                .where('flagId', flag.id)
                .where('environment', environment)
                .first();

            // Load strategies and variants for this environment
            const strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(flag.id, environment);
            const variants = await FeatureVariantModel.findByFlagIdAndEnvironment(flag.id, environment);

            return {
                ...flag,
                isEnabled: Boolean(envSettings?.isEnabled),
                lastSeenAt: envSettings?.lastSeenAt,
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

    static async findById(id: string, environment?: string): Promise<FeatureFlagAttributes | null> {
        try {
            const flag = await db('g_feature_flags').where('id', id).first();
            if (!flag) return null;

            let envSettings = null;
            let strategies: FeatureStrategyAttributes[] = [];
            let variants: FeatureVariantAttributes[] = [];

            if (environment) {
                envSettings = await db('g_feature_flag_environments')
                    .where('flagId', id)
                    .where('environment', environment)
                    .first();
                strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(id, environment);
                variants = await FeatureVariantModel.findByFlagIdAndEnvironment(id, environment);
            }

            return {
                ...flag,
                isArchived: Boolean(flag.isArchived),
                impressionDataEnabled: Boolean(flag.impressionDataEnabled),
                tags: parseJsonField<string[]>(flag.tags) || [],
                strategies,
                variants,
                environments: envSettings ? [{
                    id: envSettings.id,
                    flagId: id,
                    environment,
                    isEnabled: Boolean(envSettings.isEnabled),
                    lastSeenAt: envSettings.lastSeenAt,
                }] : [],
            };
        } catch (error) {
            logger.error('Error finding feature flag by ID:', error);
            throw error;
        }
    }

    /**
     * Create a new global flag and optionally initialize environment settings
     */
    static async create(data: Omit<FeatureFlagAttributes, 'id' | 'createdAt' | 'updatedAt'> & { environment?: string; isEnabled?: boolean }): Promise<FeatureFlagAttributes> {
        try {
            const id = ulid();
            await db('g_feature_flags').insert({
                id,
                flagName: data.flagName,
                displayName: data.displayName || data.flagName,
                description: data.description || null,
                flagType: data.flagType || 'release',
                isArchived: false,
                impressionDataEnabled: data.impressionDataEnabled ?? false,
                staleAfterDays: data.staleAfterDays ?? 30,
                tags: data.tags ? JSON.stringify(data.tags) : null,
                variantType: data.variantType || 'string',
                createdBy: data.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // If environment provided, create environment settings
            if (data.environment) {
                await FeatureFlagEnvironmentModel.create({
                    flagId: id,
                    environment: data.environment,
                    isEnabled: data.isEnabled ?? true,
                });
            }

            return this.findById(id, data.environment) as Promise<FeatureFlagAttributes>;
        } catch (error) {
            logger.error('Error creating feature flag:', error);
            throw error;
        }
    }

    /**
     * Update global flag properties (not environment-specific)
     */
    static async update(id: string, data: Partial<FeatureFlagAttributes>): Promise<FeatureFlagAttributes> {
        try {
            const updateData: any = { updatedAt: new Date() };

            if (data.displayName !== undefined) updateData.displayName = data.displayName;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.flagType !== undefined) updateData.flagType = data.flagType;
            if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
            if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;
            if (data.impressionDataEnabled !== undefined) updateData.impressionDataEnabled = data.impressionDataEnabled;
            if (data.staleAfterDays !== undefined) updateData.staleAfterDays = data.staleAfterDays;
            if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
            if (data.variantType !== undefined) updateData.variantType = data.variantType;
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

    static async updateLastSeenAt(flagId: string, environment: string): Promise<void> {
        try {
            await db('g_feature_flag_environments')
                .where('flagId', flagId)
                .where('environment', environment)
                .update({ lastSeenAt: new Date() });
        } catch (error) {
            logger.error('Error updating lastSeenAt:', error);
        }
    }
}

// ==================== Feature Flag Environment Model (NEW) ====================

export class FeatureFlagEnvironmentModel {
    static async findByFlagId(flagId: string): Promise<FeatureFlagEnvironmentAttributes[]> {
        try {
            const envs = await db('g_feature_flag_environments').where('flagId', flagId);
            return envs.map((e: any) => ({
                ...e,
                isEnabled: Boolean(e.isEnabled),
            }));
        } catch (error) {
            logger.error('Error finding flag environments:', error);
            throw error;
        }
    }

    static async findByFlagIdAndEnvironment(flagId: string, environment: string): Promise<FeatureFlagEnvironmentAttributes | null> {
        try {
            const env = await db('g_feature_flag_environments')
                .where('flagId', flagId)
                .where('environment', environment)
                .first();
            if (!env) return null;
            return {
                ...env,
                isEnabled: Boolean(env.isEnabled),
            };
        } catch (error) {
            logger.error('Error finding flag environment:', error);
            throw error;
        }
    }

    static async create(data: Omit<FeatureFlagEnvironmentAttributes, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureFlagEnvironmentAttributes> {
        try {
            const id = ulid();
            await db('g_feature_flag_environments').insert({
                id,
                flagId: data.flagId,
                environment: data.environment,
                isEnabled: data.isEnabled ?? false,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            return this.findByFlagIdAndEnvironment(data.flagId, data.environment) as Promise<FeatureFlagEnvironmentAttributes>;
        } catch (error) {
            logger.error('Error creating flag environment:', error);
            throw error;
        }
    }

    static async updateIsEnabled(flagId: string, environment: string, isEnabled: boolean): Promise<FeatureFlagEnvironmentAttributes> {
        try {
            // Upsert - create if not exists
            const existing = await this.findByFlagIdAndEnvironment(flagId, environment);
            if (!existing) {
                return this.create({ flagId, environment, isEnabled });
            }

            await db('g_feature_flag_environments')
                .where('flagId', flagId)
                .where('environment', environment)
                .update({ isEnabled, updatedAt: new Date() });

            return this.findByFlagIdAndEnvironment(flagId, environment) as Promise<FeatureFlagEnvironmentAttributes>;
        } catch (error) {
            logger.error('Error updating flag environment:', error);
            throw error;
        }
    }

    static async delete(flagId: string, environment: string): Promise<void> {
        try {
            await db('g_feature_flag_environments')
                .where('flagId', flagId)
                .where('environment', environment)
                .del();
        } catch (error) {
            logger.error('Error deleting flag environment:', error);
            throw error;
        }
    }
}

// ==================== Feature Strategy Model ====================

export class FeatureStrategyModel {
    /**
     * Find all strategies for a flag (backward compatibility)
     */
    static async findByFlagId(flagId: string): Promise<FeatureStrategyAttributes[]> {
        try {
            const strategies = await db('g_feature_strategies')
                .where('flagId', flagId)
                .orderBy('sortOrder', 'asc');

            return this.enrichStrategiesWithSegments(strategies);
        } catch (error) {
            logger.error('Error finding strategies by flag ID:', error);
            throw error;
        }
    }

    /**
     * Find strategies for a flag in a specific environment
     */
    static async findByFlagIdAndEnvironment(flagId: string, environment: string): Promise<FeatureStrategyAttributes[]> {
        try {
            const strategies = await db('g_feature_strategies')
                .where('flagId', flagId)
                .where('environment', environment)
                .orderBy('sortOrder', 'asc');

            return this.enrichStrategiesWithSegments(strategies);
        } catch (error) {
            logger.error('Error finding strategies by flag ID and environment:', error);
            throw error;
        }
    }

    private static async enrichStrategiesWithSegments(strategies: any[]): Promise<FeatureStrategyAttributes[]> {
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
                environment: data.environment,
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

    static async findByFlagIdAndEnvironment(flagId: string, environment: string): Promise<FeatureVariantAttributes[]> {
        try {
            const variants = await db('g_feature_variants')
                .where('flagId', flagId)
                .where('environment', environment);

            return variants.map((v: any) => ({
                ...v,
                payload: parseJsonField(v.payload),
                overrides: parseJsonField<VariantOverride[]>(v.overrides),
            }));
        } catch (error) {
            logger.error('Error finding variants by flag ID and environment:', error);
            throw error;
        }
    }

    static async create(data: Omit<FeatureVariantAttributes, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureVariantAttributes> {
        try {
            const id = ulid();
            await db('g_feature_variants').insert({
                id,
                flagId: data.flagId,
                environment: data.environment,
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

    static async deleteByFlagIdAndEnvironment(flagId: string, environment: string): Promise<void> {
        try {
            await db('g_feature_variants')
                .where('flagId', flagId)
                .where('environment', environment)
                .del();
        } catch (error) {
            logger.error('Error deleting variants:', error);
            throw error;
        }
    }
}

// ==================== Feature Segment Model ====================

export class FeatureSegmentModel {
    /**
     * Find all segments (now global, no environment filter)
     */
    static async findAll(search?: string): Promise<FeatureSegmentAttributes[]> {
        try {
            let query = db('g_feature_segments');

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

    /**
     * Find segment by name (now global, no environment filter)
     */
    static async findByName(segmentName: string): Promise<FeatureSegmentAttributes | null> {
        try {
            const segment = await db('g_feature_segments')
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
            if (data.displayName !== undefined) updateData.displayName = data.displayName;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.legalValues !== undefined) updateData.legalValues = JSON.stringify(data.legalValues);
            if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
            if (data.stickiness !== undefined) updateData.stickiness = data.stickiness;
            if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
            if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
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
