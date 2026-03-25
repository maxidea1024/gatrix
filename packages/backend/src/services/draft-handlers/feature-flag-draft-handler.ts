/**
 * Feature Flag Draft Handler
 *
 * Implements the DraftHandler interface for feature flags.
 * Draft is at the FLAG level (not per-environment).
 * Draft data structure: { [environmentId]: { strategies, variants, values } }
 *
 * When user edits strategies/variants/values in any environment,
 * the changes are accumulated in a single draft per flag.
 * Publishing applies all accumulated changes across all environments.
 */

import {
  FeatureFlagEnvironmentModel,
  FeatureStrategyModel,
  FeatureVariantModel,
  FeatureSegmentModel,
} from '../../models/FeatureFlag';
import { featureFlagService } from '../feature-flag-service';
import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('FeatureFlagDraftHandler');

/**
 * Create a snapshot of the current published state for a feature flag (all environments).
 * Used by Playground, CR diff views, and the draft system.
 */
export async function createFeatureFlagSnapshot(
  targetId: string
): Promise<Record<string, any>> {
  const flag = await db('g_feature_flags').where('id', targetId).first();
  if (!flag) {
    throw new Error(`Feature flag '${targetId}' not found`);
  }

  const envSettings = await FeatureFlagEnvironmentModel.findByFlagId(targetId);

  const snapshot: Record<string, any> = {};

  for (const env of envSettings) {
    const strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
      targetId,
      env.environmentId
    );

    const variants = await FeatureVariantModel.findByFlagIdAndEnvironment(
      targetId,
      env.environmentId
    );

    snapshot[env.environmentId] = {
      isEnabled: env.isEnabled ?? false,
      overrideEnabledValue: env.overrideEnabledValue ?? false,
      overrideDisabledValue: env.overrideDisabledValue ?? false,
      enabledValue: env.overrideEnabledValue
        ? env.enabledValue
        : flag.enabledValue != null
          ? typeof flag.enabledValue === 'string'
            ? JSON.parse(flag.enabledValue)
            : flag.enabledValue
          : undefined,
      disabledValue: env.overrideDisabledValue
        ? env.disabledValue
        : flag.disabledValue != null
          ? typeof flag.disabledValue === 'string'
            ? JSON.parse(flag.disabledValue)
            : flag.disabledValue
          : undefined,
      strategies: strategies.map((s) => ({
        id: s.id,
        strategyName: s.strategyName,
        title: s.title,
        parameters: s.parameters,
        constraints: s.constraints,
        segments: s.segments,
        sortOrder: s.sortOrder,
        isEnabled: s.isEnabled,
      })),
      variants: variants.map((v) => ({
        id: v.id,
        variantName: v.variantName,
        weight: v.weight,
        value: v.value,
        valueType: v.valueType,
      })),
    };
  }

  return snapshot;
}

/**
 * Apply draft data for a feature flag to real tables.
 * This is the core publish logic used by both the draft system and the CR system.
 *
 * @param targetId - Flag ID
 * @param environmentId - Environment ID (or undefined for all envs, ignored — uses draftData keys)
 * @param draftData - Draft data: { [environmentId]: { strategies, variants, values }, _global?: { ... } }
 * @param userId - User performing the action
 */
