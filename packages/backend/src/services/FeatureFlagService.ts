/**
 * Feature Flag Service
 * Handles feature flag CRUD operations and cache management
 */

import {
    FeatureFlagModel,
    FeatureStrategyModel,
    FeatureVariantModel,
    FeatureSegmentModel,
    FeatureContextFieldModel,
    FeatureMetricsModel,
    FeatureFlagAttributes,
    FeatureStrategyAttributes,
    FeatureVariantAttributes,
    FeatureSegmentAttributes,
    FeatureContextFieldAttributes,
    FeatureMetricsAttributes,
    Constraint,
    StrategyParameters,
} from '../models/FeatureFlag';
import { GatrixError } from '../middleware/errorHandler';
import { ErrorCodes } from '../utils/apiResponse';
import { AuditLogModel } from '../models/AuditLog';
import logger from '../config/logger';
import { pubSubService } from './PubSubService';
import { ENV_SCOPED } from '../constants/cacheKeys';
import db from '../config/knex';

// Types for service methods
export interface CreateFlagInput {
    environment: string;
    flagName: string;
    displayName?: string;
    description?: string;
    flagType?: 'release' | 'experiment' | 'operational' | 'permission';
    isEnabled?: boolean;
    impressionDataEnabled?: boolean;
    staleAfterDays?: number;
    tags?: string[];
    // Optional: create strategies and variants along with the flag
    strategies?: CreateStrategyInput[];
    variants?: CreateVariantInput[];
}

export interface UpdateFlagInput {
    displayName?: string;
    description?: string;
    flagType?: 'release' | 'experiment' | 'operational' | 'permission';
    isEnabled?: boolean;
    impressionDataEnabled?: boolean;
    staleAfterDays?: number;
    tags?: string[];
}

export interface CreateStrategyInput {
    strategyName: string;
    parameters?: StrategyParameters;
    constraints?: Constraint[];
    segments?: string[];  // Array of segment names
    sortOrder?: number;
    isEnabled?: boolean;
}

export interface UpdateStrategyInput {
    strategyName?: string;
    parameters?: StrategyParameters;
    constraints?: Constraint[];
    sortOrder?: number;
    isEnabled?: boolean;
}

export interface CreateVariantInput {
    variantName: string;
    weight: number;
    payload?: any;
    payloadType?: 'string' | 'number' | 'boolean' | 'json';
    stickiness?: string;
    overrides?: { contextName: string; values: string[] }[];
}

export interface CreateSegmentInput {
    environment: string;
    segmentName: string;
    displayName?: string;
    description?: string;
    constraints: Constraint[];
    isActive?: boolean;
    tags?: string[];
}

export interface UpdateSegmentInput {
    displayName?: string;
    description?: string;
    constraints?: Constraint[];
    isActive?: boolean;
    tags?: string[];
}

export interface FlagListQuery {
    environment: string;
    search?: string;
    flagType?: string;
    isEnabled?: boolean;
    isArchived?: boolean;
    tags?: string[];
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

class FeatureFlagService {
    // ==================== Feature Flags ====================

    /**
     * List feature flags with filtering and pagination
     */
    async listFlags(query: FlagListQuery): Promise<{ data: FeatureFlagAttributes[]; total: number }> {
        const { page = 1, limit = 50, ...filters } = query;
        const result = await FeatureFlagModel.findAll({
            ...filters,
            limit,
            offset: (page - 1) * limit,
        });
        return { data: result.flags, total: result.total };
    }

    /**
     * Get stale flags (flags that haven't been seen for longer than their staleAfterDays setting)
     * A flag is considered stale if:
     * - lastSeenAt is null (never been evaluated) OR
     * - (now - lastSeenAt) > staleAfterDays
     */
    async getStaleFlags(environment: string): Promise<FeatureFlagAttributes[]> {
        const result = await FeatureFlagModel.findAll({
            environment,
            isArchived: false,
            limit: 10000,
        });

        const now = new Date();
        return result.flags.filter(flag => {
            if (!flag.lastSeenAt) {
                // Never been evaluated - check if created more than staleAfterDays ago
                const createdAt = flag.createdAt ? new Date(flag.createdAt) : now;
                const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return daysSinceCreation > flag.staleAfterDays;
            }

            const lastSeen = new Date(flag.lastSeenAt);
            const daysSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceLastSeen > flag.staleAfterDays;
        });
    }

