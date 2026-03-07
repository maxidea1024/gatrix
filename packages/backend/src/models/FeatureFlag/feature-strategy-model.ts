import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('FeatureStrategyModel');
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/db-utils';
import { FeatureStrategyAttributes, StrategyParameters, Constraint } from './types';

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
  static async findByFlagIdAndEnvironment(
    flagId: string,
    environmentId: string
  ): Promise<FeatureStrategyAttributes[]> {
    try {
      const strategies = await db('g_feature_strategies')
        .where('flagId', flagId)
        .where('environmentId', environmentId)
        .orderBy('sortOrder', 'asc');

      return this.enrichStrategiesWithSegments(strategies);
    } catch (error) {
      logger.error('Error finding strategies by flag ID and environment:', error);
      throw error;
    }
  }

  private static async enrichStrategiesWithSegments(
    strategies: any[]
  ): Promise<FeatureStrategyAttributes[]> {
    const result = [];
    for (const s of strategies) {
      const segmentLinks = await db('g_feature_flag_segments')
        .where('strategyId', s.id)
        .select('segmentId');

      const segmentNames: string[] = [];
      for (const link of segmentLinks) {
        const segment = await db('g_feature_segments').where('id', link.segmentId).first();
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

  static async create(
    data: Omit<FeatureStrategyAttributes, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FeatureStrategyAttributes> {
    try {
      const id = ulid();
      await db('g_feature_strategies').insert({
        id,
        flagId: data.flagId,
        environmentId: data.environmentId,
        strategyName: data.strategyName,
        title: data.title || null,
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

  static async update(
    id: string,
    data: Partial<FeatureStrategyAttributes>
  ): Promise<FeatureStrategyAttributes> {
    try {
      const updateData: any = { updatedAt: new Date() };

      if (data.strategyName !== undefined) updateData.strategyName = data.strategyName;
      if (data.title !== undefined) updateData.title = data.title || null;
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
