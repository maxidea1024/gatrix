import db from '../config/knex';
import logger from '../config/logger';

export interface FeatureFlagTypeAttributes {
  flagType: string;
  displayName: string;
  description: string | null;
  lifetimeDays: number | null;
  iconName: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateFlagTypeInput {
  displayName?: string;
  description?: string | null;
  lifetimeDays?: number | null;
  iconName?: string | null;
  sortOrder?: number;
}

export class FeatureFlagTypeModel {
  private static tableName = 'g_feature_flag_types';

  /**
   * Find all flag types
   */
  static async findAll(): Promise<FeatureFlagTypeAttributes[]> {
    try {
      const types = await db(this.tableName).orderBy('sortOrder', 'asc');
      return types as FeatureFlagTypeAttributes[];
    } catch (error) {
      logger.error('Error finding flag types:', error);
      throw error;
    }
  }

  /**
   * Find by flag type
   */
  static async findByType(flagType: string): Promise<FeatureFlagTypeAttributes | null> {
    try {
      const type = await db(this.tableName).where('flagType', flagType).first();
      return type ? (type as FeatureFlagTypeAttributes) : null;
    } catch (error) {
      logger.error('Error finding flag type:', error);
      throw error;
    }
  }

  /**
   * Update a flag type
   */
  static async update(
    flagType: string,
    input: UpdateFlagTypeInput
  ): Promise<FeatureFlagTypeAttributes> {
    try {
      const updateData: any = { updatedAt: new Date() };

      if (input.displayName !== undefined) updateData.displayName = input.displayName;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.lifetimeDays !== undefined) updateData.lifetimeDays = input.lifetimeDays;
      if (input.iconName !== undefined) updateData.iconName = input.iconName;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

      await db(this.tableName).where('flagType', flagType).update(updateData);

      const updated = await this.findByType(flagType);
      if (!updated) throw new Error('Flag type not found after update');
      return updated;
    } catch (error) {
      logger.error('Error updating flag type:', error);
      throw error;
    }
  }
}
