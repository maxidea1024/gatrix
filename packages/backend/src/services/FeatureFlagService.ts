/**
 * Feature Flag Service
 * Handles feature flag CRUD operations and cache management
 */

import {
  FeatureFlagModel,
  FeatureFlagEnvironmentModel,
  FeatureStrategyModel,
  FeatureVariantModel,
  FeatureSegmentModel,
  FeatureContextFieldModel,
  FeatureMetricsModel,
  FeatureFlagAttributes,
  FeatureFlagEnvironmentAttributes,
  FeatureStrategyAttributes,
  FeatureVariantAttributes,
  FeatureSegmentAttributes,
  FeatureContextFieldAttributes,
  FeatureMetricsAttributes,
  Constraint,
  StrategyParameters,
  ValueType,
  FlagType,
} from '../models/FeatureFlag';
import { GatrixError } from '../middleware/errorHandler';
import { ErrorCodes } from '../utils/apiResponse';
import { AuditLogModel } from '../models/AuditLog';
import logger from '../config/logger';
import { pubSubService } from './PubSubService';
import { ENV_SCOPED } from '../constants/cacheKeys';
import db from '../config/knex';
import { IntegrationService } from './IntegrationService';
import { INTEGRATION_EVENTS, IntegrationEventType } from '../types/integrationEvents';

// Types for service methods
export interface CreateFlagInput {
  name?: string;
  flagName?: string; // Alias for name (used in import)
  displayName?: string;
  description?: string;
  flagType?: FlagType;
  valueType: ValueType;
  enabledValue: any;
  disabledValue: any;

  impressionDataEnabled?: boolean;
  staleAfterDays?: number;
  tags?: string[];
  links?: { url: string; title?: string }[];
  environment?: string; // Optional: initialize for specific environment
  isEnabled?: boolean; // Optional: combined with environment
  strategies?: any[]; // Optional: strategies to create (used in import)
  variants?: any[]; // Optional: variants to create (used in import)
}

export interface UpdateFlagInput {
  displayName?: string;
  description?: string;
  flagType?: FlagType;
  valueType?: ValueType;
  enabledValue?: any;
  disabledValue?: any;

  isEnabled?: boolean;
  isArchived?: boolean;
  impressionDataEnabled?: boolean;
  staleAfterDays?: number;
  stale?: boolean;
  tags?: string[];
  links?: { url: string; title?: string }[];
  isGlobal?: boolean;
}

export interface CreateStrategyInput {
  strategyName: string;
  parameters?: StrategyParameters;
  constraints?: Constraint[];
  segments?: string[]; // Array of segment names
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
  value?: any;
  valueType?: ValueType;
  weightLock?: boolean;
}

