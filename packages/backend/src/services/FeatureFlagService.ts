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
  ValidationRules,
} from '../models/FeatureFlag';
import { GatrixError } from '../middleware/errorHandler';
import { ErrorCodes } from '../utils/apiResponse';
import { AuditLogModel } from '../models/AuditLog';
import logger from '../config/logger';
import { pubSubService } from './PubSubService';
import { ENV_SCOPED } from '../constants/cacheKeys';
import db from '../config/knex';
import { validateFlagValue } from '../utils/validateFlagValue';
import { FeatureFlagTypeModel } from '../models/FeatureFlagType';

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
  tags?: string[];
  links?: { url: string; title?: string }[];
  environmentId?: string; // Optional: initialize for specific environmentId
  isEnabled?: boolean; // Optional: combined with environmentId
  strategies?: any[]; // Optional: strategies to create (used in import)
  variants?: any[]; // Optional: variants to create (used in import)
  validationRules?: ValidationRules; // Optional: validation rules for flag values
  projectId?: string; // Project scoping
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
  stale?: boolean;
  tags?: string[];
  links?: { url: string; title?: string }[];
  isGlobal?: boolean;
  validationRules?: ValidationRules; // Optional: validation rules for flag values
  useFixedWeightVariants?: boolean;
  overrideEnabledValue?: boolean;
  overrideDisabledValue?: boolean;
}

export interface CreateStrategyInput {
  strategyName: string;
  title?: string;
  parameters?: StrategyParameters;
  constraints?: Constraint[];
  segments?: string[]; // Array of segment names
  sortOrder?: number;
  isEnabled?: boolean;
}

export interface UpdateStrategyInput {
  strategyName?: string;
  title?: string;
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
}

export interface CreateSegmentInput {
  segmentName: string;
  displayName?: string;
  description?: string;
  constraints: Constraint[];
  isActive?: boolean;
  tags?: string[];
  projectId?: string;
}

export interface UpdateSegmentInput {
  displayName?: string;
  description?: string;
  constraints?: Constraint[];
  isActive?: boolean;
  tags?: string[];
}

export interface FlagListQuery {
  environmentId: string;
  search?: string;
  flagType?: string;

  isEnabled?: boolean;
  isArchived?: boolean;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  projectId?: string;
}