    /**
     * Mark a flag as seen (update lastSeenAt timestamp)
     * This is typically called when a flag is evaluated by the SDK
     */
    async markFlagAsSeen(environment: string, flagName: string): Promise<void> {
        const flag = await this.getFlag(environment, flagName);
        if (flag) {
            await FeatureFlagModel.updateLastSeenAt(flag.id);
        }
    }


    /**
     * Get a single feature flag by name
     */
    async getFlag(environment: string, flagName: string): Promise<FeatureFlagAttributes | null> {
        return FeatureFlagModel.findByName(environment, flagName);
    }

    /**
     * Get a single feature flag by ID
     */
    async getFlagById(id: string): Promise<FeatureFlagAttributes | null> {
        return FeatureFlagModel.findById(id);
    }

    /**
     * Create a new feature flag
     */
    async createFlag(input: CreateFlagInput, userId: number): Promise<FeatureFlagAttributes> {
        // Check for duplicate
        const existing = await FeatureFlagModel.findByName(input.environment, input.flagName);
        if (existing) {
            throw new GatrixError(`Flag '${input.flagName}' already exists`, 409, true, ErrorCodes.DUPLICATE_ENTRY);
        }

        const flag = await FeatureFlagModel.create({
            environment: input.environment,
            flagName: input.flagName,
            displayName: input.displayName,
            description: input.description,
            flagType: input.flagType || 'release',
            isEnabled: input.isEnabled ?? true,
            isArchived: false,
            impressionDataEnabled: input.impressionDataEnabled ?? false,
            staleAfterDays: input.staleAfterDays ?? 30,
            tags: input.tags,
            createdBy: userId,
        });

        // Create strategies if provided
        if (input.strategies && input.strategies.length > 0) {
            for (let i = 0; i < input.strategies.length; i++) {
                const strategyInput = input.strategies[i];
                await FeatureStrategyModel.create({
                    flagId: flag.id,
                    strategyName: strategyInput.strategyName,
                    parameters: strategyInput.parameters,
                    constraints: strategyInput.constraints,
                    sortOrder: strategyInput.sortOrder ?? i + 1,
                    isEnabled: strategyInput.isEnabled ?? true,
                    createdBy: userId,
                });
            }
        }

        // Create variants if provided
        if (input.variants && input.variants.length > 0) {
            for (const variantInput of input.variants) {
                await FeatureVariantModel.create({
                    flagId: flag.id,
                    variantName: variantInput.variantName,
                    weight: variantInput.weight,
                    payload: variantInput.payload,
                    payloadType: variantInput.payloadType || 'json',
                    stickiness: variantInput.stickiness || 'default',
                    overrides: variantInput.overrides,
                    createdBy: userId,
                });
            }
        }

        // Audit log
        await AuditLogModel.create({
            action: 'feature_flag.create',
            resourceType: 'FeatureFlag',
            resourceId: flag.id,
            userId,
            newValues: { ...flag, strategies: input.strategies, variants: input.variants },
        });

        // Invalidate cache
        await this.invalidateCache(input.environment);

        logger.info(`Feature flag created: ${input.flagName} in ${input.environment}`);
        return flag;
    }