export interface CreateSegmentInput {
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
    return result.flags.filter((flag) => {
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
      await FeatureFlagModel.updateLastSeenAt(flag.id, environment);
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
    const flagName = input.flagName || input.name;
    // Check for duplicate
    const existing = await FeatureFlagModel.findByName(input.environment!, flagName!);
    if (existing) {
      throw new GatrixError(
        `Flag '${flagName}' already exists`,
        409,
        true,
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    // Remote Config validation
    const isRemoteConfig = input.flagType === 'remoteConfig';
    if (isRemoteConfig) {
      // Remote Config must have valueType
      if (!input.valueType) {
        throw new GatrixError(
          'Remote Config requires a value type (string, number, boolean, or json)',
          400,
          true,
          ErrorCodes.BAD_REQUEST
        );
      }
    }

    // Determine valueType: for feature flags, default to 'boolean' (was none), for remote configs, it's required
    const valueType = isRemoteConfig ? input.valueType : input.valueType || 'boolean';

    const flag = await FeatureFlagModel.create({
      flagName: flagName!,
      displayName: input.displayName,
      description: input.description,
      flagType: input.flagType || 'release',
      valueType: input.valueType,
      enabledValue: input.enabledValue,
      disabledValue: input.disabledValue,
      impressionDataEnabled: input.impressionDataEnabled ?? false,
      staleAfterDays: input.staleAfterDays ?? 30,
      tags: input.tags,
      links: input.links,
      createdBy: userId,
      environment: input.environment,
      isEnabled: input.isEnabled ?? false,
      isArchived: false,
    });

    // Create strategies if provided
    if (input.strategies && input.strategies.length > 0) {
      for (let i = 0; i < input.strategies.length; i++) {
        const strategyInput = input.strategies[i];
        await FeatureStrategyModel.create({
          flagId: flag.id,
          environment: input.environment!,
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
          environment: input.environment!,
          variantName: variantInput.variantName,
          weight: variantInput.weight,
          value: variantInput.value,
          valueType: variantInput.valueType || 'json',
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
      newValues: {
        ...flag,
        strategies: input.strategies,
        variants: input.variants,
      },
    });

    // Invalidate cache
    await this.invalidateCache(input.environment!);

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_CREATED,
      environment: input.environment!,
      createdByUserId: userId,
      createdAt: new Date(),
      data: flag as any,
    });

    logger.info(`Feature flag created: ${input.flagName} in ${input.environment}`);
    return flag;
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    environment: string,
    flagName: string,
    input: UpdateFlagInput,
    userId: number
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    // Separate environment-specific from global properties
    // isGlobal: if true, we are updating the base flag values even if an environment is provided
    const { isEnabled, enabledValue, disabledValue, isGlobal, ...globalUpdates } = input;

    // Update environment-specific settings (isEnabled, enabledValue, disabledValue)
    // ONLY if not explicitly requested to be a global-only update, or if environment is provided
    if (environment && !isGlobal) {
      if (isEnabled !== undefined || enabledValue !== undefined || disabledValue !== undefined) {
        await FeatureFlagEnvironmentModel.update(flag.id, environment, {
          isEnabled,
          enabledValue,
          disabledValue,
        });
      }
    }

    // Update global flag properties
    // If isGlobal is true, enabledValue/disabledValue are applied as base values
    const baseValues: any = {};
    if (isGlobal || !environment) {
      if (enabledValue !== undefined) baseValues.enabledValue = enabledValue;
      if (disabledValue !== undefined) baseValues.disabledValue = disabledValue;
    }

    if (Object.keys(globalUpdates).length > 0 || Object.keys(baseValues).length > 0) {
      await FeatureFlagModel.update(flag.id, {
        ...globalUpdates,
        ...baseValues,
        updatedBy: userId,
      });
    }

    const updated = await this.getFlag(environment, flagName);

    // Audit log
    await AuditLogModel.create({
      action: 'feature_flag.update',
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      oldValues: flag,
      newValues: updated,
    });

    // Increment version and invalidate cache
    await this.incrementFlagVersion(flag.id, environment);
    await this.invalidateCache(environment);

    // Trigger integration event
    let eventType: IntegrationEventType = INTEGRATION_EVENTS.FEATURE_FLAG_UPDATED;
    if (input.isEnabled !== undefined) {
      eventType = input.isEnabled
        ? INTEGRATION_EVENTS.FEATURE_FLAG_ENVIRONMENT_ENABLED
        : INTEGRATION_EVENTS.FEATURE_FLAG_ENVIRONMENT_DISABLED;
    }

    await IntegrationService.handleEvent({
      type: eventType,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: updated as any,
      // Pass old values for context
      preData: flag as any,
    });

    return updated!;
  }

  /**
   * Toggle flag enabled state
   */
  async toggleFlag(
    environment: string,
    flagName: string,
    isEnabled: boolean,
    userId: number
  ): Promise<FeatureFlagAttributes> {
    return this.updateFlag(environment, flagName, { isEnabled }, userId);
  }

  async updateEnvironment(
    flagId: string,
    environment: string,
    data: {
      isEnabled?: boolean;
      enabledValue?: any;
      disabledValue?: any;
    }
  ): Promise<FeatureFlagEnvironmentAttributes> {
    return FeatureFlagEnvironmentModel.update(flagId, environment, data);
  }

  /**
   * Archive a flag
   */
  async archiveFlag(
    environment: string,
    flagName: string,
    userId: number
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      isArchived: true,
      archivedAt: new Date(),
      updatedBy: userId,
    });

    // Also disable the flag in this environment
    await FeatureFlagEnvironmentModel.updateIsEnabled(flag.id, environment, false);

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

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_ARCHIVED,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: updated as any,
      preData: flag as any,
    });

