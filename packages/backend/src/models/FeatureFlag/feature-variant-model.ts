import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('FeatureVariantModel');
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/db-utils';
import { FeatureVariantAttributes } from './types';

export class FeatureVariantModel {
  static async findByFlagId(
    flagId: string
  ): Promise<FeatureVariantAttributes[]> {
    try {
      const variants = await db('g_feature_variants').where('flagId', flagId);

      return variants.map((v: any) => ({
        ...v,
        value: parseJsonField(v.value),
      }));
    } catch (error) {
      logger.error('Error finding variants by flag ID:', error);
      throw error;
    }
  }

  static async findByFlagIdAndEnvironment(
    flagId: string,
    environmentId: string
  ): Promise<FeatureVariantAttributes[]> {
    try {
      const variants = await db('g_feature_variants')
        .where('flagId', flagId)
        .where('environmentId', environmentId);

      return variants.map((v: any) => ({
        ...v,
        value: parseJsonField(v.value),
      }));
    } catch (error) {
      logger.error('Error finding variants by flag ID and environment:', error);
      throw error;
    }
  }

  static async create(
    data: Omit<FeatureVariantAttributes, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FeatureVariantAttributes> {
    try {
      const id = ulid();
      await db('g_feature_variants').insert({
        id,
        flagId: data.flagId,
        environmentId: data.environmentId,
        variantName: data.variantName,
        weight: data.weight,
        value:
          data.value !== null && data.value !== undefined
            ? JSON.stringify(data.value)
            : null,
        valueType: data.valueType || 'json',
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const variant = await db('g_feature_variants').where('id', id).first();
      return {
        ...variant,
        value: parseJsonField(variant.value),
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

  static async deleteByFlagIdAndEnvironment(
    flagId: string,
    environmentId: string
  ): Promise<void> {
    try {
      await db('g_feature_variants')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .del();
    } catch (error) {
      logger.error('Error deleting variants:', error);
      throw error;
    }
  }
}