export async function publishFeatureFlagDraft(
  targetId: string,
  environmentId: string | undefined,
  draftData: Record<string, any>,
  userId: string
): Promise<any> {
  const { ulid } = await import('ulid');
  const flag = await db('g_feature_flags').where('id', targetId).first();
  if (!flag) {
    throw new Error(`Feature flag '${targetId}' not found`);
  }

  // Apply flag-level (global) settings first if present
  const globalData = draftData._global;
  if (globalData) {
    const flagUpdate: any = {};
    if (globalData.enabledValue !== undefined) {
      flagUpdate.enabledValue = JSON.stringify(globalData.enabledValue);
    }
    if (globalData.disabledValue !== undefined) {
      flagUpdate.disabledValue = JSON.stringify(globalData.disabledValue);
    }
    if (globalData.validationRules !== undefined) {
      flagUpdate.validationRules = globalData.validationRules
        ? JSON.stringify(globalData.validationRules)
        : null;
    }
    if (globalData.useFixedWeightVariants !== undefined) {
      flagUpdate.useFixedWeightVariants = globalData.useFixedWeightVariants;
    }
    if (globalData.impressionDataEnabled !== undefined) {
      flagUpdate.impressionDataEnabled = globalData.impressionDataEnabled;
    }
    if (Object.keys(flagUpdate).length > 0) {
      await db('g_feature_flags').where('id', targetId).update(flagUpdate);
    }
  }

  // Apply changes for each environment in the draft
  // Filter out internal metadata keys (_global, _flagName, etc.)
  const envEntries = Object.entries(draftData).filter(
    ([key]) => !key.startsWith('_')
  );

  for (const [envId, envData] of envEntries) {
    // Apply isEnabled toggle
    if (envData.isEnabled !== undefined) {
      await FeatureFlagEnvironmentModel.update(targetId, envId, {
        isEnabled: envData.isEnabled,
      });
    }

    // Apply environment-level value overrides
    if (
      envData.overrideEnabledValue !== undefined ||
      envData.overrideDisabledValue !== undefined ||
      envData.enabledValue !== undefined ||
      envData.disabledValue !== undefined
    ) {
      const envUpdate: any = {};
      if (envData.overrideEnabledValue !== undefined) {
        envUpdate.overrideEnabledValue = envData.overrideEnabledValue;
      }
      if (envData.overrideDisabledValue !== undefined) {
        envUpdate.overrideDisabledValue = envData.overrideDisabledValue;
      }
      if (envData.enabledValue !== undefined) {
        envUpdate.enabledValue = envData.enabledValue;
      }
      if (envData.disabledValue !== undefined) {
        envUpdate.disabledValue = envData.disabledValue;
      }
      await FeatureFlagEnvironmentModel.update(targetId, envId, envUpdate);
    }

    // Replace strategies
    if (envData.strategies !== undefined) {
      const oldStrategies =
        await FeatureStrategyModel.findByFlagIdAndEnvironment(targetId, envId);
      for (const oldStrategy of oldStrategies) {
        await db('g_feature_flag_segments')
          .where('strategyId', oldStrategy.id)
          .del();
        await FeatureStrategyModel.delete(oldStrategy.id);
      }

      for (const draftStrategy of envData.strategies) {
        const newStrategy = await FeatureStrategyModel.create({
          flagId: targetId,
          environmentId: envId,
          strategyName: draftStrategy.strategyName,
          title: draftStrategy.title,
          parameters: draftStrategy.parameters,
          constraints: draftStrategy.constraints,
          sortOrder: draftStrategy.sortOrder,
          isEnabled: draftStrategy.isEnabled,
          createdBy: userId,
        });

        if (draftStrategy.segments && draftStrategy.segments.length > 0) {
          for (const segmentName of draftStrategy.segments) {
            const segment = await FeatureSegmentModel.findByName(segmentName);
            if (segment) {
              await db('g_feature_flag_segments').insert({
                id: ulid(),
                strategyId: newStrategy.id,
                segmentId: segment.id,
                createdAt: new Date(),
              });
            }
          }
        }
      }
    }

    // Replace variants
    if (envData.variants !== undefined) {
      await FeatureVariantModel.deleteByFlagIdAndEnvironment(targetId, envId);

      for (const draftVariant of envData.variants) {
        await FeatureVariantModel.create({
          flagId: targetId,
          environmentId: envId,
          variantName: draftVariant.variantName,
          weight: draftVariant.weight,
          value: draftVariant.value,
          valueType: draftVariant.valueType,
          createdBy: userId,
        });
      }
    }

    // Increment version and invalidate cache for this environment
    await featureFlagService.incrementFlagVersion(targetId, envId);
    await featureFlagService.invalidateCache(envId, [flag.flagName]);
  }

  // If global data (enabledValue, disabledValue, etc.) changed but no env-specific entries,
  // invalidate cache for ALL environments so SDK picks up the new values.
  if (globalData && envEntries.length === 0) {
    const flagEnvs = await db('g_feature_flag_environments')
      .select('environmentId')
      .where('flagId', targetId);
    for (const fe of flagEnvs) {
      await featureFlagService.incrementFlagVersion(targetId, fe.environmentId);
      await featureFlagService.invalidateCache(fe.environmentId, [
        flag.flagName,
      ]);
    }
  }

  logger.info(
    `Feature flag draft published: ${targetId} (${Object.keys(draftData).length} environments)`
  );

  return { flagId: targetId, environments: Object.keys(draftData) };
}

// ==================== Draft Handler Object ====================

const featureFlagDraftHandler = {
  createSnapshot: createFeatureFlagSnapshot,

  async publish(
    targetId: string,
    _environmentId: string | undefined,
    draftData: Record<string, any>,
    userId: string
  ): Promise<any> {
    return publishFeatureFlagDraft(targetId, _environmentId, draftData, userId);
  },

  async getDisplayName(targetId: string): Promise<string | null> {
    const flag = await db('g_feature_flags')
      .select('flagName')
      .where('id', targetId)
      .first();
    return flag?.flagName || null;
  },
};