    return updated;
  }

  /**
   * Revive an archived flag
   */
  async reviveFlag(
    environment: string,
    flagName: string,
    userId: number
  ): Promise<FeatureFlagAttributes> {
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

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_REVIVED,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: updated as any,
      preData: flag as any,
    });

    return updated;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(
    environment: string,
    flagName: string,
    isFavorite: boolean,
    userId: number
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      isFavorite,
      updatedBy: userId,
    });

    await AuditLogModel.create({
      action: isFavorite ? 'feature_flag.favorite' : 'feature_flag.unfavorite',
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      oldValues: { isFavorite: !isFavorite },
      newValues: { isFavorite },
    });

    return updated;
  }

  /**
   * Mark a flag as stale
   */
  async markAsStale(
    environment: string,
    flagName: string,
    userId: number
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      stale: true,
      updatedBy: userId,
    });

    await AuditLogModel.create({
      action: 'feature_flag.mark_stale',
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      oldValues: { stale: false },
      newValues: { stale: true },
    });

    // Invalidate cache
    await this.invalidateCache(environment);

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_STALE_ON,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: updated as any,
      preData: flag as any,
    });

    return updated;
  }

  /**
   * Mark a flag as not stale
   */
  async markAsNotStale(
    environment: string,
    flagName: string,
    userId: number
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      stale: false,
      updatedBy: userId,
    });

    await AuditLogModel.create({
      action: 'feature_flag.unmark_stale',
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      oldValues: { stale: true },
      newValues: { stale: false },
    });

    // Invalidate cache
    await this.invalidateCache(environment);

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_STALE_OFF,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: updated as any,
      preData: flag as any,
    });

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
      throw new GatrixError(
        'Only archived flags can be deleted. Please archive the flag first.',
        400,
        true,
        ErrorCodes.BAD_REQUEST
      );
    }

    await FeatureFlagModel.delete(flag.id);

    await AuditLogModel.create({
      action: 'feature_flag.delete',
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      oldValues: flag,
    });

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_DELETED,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: flag as any,
    });

    // Invalidate cache
    await this.invalidateCache(environment);
  }

  // ==================== Strategies ====================

  /**
   * Add a strategy to a flag
   */
  async addStrategy(
    environment: string,
    flagName: string,
    input: CreateStrategyInput,
    userId: number
  ): Promise<FeatureStrategyAttributes> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const strategies = await FeatureStrategyModel.findByFlagId(flag.id);
    const maxSortOrder = strategies.reduce((max, s) => Math.max(max, s.sortOrder), 0);

    const strategy = await FeatureStrategyModel.create({
      flagId: flag.id,
      environment,
      strategyName: input.strategyName,
      parameters: input.parameters,
      constraints: input.constraints,
      sortOrder: input.sortOrder ?? maxSortOrder + 1,
      isEnabled: input.isEnabled ?? true,
      createdBy: userId,
    });

    // Invalidate cache
    await this.invalidateCache(environment);

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_STRATEGY_ADDED,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: { ...strategy, flagName: flag.flagName },
    });

    return strategy;
  }

  /**
   * Update a strategy
   */
  async updateStrategy(
    strategyId: string,
    input: UpdateStrategyInput,
    userId: number
  ): Promise<FeatureStrategyAttributes> {
    const strategy = await FeatureStrategyModel.findById(strategyId);
    if (!strategy) {
      throw new GatrixError('Strategy not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureStrategyModel.update(strategyId, {
      ...input,
      updatedBy: userId,
    });

    const flag = await this.getFlagById(strategy.flagId);

    // Invalidate cache
    if (flag) {
      await this.invalidateCache(strategy.environment);
    }

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_STRATEGY_UPDATED,
      environment: strategy.environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: { ...updated, flagName: flag?.flagName },
      preData: { ...strategy },
    });

    return updated;
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId: string, userId: number): Promise<void> {
    const strategy = await FeatureStrategyModel.findById(strategyId);
    if (!strategy) {
      throw new GatrixError('Strategy not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const flag = await this.getFlagById(strategy.flagId);

    await FeatureStrategyModel.delete(strategyId);

    // Invalidate cache
    await this.invalidateCache(strategy.environment);

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_STRATEGY_REMOVED,
      environment: strategy.environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: { ...strategy, flagName: flag?.flagName },
    });
  }

  /**
   * Update all strategies for a flag (bulk replace)
   */
  async updateStrategies(
    environment: string,
    flagName: string,
    strategies: CreateStrategyInput[],
    userId: number
  ): Promise<FeatureStrategyAttributes[]> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    // Delete existing strategies for this environment
    const existingStrategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
      flag.id,
      environment
    );
    for (const strategy of existingStrategies) {
      await FeatureStrategyModel.delete(strategy.id);
    }

    // Create new strategies with segments
    const newStrategies: FeatureStrategyAttributes[] = [];
    for (let i = 0; i < strategies.length; i++) {
      const input = strategies[i];
      const strategy = await FeatureStrategyModel.create({
        flagId: flag.id,
        environment,
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
          // Find segment by name (segments are now global)
          const segment = await FeatureSegmentModel.findByName(segmentName);
          if (segment) {
            await this.linkStrategySegment(strategy.id, segment.id);
          }
        }
      }

      newStrategies.push(strategy);
    }

    // Invalidate cache
    await this.invalidateCache(environment);

    // Trigger integration event
    // For bulk update, we treat it as "strategies updated"
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_FLAG_STRATEGY_UPDATED,
      environment,
      createdByUserId: userId,
      createdAt: new Date(),
      data: {
        flagName,
        strategies: newStrategies,
        count: newStrategies.length,
        action: 'bulk_update',
      },
    });

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

  /**
   * Update variants for a flag (bulk replace)
   */
  async updateVariants(
    environment: string,
    flagName: string,
    variants: CreateVariantInput[],
    userId: number,
    valueType?: ValueType,
    enabledValue?: any,
    disabledValue?: any,
    clearVariantValues?: boolean
  ): Promise<FeatureVariantAttributes[]> {
    const flag = await this.getFlag(environment, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    // Validate total weight (100% = 100)
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100 && variants.length > 0) {
      throw new GatrixError(
        `Total variant weight must equal 100 (100%), got ${totalWeight}`,
        400,
        true,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Validate no duplicate variant names
    const variantNames = variants.map((v) => v.variantName.trim().toLowerCase());
    const hasDuplicates = variantNames.some((name, i) => variantNames.indexOf(name) !== i);
    if (hasDuplicates) {
      throw new GatrixError(
        'Variant names must be unique. Duplicate variant names are not allowed.',
        400,
        true,
        ErrorCodes.BAD_REQUEST
      );
    }

    // Remote Config specific validations
    const isRemoteConfig = (flag as any).flagType === 'remoteConfig';

    // Check if this is just a metadata update (no variants provided) for Remote Config
    // For Remote Config, we treat empty variants as "keep existing variants" because it must always have 1 variant
    // For other flags, empty variants means "remove all variants"
    const isRemoteConfigMetadataUpdate = isRemoteConfig && variants.length === 0;

    if (isRemoteConfig && !isRemoteConfigMetadataUpdate) {
      // Cannot set valueType to undefined/null check might be tricky if not passed.
      // logic: if valueType passed, check it.
      // But for remote config it must have a type.
      // Let's assume input validation upstream handles required fields if they are missing?
      // No, here we check constraints.

      // If valueType is passed and it is invalid... wait, type signature says 'string'|...
      // check if it is explicitly missing when required?

      // Original code checked: if (variantType === 'none')
      // Now valueType includes 'boolean', so 'none' is not possible in type system (or passed as string).
      // If user passes nothing, we might default or keep existing.

      // Remote Config must have exactly 1 variant
      if (variants.length !== 1) {
        throw new GatrixError(
          'Remote Config must have exactly one variant',
          400,
          true,
          ErrorCodes.BAD_REQUEST
        );
      }
    }

    // Update valueType and values on the flag if provided
    if (valueType || enabledValue !== undefined || disabledValue !== undefined) {
      const updateData: any = {};
      if (valueType) updateData.valueType = valueType;
      if (enabledValue !== undefined) updateData.enabledValue = enabledValue;
      if (disabledValue !== undefined) updateData.disabledValue = disabledValue;
      await FeatureFlagModel.update(flag.id, { ...updateData, updatedBy: userId });
    }

    // If clearVariantValues is true, reset value for all existing variants across all environments
    if (clearVariantValues) {
      // Get all variants for this flag (all environments)
      const allVariants = await db('g_feature_variants').where('flagId', flag.id).select('*');

      // Reset values based on new value type - store the raw value, not a wrapper object
      const defaultValue =
        valueType === 'number'
          ? 0
          : valueType === 'json'
            ? {}
            : valueType === 'boolean'
              ? false
              : '';

      for (const variant of allVariants) {
        await db('g_feature_variants')
          .where('id', variant.id)
          .update({
            value: JSON.stringify(defaultValue),
            updatedBy: userId,
            updatedAt: new Date(),
          });
      }
    }

    let resultVariants: FeatureVariantAttributes[] = [];

    // Only update variants table if not a metadata-only update for Remote Config
    if (!isRemoteConfigMetadataUpdate) {
      // Delete existing variants for this environment
      await FeatureVariantModel.deleteByFlagIdAndEnvironment(flag.id, environment);

      // Insert new variants
      for (const variant of variants) {
        const created = await FeatureVariantModel.create({
          flagId: flag.id,
          environment,
          variantName: variant.variantName,
          weight: variant.weight,
          value: variant.value,
          valueType: variant.valueType || 'json',
          weightLock: variant.weightLock || false,
          createdBy: userId,
        });
        resultVariants.push(created);
      }
    } else {
      // If metadata only update, return existing variants
      resultVariants = await FeatureVariantModel.findByFlagIdAndEnvironment(flag.id, environment);
    }

    // Increment version and invalidate cache after variants update
    await this.incrementFlagVersion(flag.id, environment);
    await this.invalidateCache(environment);

    return resultVariants;
  }

  // ==================== Segments ====================

  /**
   * List segments
   */
  async listSegments(search?: string): Promise<FeatureSegmentAttributes[]> {
    return FeatureSegmentModel.findAll(search);
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
  async createSegment(
    input: CreateSegmentInput,
    userId: number
  ): Promise<FeatureSegmentAttributes> {
    // Check if segment name already exists (segments are now global)
    const existing = await FeatureSegmentModel.findByName(input.segmentName);
    if (existing) {
      throw new GatrixError(
        `Segment '${input.segmentName}' already exists`,
        409,
        true,
        ErrorCodes.DUPLICATE_ENTRY
      );
    }

    const segment = await FeatureSegmentModel.create({
      segmentName: input.segmentName,
      displayName: input.displayName,
      description: input.description,
      constraints: input.constraints,
      isActive: input.isActive ?? true,
      tags: input.tags,
      createdBy: userId,
    });

    // Publish segment.created event (segments are global, no environment)
    await pubSubService.publishSDKEvent({
      type: 'segment.created',
      data: {
        id: segment.id,
        segmentName: segment.segmentName,
      },
    });

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_SEGMENT_CREATED,
      createdByUserId: userId,
      createdAt: new Date(),
      data: segment,
    });

    return segment;
  }

  /**
   * Update a segment
   */
  async updateSegment(
    id: string,
    input: UpdateSegmentInput,
    userId: number
  ): Promise<FeatureSegmentAttributes> {
    const segment = await this.getSegment(id);
    if (!segment) {
      throw new GatrixError('Segment not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureSegmentModel.update(id, {
      ...input,
      updatedBy: userId,
    });

    // Publish segment.updated event (segments are global, no environment)
    await pubSubService.publishSDKEvent({
      type: 'segment.updated',
      data: {
        id: updated.id,
        segmentName: updated.segmentName,
      },
    });

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_SEGMENT_UPDATED,
      createdByUserId: userId,
      createdAt: new Date(),
      data: updated as any,
      preData: segment as any,
    });

    return updated;
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
      throw new GatrixError(
        `Segment is in use by ${usageCount} strategies`,
        400,
        true,
        ErrorCodes.BAD_REQUEST
      );
    }

    await FeatureSegmentModel.delete(id);

    // Publish segment.deleted event (segments are global, no environment)
    await pubSubService.publishSDKEvent({
      type: 'segment.deleted',
      data: {
        id: segment.id,
        segmentName: segment.segmentName,
      },
    });

    // Trigger integration event
    await IntegrationService.handleEvent({
      type: INTEGRATION_EVENTS.FEATURE_SEGMENT_DELETED,
      createdByUserId: userId,
      createdAt: new Date(),
      data: segment,
    });
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
  async createContextField(
    input: Partial<FeatureContextFieldAttributes>,
    userId: number
  ): Promise<FeatureContextFieldAttributes> {
    const existing = await FeatureContextFieldModel.findByFieldName(input.fieldName!);
    if (existing) {
      throw new GatrixError(
        `Context field '${input.fieldName}' already exists`,
        409,
        true,
        ErrorCodes.DUPLICATE_ENTRY
      );
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
  async updateContextField(
    fieldName: string,
    input: Partial<FeatureContextFieldAttributes>,
    userId: number
  ): Promise<FeatureContextFieldAttributes> {
    const field = await FeatureContextFieldModel.findByFieldName(fieldName);
    if (!field) {
      throw new GatrixError(
        `Context field '${fieldName}' not found`,
        404,
        true,
        ErrorCodes.NOT_FOUND
      );
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
      throw new GatrixError(
        `Context field '${fieldName}' not found`,
        404,
        true,
        ErrorCodes.NOT_FOUND
      );
    }

    await FeatureContextFieldModel.delete(fieldName);
  }

  // ==================== Metrics ====================

  /**
   * Record flag evaluation metrics
   */
  async recordMetrics(
    environment: string,
    flagName: string,
    enabled: boolean,
    variantName?: string
  ): Promise<void> {
    await FeatureMetricsModel.recordMetrics(environment, flagName, enabled, variantName);

    // Update lastSeenAt on the flag environment settings
    const flag = await FeatureFlagModel.findByName(environment, flagName);
    if (flag) {
      await FeatureFlagModel.updateLastSeenAt(flag.id, environment);
    }
  }

  /**
   * Get metrics for a flag
   */
  async getMetrics(
    environment: string,
    flagName: string,
    startDate: Date,
    endDate: Date,
    appName?: string | null
  ): Promise<FeatureMetricsAttributes[]> {
    return FeatureMetricsModel.getMetrics(environment, flagName, startDate, endDate, appName);
  }

  /**
   * Get distinct app names used in metrics
   */
  async getMetricsAppNames(
    environment: string,
    flagName: string,
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    return FeatureMetricsModel.getAppNames(environment, flagName, startDate, endDate);
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
   * Increment flag version (called when flag or its components are modified)
   */
  async incrementFlagVersion(flagId: string, environment: string): Promise<void> {
    try {
      // Increment global flag version
      await db('g_feature_flags').where('id', flagId).increment('version', 1);

      // Increment environment-specific version
      await db('g_feature_flag_environments')
        .where('flagId', flagId)
        .where('environment', environment)
        .increment('version', 1);
    } catch (error) {
      logger.error('Error incrementing flag version:', error);
    }
  }

  /**
   * Invalidate feature flags cache for an environment
   */
  async invalidateCache(environment: string): Promise<void> {
    try {
      // Invalidate feature flags cache (environment-scoped)
      await pubSubService.invalidateKey(`${ENV_SCOPED.FEATURE_FLAGS.ALL}:${environment}`);
      await pubSubService.invalidateKey(`${ENV_SCOPED.SDK_ETAG.FEATURE_FLAGS}:${environment}`);

      // Invalidate evaluate API definitions cache
      await pubSubService.invalidateKey(`feature_flags:definitions:${environment}`);

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
    const days =
      retentionDays ?? parseInt(process.env.FEATURE_FLAG_METRICS_RETENTION_DAYS || '14', 10);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const deletedCount = await FeatureMetricsModel.deleteOlderThan(cutoffDate);

      logger.info(
        `Feature flag metrics cleanup: deleted ${deletedCount} records older than ${days} days`
      );
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up feature flag metrics:', error);
      throw error;
    }
  }
}

export const featureFlagService = new FeatureFlagService();
