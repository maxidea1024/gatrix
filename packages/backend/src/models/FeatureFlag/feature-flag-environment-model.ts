import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('FeatureFlagEnvironmentModel');
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/db-utils';
import { FeatureFlagEnvironmentAttributes, coerceValueByType } from './types';

export class FeatureFlagEnvironmentModel {
  static async findByFlagId(
    flagId: string
  ): Promise<FeatureFlagEnvironmentAttributes[]> {
    try {
      const envs = await db('g_feature_flag_environments').where(
        'flagId',
        flagId
      );
      return envs.map((e: any) => ({
        ...e,
        isEnabled: Boolean(e.isEnabled),
        overrideEnabledValue: Boolean(e.overrideEnabledValue),
        overrideDisabledValue: Boolean(e.overrideDisabledValue),
        enabledValue: parseJsonField(e.enabledValue),
        disabledValue: parseJsonField(e.disabledValue),
      }));
    } catch (error) {
      logger.error('Error finding flag environments:', error);
      throw error;
    }
  }

  static async findByFlagIdAndEnvironment(
    flagId: string,
    environmentId: string
  ): Promise<FeatureFlagEnvironmentAttributes | null> {
    try {
      const env = await db('g_feature_flag_environments')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .first();
      if (!env) return null;
      return {
        ...env,
        isEnabled: Boolean(env.isEnabled),
        overrideEnabledValue: Boolean(env.overrideEnabledValue),
        overrideDisabledValue: Boolean(env.overrideDisabledValue),
        enabledValue: parseJsonField(env.enabledValue),
        disabledValue: parseJsonField(env.disabledValue),
      };
    } catch (error) {
      logger.error('Error finding flag environment:', error);
      throw error;
    }
  }

  static async create(
    data: Omit<
      FeatureFlagEnvironmentAttributes,
      'id' | 'createdAt' | 'updatedAt'
    >
  ): Promise<FeatureFlagEnvironmentAttributes> {
    try {
      const id = ulid();
      await db('g_feature_flag_environments').insert({
        id,
        flagId: data.flagId,
        environmentId: data.environmentId,
        isEnabled: data.isEnabled ?? false,
        overrideEnabledValue: data.overrideEnabledValue ?? false,
        overrideDisabledValue: data.overrideDisabledValue ?? false,
        enabledValue:
          data.enabledValue !== undefined
            ? JSON.stringify(data.enabledValue)
            : null,
        disabledValue:
          data.disabledValue !== undefined
            ? JSON.stringify(data.disabledValue)
            : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return this.findByFlagIdAndEnvironment(
        data.flagId,
        data.environmentId
      ) as Promise<FeatureFlagEnvironmentAttributes>;
    } catch (error) {
      logger.error('Error creating flag environment:', error);
      throw error;
    }
  }

  static async updateIsEnabled(
    flagId: string,
    environmentId: string,
    isEnabled: boolean
  ): Promise<FeatureFlagEnvironmentAttributes> {
    try {
      // Upsert - create if not exists
      const existing = await this.findByFlagIdAndEnvironment(
        flagId,
        environmentId
      );
      if (!existing) {
        return this.create({ flagId, environmentId, isEnabled });
      }

      await db('g_feature_flag_environments')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .update({ isEnabled, updatedAt: new Date() });

      return this.findByFlagIdAndEnvironment(
        flagId,
        environmentId
      ) as Promise<FeatureFlagEnvironmentAttributes>;
    } catch (error) {
      logger.error('Error updating flag environment:', error);
      throw error;
    }
  }

  static async update(
    flagId: string,
    environmentId: string,
    data: Partial<FeatureFlagEnvironmentAttributes>
  ): Promise<FeatureFlagEnvironmentAttributes> {
    try {
      let valueType: string | undefined;
      if (data.enabledValue !== undefined || data.disabledValue !== undefined) {
        const flag = await db('g_feature_flags')
          .where('id', flagId)
          .select('valueType')
          .first();
        valueType = flag?.valueType;
      }

      // Upsert - create if not exists
      const existing = await this.findByFlagIdAndEnvironment(
        flagId,
        environmentId
      );
      if (!existing) {
        return this.create({
          flagId,
          environmentId,
          isEnabled: data.isEnabled ?? false,
          overrideEnabledValue: data.overrideEnabledValue ?? false,
          overrideDisabledValue: data.overrideDisabledValue ?? false,
          enabledValue:
            data.enabledValue !== undefined
              ? coerceValueByType(data.enabledValue, valueType)
              : undefined,
          disabledValue:
            data.disabledValue !== undefined
              ? coerceValueByType(data.disabledValue, valueType)
              : undefined,
        });
      }

      const updateData: any = { updatedAt: new Date() };
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
      if (data.overrideEnabledValue !== undefined)
        updateData.overrideEnabledValue = data.overrideEnabledValue;
      if (data.overrideDisabledValue !== undefined)
        updateData.overrideDisabledValue = data.overrideDisabledValue;
      if (data.enabledValue !== undefined)
        updateData.enabledValue = JSON.stringify(
          coerceValueByType(data.enabledValue, valueType)
        );
      if (data.disabledValue !== undefined)
        updateData.disabledValue = JSON.stringify(
          coerceValueByType(data.disabledValue, valueType)
        );

      await db('g_feature_flag_environments')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .update(updateData);

      return this.findByFlagIdAndEnvironment(
        flagId,
        environmentId
      ) as Promise<FeatureFlagEnvironmentAttributes>;
    } catch (error) {
      logger.error('Error updating flag environment:', error);
      throw error;
    }
  }

  static async delete(flagId: string, environmentId: string): Promise<void> {
    try {
      await db('g_feature_flag_environments')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .del();
    } catch (error) {
      logger.error('Error deleting flag environment:', error);
      throw error;
    }
  }
}
