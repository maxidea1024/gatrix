import db from '../../config/knex';
import logger from '../../config/logger';
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/dbUtils';
import { ValidationRules, FeatureFlagAttributes, FeatureStrategyAttributes, FeatureVariantAttributes, ValueType, coerceValueByType } from './types';

export class FeatureFlagModel {
  /**
   * Find all flags with environment-specific enabled status
   * Flags are global, isEnabled comes from g_feature_flag_environments
   */
  static async findAll(filters: {
    environmentId: string;
    projectId?: string;
    search?: string;
    flagType?: string;

    isEnabled?: boolean;
    isArchived?: boolean;
    tags?: string[];
    flagNames?: string[];
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    flags: (FeatureFlagAttributes & { isEnabled: boolean })[];
    total: number;
  }> {
    try {
      const {
        environmentId,
        projectId,
        search,
        flagType,

        isEnabled,
        isArchived,
        tags,
        flagNames,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      // Join flags with environment-specific settings and creator info
      const baseQuery = () =>
        db('g_feature_flags as f')
          .leftJoin('g_feature_flag_environments as e', function () {
            this.on('f.id', '=', 'e.flagId').andOn(
              'e.environmentId',
              '=',
              db.raw('?', [environmentId])
            );
          })
          .leftJoin('g_users as u', 'f.createdBy', 'u.id')
          .select(
            'f.*',
            'e.isEnabled',
            'e.lastSeenAt',
            'u.name as createdByName',
            'u.email as createdByEmail',
            db.raw(
              '(SELECT COUNT(*) FROM g_feature_code_references WHERE flagName = f.flagName) as codeReferenceCount'
            )
          );

      const applyFilters = (query: any) => {
        if (projectId) query.where('f.projectId', projectId);
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
        if (flagNames && flagNames.length > 0) {
          query.whereIn('f.flagName', flagNames);
        }
        return query;
      };

      const countResult = await applyFilters(
        db('g_feature_flags as f').leftJoin('g_feature_flag_environments as e', function () {
          this.on('f.id', '=', 'e.flagId').andOn(
            'e.environmentId',
            '=',
            db.raw('?', [environmentId])
          );
        })
      )
        .count('f.id as total')
        .first();

      const flags = await applyFilters(baseQuery())
        .orderBy(`f.${sortBy}`, sortOrder)
        .limit(limit)
        .offset(offset);

      // Get all environment states for these flags
      const flagIds = flags.map((f: any) => f.id);
      let allEnvStates: any[] = [];
      if (flagIds.length > 0) {
        allEnvStates = await db('g_feature_flag_environments').whereIn('flagId', flagIds);
      }

      // Parse JSON fields and attach environments
      const parsedFlags = flags.map((f: any) => {
        const envStates = allEnvStates.filter((e) => e.flagId === f.id);
        return {
          ...f,
          isEnabled: Boolean(f.isEnabled),
          isArchived: Boolean(f.isArchived),
          isFavorite: Boolean(f.isFavorite),
          stale: Boolean(f.stale),
          impressionDataEnabled: Boolean(f.impressionDataEnabled),
          useFixedWeightVariants: Boolean(f.useFixedWeightVariants),
          codeReferenceCount: Number(f.codeReferenceCount || 0),
          tags: parseJsonField<string[]>(f.tags) || [],
          enabledValue: parseJsonField(f.enabledValue),
          disabledValue: parseJsonField(f.disabledValue),
          validationRules: parseJsonField<ValidationRules>(f.validationRules) || undefined,
          environments: envStates.map((e) => ({
            id: e.id,
            flagId: e.flagId,
            environmentId: e.environmentId,
            isEnabled: Boolean(e.isEnabled),
            overrideEnabledValue: Boolean(e.overrideEnabledValue),
            overrideDisabledValue: Boolean(e.overrideDisabledValue),
            enabledValue: parseJsonField(e.enabledValue),
            disabledValue: parseJsonField(e.disabledValue),
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
  static async findByName(
    environmentId: string,
    flagName: string
  ): Promise<(FeatureFlagAttributes & { isEnabled: boolean }) | null> {
    try {
      // Get global flag with creator name
      const flag = await db('g_feature_flags as f')
        .select('f.*', 'creator.name as createdByName')
        .leftJoin('g_users as creator', 'f.createdBy', 'creator.id')
        .where('f.flagName', flagName)
        .first();

      if (!flag) return null;

      // Get ALL environment settings for this flag (for detail page)
      const allEnvSettings = await db('g_feature_flag_environments').where('flagId', flag.id);

      // Get current environment settings
      const envSettings = allEnvSettings.find((e) => e.environmentId === environmentId);

      // Load strategies and variants for this environment
      const strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(
        flag.id,
        environmentId
      );
      const variants = await FeatureVariantModel.findByFlagIdAndEnvironment(flag.id, environmentId);

      return {
        ...flag,
        isEnabled: Boolean(envSettings?.isEnabled),
        lastSeenAt: envSettings?.lastSeenAt,
        isArchived: Boolean(flag.isArchived),
        isFavorite: Boolean(flag.isFavorite),
        stale: Boolean(flag.stale),
        impressionDataEnabled: Boolean(flag.impressionDataEnabled),
        useFixedWeightVariants: Boolean(flag.useFixedWeightVariants),
        tags: parseJsonField<string[]>(flag.tags) || [],
        links: parseJsonField<{ url: string; title?: string }[]>(flag.links) || [],
        enabledValue: parseJsonField(flag.enabledValue),
        disabledValue: parseJsonField(flag.disabledValue),
        validationRules: parseJsonField<ValidationRules>(flag.validationRules) || undefined,
        strategies,
        variants,
        environments: allEnvSettings.map((e) => ({
          id: e.id,
          flagId: e.flagId,
          environmentId: e.environmentId,
          isEnabled: Boolean(e.isEnabled),
          overrideEnabledValue: Boolean(e.overrideEnabledValue),
          overrideDisabledValue: Boolean(e.overrideDisabledValue),
          enabledValue: parseJsonField(e.enabledValue),
          disabledValue: parseJsonField(e.disabledValue),
          lastSeenAt: e.lastSeenAt,
        })),
      };
    } catch (error) {
      logger.error('Error finding feature flag by name:', error);
      throw error;
    }
  }

  static async findById(id: string, environmentId?: string): Promise<FeatureFlagAttributes | null> {
    try {
      const flag = await db('g_feature_flags as f')
        .select('f.*', 'creator.name as createdByName')
        .leftJoin('g_users as creator', 'f.createdBy', 'creator.id')
        .where('f.id', id)
        .first();
      if (!flag) return null;

      let envSettings = null;
      let strategies: FeatureStrategyAttributes[] = [];
      let variants: FeatureVariantAttributes[] = [];

      if (environmentId) {
        envSettings = await db('g_feature_flag_environments')
          .where('flagId', id)
          .where('environmentId', environmentId)
          .first();
        strategies = await FeatureStrategyModel.findByFlagIdAndEnvironment(id, environmentId);
        variants = await FeatureVariantModel.findByFlagIdAndEnvironment(id, environmentId);
      }

      return {
        ...flag,
        isArchived: Boolean(flag.isArchived),
        isFavorite: Boolean(flag.isFavorite),
        stale: Boolean(flag.stale),
        impressionDataEnabled: Boolean(flag.impressionDataEnabled),
        useFixedWeightVariants: Boolean(flag.useFixedWeightVariants),
        tags: parseJsonField<string[]>(flag.tags) || [],
        enabledValue: parseJsonField(flag.enabledValue),
        disabledValue: parseJsonField(flag.disabledValue),
        validationRules: parseJsonField<ValidationRules>(flag.validationRules) || undefined,
        strategies,
        variants,
        environments: envSettings
          ? [
              {
                id: envSettings.id,
                flagId: id,
                environmentId,
                isEnabled: Boolean(envSettings.isEnabled),
                enabledValue: parseJsonField(envSettings.enabledValue),
                disabledValue: parseJsonField(envSettings.disabledValue),
                lastSeenAt: envSettings.lastSeenAt,
              },
            ]
          : [],
      };
    } catch (error) {
      logger.error('Error finding feature flag by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new global flag and optionally initialize environment settings
   */
  static async create(
    data: Omit<
      FeatureFlagAttributes,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'variants'
      | 'strategies'
      | 'environments'
      | 'lastSeenAt'
      | 'createdByName'
    > & {
      environmentId?: string;
      isEnabled?: boolean;
    }
  ): Promise<FeatureFlagAttributes> {
    try {
      const id = ulid();
      await db('g_feature_flags').insert({
        id,
        projectId: (data as any).projectId,
        flagName: data.flagName,
        displayName: data.displayName || data.flagName,
        description: data.description || null,
        flagType: data.flagType || 'release',

        isArchived: false,
        impressionDataEnabled: data.impressionDataEnabled ?? false,
        staleAfterDays: data.staleAfterDays ?? 30,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        valueType: data.valueType,
        enabledValue: JSON.stringify(coerceValueByType(data.enabledValue, data.valueType)),
        disabledValue: JSON.stringify(coerceValueByType(data.disabledValue, data.valueType)),
        validationRules: data.validationRules ? JSON.stringify(data.validationRules) : null,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // If environment provided, create environment settings
      if (data.environmentId) {
        await FeatureFlagEnvironmentModel.create({
          flagId: id,
          environmentId: data.environmentId,
          isEnabled: data.isEnabled ?? true,
        });
      }

      return this.findById(id, data.environmentId) as Promise<FeatureFlagAttributes>;
    } catch (error) {
      logger.error('Error creating feature flag:', error);
      throw error;
    }
  }

  /**
   * Update global flag properties (not environment-specific)
   */
  static async update(
    id: string,
    data: Partial<FeatureFlagAttributes>
  ): Promise<FeatureFlagAttributes> {
    try {
      const updateData: any = { updatedAt: new Date() };

      if (data.displayName !== undefined) updateData.displayName = data.displayName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.flagType !== undefined) updateData.flagType = data.flagType;
      if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
      if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
      if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;
      if (data.impressionDataEnabled !== undefined)
        updateData.impressionDataEnabled = data.impressionDataEnabled;
      if (data.useFixedWeightVariants !== undefined)
        updateData.useFixedWeightVariants = data.useFixedWeightVariants;
      if (data.staleAfterDays !== undefined) updateData.staleAfterDays = data.staleAfterDays;
      if (data.stale !== undefined) updateData.stale = data.stale;
      if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
      if (data.links !== undefined) updateData.links = JSON.stringify(data.links);
      if (data.validationRules !== undefined)
        updateData.validationRules = data.validationRules
          ? JSON.stringify(data.validationRules)
          : null;
      let effectiveValueType = data.valueType;
      if (data.valueType !== undefined) updateData.valueType = data.valueType;

      if (
        effectiveValueType === undefined &&
        (data.enabledValue !== undefined || data.disabledValue !== undefined)
      ) {
        const flag = await db('g_feature_flags').where('id', id).select('valueType').first();
        effectiveValueType = flag?.valueType;
      }

      if (data.enabledValue !== undefined)
        updateData.enabledValue = JSON.stringify(
          coerceValueByType(data.enabledValue, effectiveValueType)
        );
      if (data.disabledValue !== undefined)
        updateData.disabledValue = JSON.stringify(
          coerceValueByType(data.disabledValue, effectiveValueType)
        );
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

  static async updateLastSeenAt(flagId: string, environmentId: string): Promise<void> {
    try {
      await db('g_feature_flag_environments')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .update({ lastSeenAt: new Date() });
    } catch (error) {
      logger.error('Error updating lastSeenAt:', error);
    }
  }
}