// Request context for passing IP and user agent to audit logs
export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
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
   * Get stale flags (flags that have exceeded their type's lifetimeDays)
   * A flag is considered stale if:
   * - Its flag type has a non-null lifetimeDays AND
   * - lastSeenAt exceeds lifetimeDays from now, or never evaluated and created more than lifetimeDays ago
   * Flag types with lifetimeDays = null have infinite lifetime and are never stale.
   */
  async getStaleFlags(environmentId: string, projectId?: string): Promise<FeatureFlagAttributes[]> {
    // Load flag types to get lifetimeDays per type
    const flagTypes = await FeatureFlagTypeModel.findAll(projectId);
    const lifetimeMap = new Map<string, number | null>();
    for (const ft of flagTypes) {
      lifetimeMap.set(ft.flagType, ft.lifetimeDays);
    }

    const result = await FeatureFlagModel.findAll({
      environmentId,
      projectId,
      isArchived: false,
      limit: 10000,
    });

    const now = new Date();
    return result.flags.filter((flag) => {
      const lifetimeDays = lifetimeMap.get(flag.flagType);
      // null lifetimeDays = infinite lifetime, never stale
      if (lifetimeDays === null || lifetimeDays === undefined) return false;

      if (!flag.lastSeenAt) {
        // Never been evaluated - check if created more than lifetimeDays ago
        const createdAt = flag.createdAt ? new Date(flag.createdAt) : now;
        const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation > lifetimeDays;
      }

      const lastSeen = new Date(flag.lastSeenAt);
      const daysSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastSeen > lifetimeDays;
    });
  }

  /**
   * Mark a flag as seen (update lastSeenAt timestamp)
   * This is typically called when a flag is evaluated by the SDK
   */
  async markFlagAsSeen(environmentId: string, flagName: string): Promise<void> {
    const flag = await this.getFlag(environmentId, flagName);
    if (flag) {
      await FeatureFlagModel.updateLastSeenAt(flag.id, environmentId);
    }
  }

  /**
   * Get a single feature flag by name
   * @param projectId - When provided, restricts lookup to this project only
   */
  async getFlag(
    environmentId: string,
    flagName: string,
    projectId?: string
  ): Promise<FeatureFlagAttributes | null> {
    return FeatureFlagModel.findByName(environmentId, flagName, projectId);
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
  async createFlag(
    input: CreateFlagInput,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const flagName = input.flagName || input.name;
    // Check for duplicate
    const existing = await FeatureFlagModel.findByName(input.environmentId!, flagName!);
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

    // Validate values against validation rules if provided
    if (input.validationRules && valueType !== 'boolean') {
      const fieldLabels: Record<string, string> = {
        enabledValue: 'enabled value',
        disabledValue: 'disabled value',
      };
      for (const field of ['enabledValue', 'disabledValue'] as const) {
        const result = validateFlagValue(input[field], valueType, input.validationRules);
        if (!result.valid) {
          throw new GatrixError(
            `VALIDATION_ERROR:${field}:${result.errors.join('|')}`,
            400,
            true,
            ErrorCodes.BAD_REQUEST
          );
        }
        // Apply transformed value (e.g. trimmed string)
        if (result.transformedValue !== undefined) {
          (input as any)[field] = result.transformedValue;
        }
      }
    }

    const flag = await FeatureFlagModel.create({
      flagName: flagName!,
      displayName: input.displayName,
      description: input.description,
      flagType: input.flagType || 'release',
      valueType: input.valueType,
      enabledValue: input.enabledValue,
      disabledValue: input.disabledValue,
      validationRules: input.validationRules,
      impressionDataEnabled: input.impressionDataEnabled ?? false,
      useFixedWeightVariants: false,
      tags: input.tags,
      links: input.links,
      createdBy: userId,
      environmentId: input.environmentId,
      isEnabled: input.isEnabled ?? false,
      isArchived: false,
      projectId: input.projectId,
    } as any);

    // Create strategies if provided
    if (input.strategies && input.strategies.length > 0) {
      for (let i = 0; i < input.strategies.length; i++) {
        const strategyInput = input.strategies[i];
        await FeatureStrategyModel.create({
          flagId: flag.id,
          environmentId: input.environmentId!,
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
          environmentId: input.environmentId!,
          variantName: variantInput.variantName,
          weight: variantInput.weight,
          value: variantInput.value,
          valueType: variantInput.valueType || 'json',
          createdBy: userId,
        });
      }
    }

    // Audit log (also triggers integration events via fire-and-forget)
    await AuditLogModel.create({
      action: 'feature_flag.create',
      description: `Feature flag '${input.flagName}' created in [${input.environmentId}]`,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId: input.environmentId,
      newValues: {
        ...flag,
        strategies: input.strategies,
        variants: input.variants,
      },
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    // Invalidate cache
    await this.invalidateCache(input.environmentId!, [input.flagName!]);

    logger.info(`Feature flag created: ${input.flagName} in ${input.environmentId}`);
    return flag;
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    environmentId: string,
    flagName: string,
    input: UpdateFlagInput,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    // Separate environment-specific from global properties
    // isGlobal: if true, we are updating the base flag values even if an environment is provided
    const {
      isEnabled,
      enabledValue,
      disabledValue,
      overrideEnabledValue,
      overrideDisabledValue,
      isGlobal,
      validationRules: inputValidationRules,
      ...globalUpdates
    } = input;

    // Determine the effective validation rules (from input or existing flag)
    const effectiveValidationRules =
      inputValidationRules !== undefined ? inputValidationRules : (flag as any).validationRules;
    const effectiveValueType = (globalUpdates as any).valueType || flag.valueType;

    // Validate values against validation rules
    if (effectiveValidationRules && effectiveValueType !== 'boolean') {
      const valuesToValidate: { field: string; value: any }[] = [];
      if (enabledValue !== undefined)
        valuesToValidate.push({ field: 'enabledValue', value: enabledValue });
      if (disabledValue !== undefined)
        valuesToValidate.push({ field: 'disabledValue', value: disabledValue });

      for (const { field, value } of valuesToValidate) {
        const result = validateFlagValue(value, effectiveValueType, effectiveValidationRules);
        if (!result.valid) {
          throw new GatrixError(
            `VALIDATION_ERROR:${field}:${result.errors.join('|')}`,
            400,
            true,
            ErrorCodes.BAD_REQUEST
          );
        }
      }
    }

    // Update environment-specific settings (isEnabled, enabledValue, disabledValue)
    // ONLY if not explicitly requested to be a global-only update, or if environment is provided
    if (environmentId && !isGlobal) {
      if (
        isEnabled !== undefined ||
        enabledValue !== undefined ||
        disabledValue !== undefined ||
        overrideEnabledValue !== undefined ||
        overrideDisabledValue !== undefined
      ) {
        await FeatureFlagEnvironmentModel.update(flag.id, environmentId, {
          isEnabled,
          enabledValue,
          disabledValue,
          overrideEnabledValue,
          overrideDisabledValue,
        });
      }
    }

    // Update global flag properties
    // If isGlobal is true, enabledValue/disabledValue are applied as base values
    const baseValues: any = {};
    if (isGlobal || !environmentId) {
      if (enabledValue !== undefined) baseValues.enabledValue = enabledValue;
      if (disabledValue !== undefined) baseValues.disabledValue = disabledValue;
    }

    // Include validationRules in global updates if provided
    const validationRulesUpdate: any = {};
    if (inputValidationRules !== undefined) {
      validationRulesUpdate.validationRules = inputValidationRules;
    }

    if (
      Object.keys(globalUpdates).length > 0 ||
      Object.keys(baseValues).length > 0 ||
      Object.keys(validationRulesUpdate).length > 0
    ) {
      await FeatureFlagModel.update(flag.id, {
        ...globalUpdates,
        ...baseValues,
        ...validationRulesUpdate,
        updatedBy: userId,
      });
    }

    const updated = await this.getFlag(environmentId, flagName);

    // Build human-readable description
    let updateDesc = `Feature flag '${flagName}' updated in [${environmentId}]`;
    if (input.isEnabled !== undefined) {
      updateDesc = `Feature flag '${flagName}' ${input.isEnabled ? 'enabled' : 'disabled'} in [${environmentId}]`;
    }

    // Audit log (also triggers integration events via fire-and-forget)
    await AuditLogModel.create({
      action: 'feature_flag.update',
      description: updateDesc,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId,
      oldValues: flag,
      newValues: updated,
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    // Increment version and invalidate cache
    await this.incrementFlagVersion(flag.id, environmentId);
    // Detect if only isEnabled changed (no definition change)
    const isEnabledOnlyChange =
      input.isEnabled !== undefined &&
      Object.keys(input).filter((k) => k !== 'isEnabled').length === 0;
    await this.invalidateCache(
      environmentId,
      [flagName],
      isEnabledOnlyChange ? 'enabled_changed' : 'definition_changed'
    );

    return updated!;
  }

  /**
   * Toggle flag enabled state.
   * Automatically controls the release-flow plan lifecycle:
   *  - Enabling with a draft plan  → auto-start
   *  - Enabling with a paused plan → auto-resume
   *  - Disabling with an active plan → auto-pause
   */
  async toggleFlag(
    environmentId: string,
    flagName: string,
    isEnabled: boolean,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const result = await this.updateFlag(
      environmentId,
      flagName,
      { isEnabled },
      userId,
      requestContext
    );

    // Auto-control release flow plan based on toggle direction
    if (result) {
      try {
        const { releaseFlowService } = await import('./ReleaseFlowService');
        const plan = await releaseFlowService.getPlanForFlag(result.id, environmentId);
        if (plan) {
          if (isEnabled && (plan.status === 'draft' || plan.status === 'pending')) {
            await releaseFlowService.startPlan(plan.id, userId);
            logger.info(
              `Auto-started release flow plan '${plan.flowName}' for flag '${flagName}' in [${environmentId}]`
            );
          } else if (isEnabled && plan.status === 'paused') {
            await releaseFlowService.resumePlan(plan.id, userId);
            logger.info(
              `Auto-resumed release flow plan '${plan.flowName}' for flag '${flagName}' in [${environmentId}]`
            );
          } else if (!isEnabled && plan.status === 'active') {
            await releaseFlowService.pausePlan(plan.id, userId);
            logger.info(
              `Auto-paused release flow plan '${plan.flowName}' for flag '${flagName}' in [${environmentId}]`
            );
          }
        }
      } catch (error) {
        // Log but don't fail the toggle — release flow control is secondary
        logger.error('Failed to auto-control release flow plan:', error);
      }
    }

    return result;
  }

  async updateEnvironment(
    flagId: string,
    environmentId: string,
    data: {
      isEnabled?: boolean;
      enabledValue?: any;
      disabledValue?: any;
      overrideEnabledValue?: boolean;
      overrideDisabledValue?: boolean;
    }
  ): Promise<FeatureFlagEnvironmentAttributes> {
    return FeatureFlagEnvironmentModel.update(flagId, environmentId, data);
  }

  /**
   * Archive a flag
   */
  async archiveFlag(
    environmentId: string,
    flagName: string,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      isArchived: true,
      archivedAt: new Date(),
      updatedBy: userId,
    });

    // Also disable the flag in this environment
    await FeatureFlagEnvironmentModel.updateIsEnabled(flag.id, environmentId, false);

    await AuditLogModel.create({
      action: 'feature_flag.archive',
      description: `Feature flag '${flagName}' archived in [${environmentId}]`,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId,
      oldValues: { isArchived: false },
      newValues: { isArchived: true },
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    // Invalidate cache (archived = removed from SDK's perspective)
    await this.invalidateCache(environmentId, [flagName], 'deleted');

    return updated;
  }

  /**
   * Revive an archived flag
   */
  async reviveFlag(
    environmentId: string,
    flagName: string,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      isArchived: false,
      archivedAt: undefined,
      updatedBy: userId,
    });

    await AuditLogModel.create({
      action: 'feature_flag.revive',
      description: `Feature flag '${flagName}' revived (unarchived) in [${environmentId}]`,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId,
      oldValues: { isArchived: true },
      newValues: { isArchived: false },
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    // Invalidate cache
    await this.invalidateCache(environmentId, [flagName]);

    return updated;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(
    environmentId: string,
    flagName: string,
    isFavorite: boolean,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      isFavorite,
      updatedBy: userId,
    });

    await AuditLogModel.create({
      action: isFavorite ? 'feature_flag.favorite' : 'feature_flag.unfavorite',
      description: `Feature flag '${flagName}' ${isFavorite ? 'added to' : 'removed from'} favorites`,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId,
      oldValues: { isFavorite: !isFavorite },
      newValues: { isFavorite },
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    return updated;
  }

  /**
   * Mark a flag as stale
   */
  async markAsStale(
    environmentId: string,
    flagName: string,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      stale: true,
      updatedBy: userId,
    });

    await AuditLogModel.create({
      action: 'feature_flag.mark_stale',
      description: `Feature flag '${flagName}' marked as stale in [${environmentId}]`,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId,
      oldValues: { stale: false },
      newValues: { stale: true },
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    // Invalidate cache
    await this.invalidateCache(environmentId, [flagName]);

    return updated;
  }

  /**
   * Mark a flag as not stale
   */
  async markAsNotStale(
    environmentId: string,
    flagName: string,
    userId: string,
    requestContext?: RequestContext
  ): Promise<FeatureFlagAttributes> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureFlagModel.update(flag.id, {
      stale: false,
      updatedBy: userId,
    });

    await AuditLogModel.create({
      action: 'feature_flag.unmark_stale',
      description: `Feature flag '${flagName}' unmarked as stale in [${environmentId}]`,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId,
      oldValues: { stale: true },
      newValues: { stale: false },
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    // Invalidate cache
    await this.invalidateCache(environmentId, [flagName]);

    return updated;
  }

  /**
   * Delete a flag (permanently)
   */
  async deleteFlag(
    environmentId: string,
    flagName: string,
    userId: string,
    requestContext?: RequestContext
  ): Promise<void> {
    const flag = await this.getFlag(environmentId, flagName);
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
      description: `Feature flag '${flagName}' permanently deleted from [${environmentId}]`,
      resourceType: 'FeatureFlag',
      resourceId: flag.id,
      userId,
      environmentId,
      oldValues: flag,
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
    });

    // Invalidate cache (permanently deleted)
    await this.invalidateCache(environmentId, [flagName], 'deleted');
  }

  // ==================== Strategies ====================

  /**
   * Add a strategy to a flag
   */
  async addStrategy(
    environmentId: string,
    flagName: string,
    input: CreateStrategyInput,
    userId: string
  ): Promise<FeatureStrategyAttributes> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    const strategies = await FeatureStrategyModel.findByFlagId(flag.id);
    const maxSortOrder = strategies.reduce((max, s) => Math.max(max, s.sortOrder), 0);

    const strategy = await FeatureStrategyModel.create({
      flagId: flag.id,
      environmentId,
      strategyName: input.strategyName,
      title: input.title,
      parameters: input.parameters,
      constraints: input.constraints,
      sortOrder: input.sortOrder ?? maxSortOrder + 1,
      isEnabled: input.isEnabled ?? true,
      createdBy: userId,
    });

    // Invalidate cache
    await this.invalidateCache(environmentId, [flagName]);

    return strategy;
  }

  /**
   * Update a strategy
   */
  async updateStrategy(
    strategyId: string,
    input: UpdateStrategyInput,
    userId: string
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
      await this.invalidateCache(strategy.environmentId, [flag.flagName]);
    }

    return updated;
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId: string, userId: string): Promise<void> {
    const strategy = await FeatureStrategyModel.findById(strategyId);
    if (!strategy) {
      throw new GatrixError('Strategy not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const flag = await this.getFlagById(strategy.flagId);

    await FeatureStrategyModel.delete(strategyId);

    // Invalidate cache
    await this.invalidateCache(strategy.environmentId, flag ? [flag.flagName] : undefined);
  }

  /**
   * Update all strategies for a flag (bulk replace)
   */
  async updateStrategies(
    environmentId: string,
    flagName: string,
    strategies: CreateStrategyInput[],
    userId: string
  ): Promise<FeatureStrategyAttributes[]> {
    const flag = await this.getFlag(environmentId, flagName);
    if (!flag) {
      throw new GatrixError(`Flag '${flagName}' not found`, 404, true, ErrorCodes.NOT_FOUND);
    }

    // Delete existing strategies for this environment
    const existingStrategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
      flag.id,
      environmentId
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
        environmentId,
        strategyName: input.strategyName,
        title: input.title,
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
    await this.invalidateCache(environmentId, [flagName]);

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
    environmentId: string,
    flagName: string,
    variants: CreateVariantInput[],
    userId: string,
    valueType?: ValueType,
    enabledValue?: any,
    disabledValue?: any,
    clearVariantValues?: boolean
  ): Promise<FeatureVariantAttributes[]> {
    const flag = await this.getFlag(environmentId, flagName);
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
      await FeatureVariantModel.deleteByFlagIdAndEnvironment(flag.id, environmentId);

      // Insert new variants
      for (const variant of variants) {
        const created = await FeatureVariantModel.create({
          flagId: flag.id,
          environmentId,
          variantName: variant.variantName,
          weight: variant.weight,
          value: variant.value,
          valueType: variant.valueType || 'json',
          createdBy: userId,
        });
        resultVariants.push(created);
      }
    } else {
      // If metadata only update, return existing variants
      resultVariants = await FeatureVariantModel.findByFlagIdAndEnvironment(flag.id, environmentId);
    }

    // Increment version and invalidate cache after variants update
    await this.incrementFlagVersion(flag.id, environmentId);
    await this.invalidateCache(environmentId, [flagName]);

    return resultVariants;
  }

  // ==================== Segments ====================

  /**
   * List segments
   */
  async listSegments(search?: string, projectId?: string): Promise<FeatureSegmentAttributes[]> {
    return FeatureSegmentModel.findAll(search, projectId);
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
    userId: string
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
      projectId: input.projectId,
    } as any);

    // Publish segment.created event with full segment data
    // SDKs can update their segment cache directly without an API call
    await pubSubService.publishSDKEvent({
      type: 'segment.created',
      data: {
        id: segment.id,
        segmentName: segment.segmentName,
        segment: segment,
      },
    });

    return segment;
  }

  /**
   * Update a segment
   */
  async updateSegment(
    id: string,
    input: UpdateSegmentInput,
    userId: string
  ): Promise<FeatureSegmentAttributes> {
    const segment = await this.getSegment(id);
    if (!segment) {
      throw new GatrixError('Segment not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await FeatureSegmentModel.update(id, {
      ...input,
      updatedBy: userId,
    });

    // Publish segment.updated event with full segment data
    // SDKs can update their segment cache directly without an API call
    await pubSubService.publishSDKEvent({
      type: 'segment.updated',
      data: {
        id: updated.id,
        segmentName: updated.segmentName,
        segment: updated,
      },
    });

    // Propagate change to all flags referencing this segment
    await this.invalidateReferencingFlagsBySegment(id);

    return updated;
  }

  /**
   * Delete a segment
   */
  async deleteSegment(id: string, userId: string): Promise<void> {
    const segment = await this.getSegment(id);
    if (!segment) {
      throw new GatrixError('Segment not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    // Check if segment is referenced by any flags or templates
    const references = await FeatureSegmentModel.getReferences(id);
    if (references.flags.length > 0 || references.templates.length > 0) {
      throw new GatrixError(
        'Segment is in use and cannot be deleted',
        409,
        true,
        ErrorCodes.RESOURCE_IN_USE,
        { references }
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
  }

  // ==================== Context Fields ====================

  /**
   * List context fields
   */
  async listContextFields(
    search?: string,
    projectId?: string
  ): Promise<FeatureContextFieldAttributes[]> {
    return FeatureContextFieldModel.findAll(search, projectId);
  }

  /**
   * Create a context field
   */
  async createContextField(
    input: Partial<FeatureContextFieldAttributes>,
    userId: string
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
      validationRules: input.validationRules,
      tags: input.tags,
      stickiness: input.stickiness ?? false,
      sortOrder: input.sortOrder ?? 0,
      createdBy: userId,
      projectId: input.projectId,
    } as any);
  }

  /**
   * Update a context field
   */
  async updateContextField(
    fieldName: string,
    input: Partial<FeatureContextFieldAttributes>,
    userId: string
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

    const updated = await FeatureContextFieldModel.update(fieldName, {
      ...input,
      updatedBy: userId,
    });

    // Propagate change to all flags using this context field in constraints
    await this.invalidateReferencingFlagsByContextField(fieldName);

    return updated;
  }

  /**
   * Delete a context field
   */
  async deleteContextField(fieldName: string, userId: string): Promise<void> {
    const field = await FeatureContextFieldModel.findByFieldName(fieldName);
    if (!field) {
      throw new GatrixError(
        `Context field '${fieldName}' not found`,
        404,
        true,
        ErrorCodes.NOT_FOUND
      );
    }

    // Check if context field is referenced by any flags, segments, or templates
    const references = await FeatureContextFieldModel.getReferences(fieldName);
    if (
      references.flags.length > 0 ||
      references.segments.length > 0 ||
      references.templates.length > 0
    ) {
      throw new GatrixError(
        'Context field is in use and cannot be deleted',
        409,
        true,
        ErrorCodes.RESOURCE_IN_USE,
        { references }
      );
    }

    await FeatureContextFieldModel.delete(fieldName);
  }

  // ==================== Metrics ====================

  /**
   * Record flag evaluation metrics
   */
  async recordMetrics(
    environmentId: string,
    flagName: string,
    enabled: boolean,
    variantName?: string
  ): Promise<void> {
    await FeatureMetricsModel.recordMetrics(environmentId, flagName, enabled, variantName);

    // Update lastSeenAt on the flag environment settings
    const flag = await FeatureFlagModel.findByName(environmentId, flagName);
    if (flag) {
      await FeatureFlagModel.updateLastSeenAt(flag.id, environmentId);
    }
  }

  /**
   * Get metrics for a flag
   */
  async getMetrics(
    environmentId: string,
    flagName: string,
    startDate: Date,
    endDate: Date,
    appName?: string | null
  ): Promise<FeatureMetricsAttributes[]> {
    return FeatureMetricsModel.getMetrics(environmentId, flagName, startDate, endDate, appName);
  }

  /**
   * Get distinct app names used in metrics
   */
  async getMetricsAppNames(
    environmentId: string,
    flagName: string,
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    return FeatureMetricsModel.getAppNames(environmentId, flagName, startDate, endDate);
  }

  /**
   * Get all flags for an environment (for SDK initialization)
   */
  async getAllFlagsForEnvironment(environmentId: string): Promise<FeatureFlagAttributes[]> {
    const result = await FeatureFlagModel.findAll({
      environmentId,
      isArchived: false,
      limit: 10000,
    });
    return result.flags;
  }

  /**
   * Increment flag version (called when flag or its components are modified)
   */
  async incrementFlagVersion(flagId: string, environmentId: string): Promise<void> {
    try {
      // Increment global flag version
      await db('g_feature_flags').where('id', flagId).increment('version', 1);

      // Increment environment-specific version
      await db('g_feature_flag_environments')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .increment('version', 1);
    } catch (error) {
      logger.error('Error incrementing flag version:', error);
    }
  }

  /**
   * Find all active (non-archived, enabled) flags referencing a segment and propagate changes.
   * Joins: g_feature_flag_segments → g_feature_strategies → g_feature_flags
   */
  private async invalidateReferencingFlagsBySegment(segmentId: string): Promise<void> {
    try {
      const rows = await db('g_feature_flag_segments as ffs')
        .join('g_feature_strategies as fs', 'ffs.strategyId', 'fs.id')
        .join('g_feature_flags as ff', 'fs.flagId', 'ff.id')
        .where('ffs.segmentId', segmentId)
        .where('ff.isArchived', false)
        .select('ff.id as flagId', 'ff.flagName', 'fs.environmentId')
        .groupBy('ff.id', 'ff.flagName', 'fs.environmentId');

      if (rows.length === 0) return;

      // Group by environment for efficient cache invalidation
      const byEnv = new Map<string, string[]>();
      for (const row of rows) {
        // Bump flag version
        await this.incrementFlagVersion(row.flagId, row.environmentId);
        const list = byEnv.get(row.environmentId) || [];
        list.push(row.flagName);
        byEnv.set(row.environmentId, list);
      }

      // Invalidate cache per environment
      for (const [env, flagNames] of byEnv) {
        await this.invalidateCache(env, flagNames);
      }
    } catch (error) {
      logger.error('Error invalidating flags referencing segment:', error);
    }
  }

  /**
   * Find all active flags using a context field name in strategy constraints and propagate changes.
   * Searches the JSON constraints column for the given contextName.
   */
  private async invalidateReferencingFlagsByContextField(fieldName: string): Promise<void> {
    try {
      // Search constraints JSON for the contextName field
      const rows = await db('g_feature_strategies as fs')
        .join('g_feature_flags as ff', 'fs.flagId', 'ff.id')
        .where('ff.isArchived', false)
        .whereRaw(`JSON_SEARCH(fs.constraints, 'one', ?, NULL, '$[*].contextName') IS NOT NULL`, [
          fieldName,
        ])
        .select('ff.id as flagId', 'ff.flagName', 'fs.environmentId')
        .groupBy('ff.id', 'ff.flagName', 'fs.environmentId');

      if (rows.length === 0) return;

      // Group by environment for efficient cache invalidation
      const byEnv = new Map<string, string[]>();
      for (const row of rows) {
        await this.incrementFlagVersion(row.flagId, row.environmentId);
        const list = byEnv.get(row.environmentId) || [];
        list.push(row.flagName);
        byEnv.set(row.environmentId, list);
      }

      for (const [env, flagNames] of byEnv) {
        await this.invalidateCache(env, flagNames);
      }
    } catch (error) {
      logger.error('Error invalidating flags referencing context field:', error);
    }
  }

  /**
   * Invalidate feature flags cache for an environment
   */
  async invalidateCache(
    environmentId: string,
    changedFlagNames?: string[],
    changeType: 'definition_changed' | 'enabled_changed' | 'deleted' = 'definition_changed'
  ): Promise<void> {
    try {
      // Invalidate feature flags cache (environment-scoped)
      await pubSubService.invalidateKey(`${ENV_SCOPED.FEATURE_FLAGS.ALL}:${environmentId}`);
      await pubSubService.invalidateKey(`${ENV_SCOPED.SDK_ETAG.FEATURE_FLAGS}:${environmentId}`);

      // Invalidate evaluate API definitions cache
      await pubSubService.invalidateKey(`feature_flags:definitions:${environmentId}`);

      // Increment revision ONCE here at the source, not in each instance's notifyClients.
      // This prevents N instances from incrementing revision N times for a single change.
      const { flagStreamingService } = await import('./FlagStreamingService');
      const revision = await flagStreamingService.incrementGlobalRevision(environmentId);

      // Publish SDK event for real-time updates (revision included in payload)
      // changeType allows SDKs to optimize:
      //   - enabled_changed: toggle isEnabled only, no need to re-fetch flag definition
      //   - deleted: remove from cache, no API call needed
      //   - definition_changed: re-fetch only the changed flags (not all flags)
      await pubSubService.publishSDKEvent({
        type: 'feature_flag.changed',
        data: {
          environmentId,
          changedKeys: changedFlagNames ?? [],
          changeType,
          timestamp: Date.now(),
          revision,
        },
      });

      logger.debug(`Feature flags cache invalidated for environmentId: ${environmentId}`);
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