    /**
     * Update a feature flag
     */
    async updateFlag(environment: string, flagName: string, input: UpdateFlagInput, userId: number): Promise<FeatureFlagAttributes> {
        const flag = await this.getFlag(environment, flagName);
        if (!flag) {
            throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        const updated = await FeatureFlagModel.update(flag.id, {
            ...input,
            updatedBy: userId,
        });

        // Audit log
        await AuditLogModel.create({
            action: 'feature_flag.update',
            resourceType: 'FeatureFlag',
            resourceId: flag.id,
            userId,
            oldValues: flag,
            newValues: updated,
        });

        // Invalidate cache
        await this.invalidateCache(environment);

        return updated;
    }

    /**
     * Toggle flag enabled state
     */
    async toggleFlag(environment: string, flagName: string, isEnabled: boolean, userId: number): Promise<FeatureFlagAttributes> {
        return this.updateFlag(environment, flagName, { isEnabled }, userId);
    }

    /**
     * Archive a flag
     */
    async archiveFlag(environment: string, flagName: string, userId: number): Promise<FeatureFlagAttributes> {
        const flag = await this.getFlag(environment, flagName);
        if (!flag) {
            throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        const updated = await FeatureFlagModel.update(flag.id, {
            isArchived: true,
            archivedAt: new Date(),
            isEnabled: false,
            updatedBy: userId,
        });

        await AuditLogModel.create({
            action: 'feature_flag.archive',
            resourceType: 'FeatureFlag',
            resourceId: flag.id,
            userId,
            oldValues: { isArchived: false },
            newValues: { isArchived: true },
        });

        // Invalidate cache
        await this.invalidateCache(environment);

        return updated;
    }

    /**
     * Revive an archived flag
     */
    async reviveFlag(environment: string, flagName: string, userId: number): Promise<FeatureFlagAttributes> {
        const flag = await this.getFlag(environment, flagName);
        if (!flag) {
            throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        const updated = await FeatureFlagModel.update(flag.id, {
            isArchived: false,
            archivedAt: undefined,
            updatedBy: userId,
        });

        // Invalidate cache
        await this.invalidateCache(environment);

        return updated;
    }

    /**
     * Delete a flag (permanently)
     */
    async deleteFlag(environment: string, flagName: string, userId: number): Promise<void> {
        const flag = await this.getFlag(environment, flagName);
        if (!flag) {
            throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        // Only archived flags can be deleted for safety
        if (!flag.isArchived) {
            throw new GatrixError('Only archived flags can be deleted. Please archive the flag first.', 400, true, ErrorCodes.BAD_REQUEST);
        }

        await FeatureFlagModel.delete(flag.id);

        await AuditLogModel.create({
            action: 'feature_flag.delete',
            resourceType: 'FeatureFlag',
            resourceId: flag.id,
            userId,
            oldValues: flag,
        });

        // Invalidate cache
        await this.invalidateCache(environment);
    }

    // ==================== Strategies ====================

    /**
     * Add a strategy to a flag
     */
    async addStrategy(environment: string, flagName: string, input: CreateStrategyInput, userId: number): Promise<FeatureStrategyAttributes> {
        const flag = await this.getFlag(environment, flagName);
        if (!flag) {
            throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        const strategies = await FeatureStrategyModel.findByFlagId(flag.id);
        const maxSortOrder = strategies.reduce((max, s) => Math.max(max, s.sortOrder), 0);

        const strategy = await FeatureStrategyModel.create({
            flagId: flag.id,
            strategyName: input.strategyName,
            parameters: input.parameters,
            constraints: input.constraints,
            sortOrder: input.sortOrder ?? maxSortOrder + 1,
            isEnabled: input.isEnabled ?? true,
            createdBy: userId,
        });

        return strategy;
    }

    /**
     * Update a strategy
     */
    async updateStrategy(strategyId: string, input: UpdateStrategyInput, userId: number): Promise<FeatureStrategyAttributes> {
        const strategy = await FeatureStrategyModel.findById(strategyId);
        if (!strategy) {
            throw new GatrixError('Strategy not found', 404, true, ErrorCodes.NOT_FOUND);
        }

        return FeatureStrategyModel.update(strategyId, {
            ...input,
            updatedBy: userId,
        });
    }

    /**
     * Delete a strategy
     */
    async deleteStrategy(strategyId: string, userId: number): Promise<void> {
        const strategy = await FeatureStrategyModel.findById(strategyId);
        if (!strategy) {
            throw new GatrixError('Strategy not found', 404, true, ErrorCodes.NOT_FOUND);
        }

        await FeatureStrategyModel.delete(strategyId);
    }

    /**
     * Update all strategies for a flag (bulk replace)
     */
    async updateStrategies(environment: string, flagName: string, strategies: CreateStrategyInput[], userId: number): Promise<FeatureStrategyAttributes[]> {
        const flag = await this.getFlag(environment, flagName);
        if (!flag) {
            throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        // Delete existing strategies (CASCADE will delete segment links)
        const existingStrategies = await FeatureStrategyModel.findByFlagId(flag.id);
        for (const strategy of existingStrategies) {
            await FeatureStrategyModel.delete(strategy.id);
        }

        // Create new strategies with segments
        const newStrategies: FeatureStrategyAttributes[] = [];
        for (let i = 0; i < strategies.length; i++) {
            const input = strategies[i];
            const strategy = await FeatureStrategyModel.create({
                flagId: flag.id,
                strategyName: input.strategyName,
                parameters: input.parameters,
                constraints: input.constraints,
                sortOrder: input.sortOrder ?? i,
                isEnabled: input.isEnabled ?? true,
                createdBy: userId,
            });

            // Save segment links if provided
            if (input.segments && input.segments.length > 0) {
                for (const segmentName of input.segments) {
                    // Find segment by name in same environment
                    const segment = await FeatureSegmentModel.findByName(environment, segmentName);
                    if (segment) {
                        await this.linkStrategySegment(strategy.id, segment.id);
                    }
                }
            }

            newStrategies.push(strategy);
        }

        return newStrategies;
    }

    /**
     * Link a strategy to a segment
     */
    private async linkStrategySegment(strategyId: string, segmentId: string): Promise<void> {
        const { ulid } = await import('ulid');
        await db('g_feature_flag_segments').insert({
            id: ulid(),
            strategyId,
            segmentId,
            createdAt: new Date(),
        });
    }

    // ==================== Variants ====================

    /**
     * Update variants for a flag (bulk replace)
     */
    async updateVariants(environment: string, flagName: string, variants: CreateVariantInput[], userId: number, variantType?: 'string' | 'number' | 'json'): Promise<FeatureVariantAttributes[]> {
        const flag = await this.getFlag(environment, flagName);
        if (!flag) {
            throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        // Validate total weight (100% = 100)
        const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
        if (totalWeight !== 100 && variants.length > 0) {
            throw new GatrixError(`Total variant weight must equal 100 (100%), got ${totalWeight}`, 400, true, ErrorCodes.BAD_REQUEST);
        }

        // Update variantType on the flag if provided
        if (variantType) {
            await FeatureFlagModel.update(flag.id, {
                variantType,
                updatedBy: userId,
            });
        }

        // Delete existing variants
        await FeatureVariantModel.deleteByFlagId(flag.id);

        // Insert new variants
        const createdVariants: FeatureVariantAttributes[] = [];
        for (const variant of variants) {
            const created = await FeatureVariantModel.create({
                flagId: flag.id,
                variantName: variant.variantName,
                weight: variant.weight,
                payload: variant.payload,
                payloadType: variant.payloadType || 'json',
                stickiness: variant.stickiness || 'default',
                overrides: variant.overrides,
                createdBy: userId,
            });
            createdVariants.push(created);
        }

        return createdVariants;
    }

    // ==================== Segments ====================

    /**
     * List segments
     */
    async listSegments(environment: string, search?: string): Promise<FeatureSegmentAttributes[]> {
        return FeatureSegmentModel.findAll(environment, search);
    }

    /**
     * Get segment by ID
     */
    async getSegment(id: string): Promise<FeatureSegmentAttributes | null> {
        return FeatureSegmentModel.findById(id);
    }

    /**
     * Create a segment
     */
    async createSegment(input: CreateSegmentInput, userId: number): Promise<FeatureSegmentAttributes> {
        const segments = await FeatureSegmentModel.findAll(input.environment);
        const existing = segments.find(s => s.segmentName === input.segmentName);
        if (existing) {
            throw new GatrixError(`Segment '${input.segmentName}' already exists`, 409, true, ErrorCodes.DUPLICATE_ENTRY);
        }

        return FeatureSegmentModel.create({
            environment: input.environment,
            segmentName: input.segmentName,
            displayName: input.displayName,
            description: input.description,
            constraints: input.constraints,
            isActive: input.isActive ?? true,
            tags: input.tags,
            createdBy: userId,
        });
    }

    /**
     * Update a segment
     */
    async updateSegment(id: string, input: UpdateSegmentInput, userId: number): Promise<FeatureSegmentAttributes> {
        const segment = await this.getSegment(id);
        if (!segment) {
            throw new GatrixError('Segment not found', 404, true, ErrorCodes.NOT_FOUND);
        }

        return FeatureSegmentModel.update(id, {
            ...input,
            updatedBy: userId,
        });
    }

    /**
     * Delete a segment
     */
    async deleteSegment(id: string, userId: number): Promise<void> {
        const segment = await this.getSegment(id);
        if (!segment) {
            throw new GatrixError('Segment not found', 404, true, ErrorCodes.NOT_FOUND);
        }

        // Check if segment is used by any strategies
        const usageCount = await FeatureSegmentModel.getUsageCount(id);
        if (usageCount > 0) {
            throw new GatrixError(`Segment is in use by ${usageCount} strategies`, 400, true, ErrorCodes.BAD_REQUEST);
        }

        await FeatureSegmentModel.delete(id);
    }

    // ==================== Context Fields ====================

    /**
     * List context fields
     */
    async listContextFields(search?: string): Promise<FeatureContextFieldAttributes[]> {
        return FeatureContextFieldModel.findAll(search);
    }

    /**
     * Create a context field
     */
    async createContextField(input: Partial<FeatureContextFieldAttributes>, userId: number): Promise<FeatureContextFieldAttributes> {
        const existing = await FeatureContextFieldModel.findByFieldName(input.fieldName!);
        if (existing) {
            throw new GatrixError(`Context field '${input.fieldName}' already exists`, 409, true, ErrorCodes.DUPLICATE_ENTRY);
        }

        return FeatureContextFieldModel.create({
            fieldName: input.fieldName!,
            fieldType: input.fieldType!,
            description: input.description,
            legalValues: input.legalValues,
            tags: input.tags,
            stickiness: input.stickiness ?? false,
            sortOrder: input.sortOrder ?? 0,
            createdBy: userId,
        });
    }

    /**
     * Update a context field
     */
    async updateContextField(fieldName: string, input: Partial<FeatureContextFieldAttributes>, userId: number): Promise<FeatureContextFieldAttributes> {
        const field = await FeatureContextFieldModel.findByFieldName(fieldName);
        if (!field) {
            throw new GatrixError(`Context field '${fieldName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        return FeatureContextFieldModel.update(fieldName, {
            ...input,
            updatedBy: userId,
        });
    }

    /**
     * Delete a context field
     */
    async deleteContextField(fieldName: string, userId: number): Promise<void> {
        const field = await FeatureContextFieldModel.findByFieldName(fieldName);
        if (!field) {
            throw new GatrixError(`Context field '${fieldName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
        }

        // Don't allow deleting system fields
        const systemFields = ['userId', 'sessionId', 'environmentName', 'appName', 'appVersion', 'country', 'city', 'ip', 'userAgent', 'currentTime'];
        if (systemFields.includes(fieldName)) {
            throw new GatrixError(`Cannot delete system context field '${fieldName}'`, 403, true, ErrorCodes.FORBIDDEN);
        }

        await FeatureContextFieldModel.delete(fieldName);
    }

    // ==================== Metrics ====================

    /**
     * Record flag evaluation metrics
     */
    async recordMetrics(environment: string, flagName: string, enabled: boolean, variantName?: string): Promise<void> {
        await FeatureMetricsModel.recordMetrics(environment, flagName, enabled, variantName);

        // Update lastSeenAt on the flag
        const flag = await FeatureFlagModel.findByName(environment, flagName);
        if (flag) {
            await FeatureFlagModel.updateLastSeenAt(flag.id);
        }
    }

    /**
     * Get metrics for a flag
     */
    async getMetrics(environment: string, flagName: string, startDate: Date, endDate: Date): Promise<FeatureMetricsAttributes[]> {
        return FeatureMetricsModel.getMetrics(environment, flagName, startDate, endDate);
    }

    /**
     * Get all flags for an environment (for SDK initialization)
     */
    async getAllFlagsForEnvironment(environment: string): Promise<FeatureFlagAttributes[]> {
        const result = await FeatureFlagModel.findAll({
            environment,
            isArchived: false,
            limit: 10000,
        });
        return result.flags;
    }

    /**
     * Invalidate feature flags cache for an environment
     */
    async invalidateCache(environment: string): Promise<void> {
        try {
            // Invalidate feature flags cache (environment-scoped)
            await pubSubService.invalidateKey(`${ENV_SCOPED.FEATURE_FLAGS.ALL}:${environment}`);
            await pubSubService.invalidateKey(`${ENV_SCOPED.SDK_ETAG.FEATURE_FLAGS}:${environment}`);

            // Publish SDK event for real-time updates
            await pubSubService.publishSDKEvent({
                type: 'feature_flag.changed',
                data: {
                    environment,
                    timestamp: Date.now(),
                },
            });

            logger.debug(`Feature flags cache invalidated for environment: ${environment}`);
        } catch (error) {
            logger.error('Error invalidating feature flags cache:', error);
        }
    }

    /**
     * Cleanup old metrics data based on retention period
     * @param retentionDays Number of days to retain metrics (default from env: 14 days)
     * @returns Number of deleted records
     */
    async cleanupOldMetrics(retentionDays?: number): Promise<number> {
        const days = retentionDays ?? parseInt(process.env.FEATURE_FLAG_METRICS_RETENTION_DAYS || '14', 10);

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const deletedCount = await FeatureMetricsModel.deleteOlderThan(cutoffDate);

            logger.info(`Feature flag metrics cleanup: deleted ${deletedCount} records older than ${days} days`);
            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up feature flag metrics:', error);
            throw error;
        }
    }
}

export const featureFlagService = new FeatureFlagService();
