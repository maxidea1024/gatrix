import db from '../config/knex';
import logger from '../config/logger';
import {
  ConfigVariant,
  CreateConfigVariantData
} from '../types/remoteConfig';

export class VariantModel {
  /**
   * Get all variants for a config
   */
  static async getVariantsByConfigId(configId: number): Promise<ConfigVariant[]> {
    try {
      const variants = await db('g_remote_config_variants as v')
        .leftJoin('g_users as creator', 'v.createdBy', 'creator.id')
        .select([
          'v.*',
          'creator.name as createdByName'
        ])
        .where('v.configId', configId)
        .orderBy('v.trafficPercentage', 'desc');

      return variants.map(this.transformVariant);
    } catch (error) {
      logger.error('Error getting config variants:', error);
      throw error;
    }
  }

  /**
   * Get variant by ID
   */
  static async findById(id: number): Promise<ConfigVariant | null> {
    try {
      const variant = await db('g_remote_config_variants as v')
        .leftJoin('g_users as creator', 'v.createdBy', 'creator.id')
        .select([
          'v.*',
          'creator.name as createdByName'
        ])
        .where('v.id', id)
        .first();

      return variant ? this.transformVariant(variant) : null;
    } catch (error) {
      logger.error('Error finding variant by ID:', error);
      throw error;
    }
  }

  /**
   * Create new variant
   */
  static async create(data: CreateConfigVariantData): Promise<ConfigVariant> {
    try {
      // Validate traffic percentage doesn't exceed 100%
      const existingVariants = await this.getVariantsByConfigId(data.configId);
      const totalTraffic = existingVariants
        .filter(v => v.isActive)
        .reduce((sum, v) => sum + v.trafficPercentage, 0);
      
      const newTraffic = data.trafficPercentage || 0;
      if (totalTraffic + newTraffic > 100) {
        throw new Error(`Traffic percentage would exceed 100%. Current: ${totalTraffic}%, Trying to add: ${newTraffic}%`);
      }

      const [insertId] = await db('g_remote_config_variants').insert({
        configId: data.configId,
        variantName: data.variantName,
        value: data.value || null,
        trafficPercentage: data.trafficPercentage || 0,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || null
      });

      const created = await this.findById(insertId);
      if (!created) {
        throw new Error('Failed to retrieve created variant');
      }

      logger.info(`Variant created: ${data.variantName} for config ${data.configId} (ID: ${insertId})`);
      return created;
    } catch (error) {
      logger.error('Error creating variant:', error);
      throw error;
    }
  }

  /**
   * Update variant
   */
  static async update(id: number, data: Partial<CreateConfigVariantData>): Promise<ConfigVariant> {
    try {
      // Get current variant
      const currentVariant = await this.findById(id);
      if (!currentVariant) {
        throw new Error('Variant not found');
      }

      // Validate traffic percentage if being updated
      if (data.trafficPercentage !== undefined) {
        const existingVariants = await this.getVariantsByConfigId(currentVariant.configId);
        const totalTraffic = existingVariants
          .filter(v => v.isActive && v.id !== id)
          .reduce((sum, v) => sum + v.trafficPercentage, 0);
        
        const newTraffic = data.trafficPercentage;
        if (totalTraffic + newTraffic > 100) {
          throw new Error(`Traffic percentage would exceed 100%. Current (excluding this variant): ${totalTraffic}%, Trying to set: ${newTraffic}%`);
        }
      }

      const updateData: any = {};

      if (data.variantName !== undefined) updateData.variantName = data.variantName;
      if (data.value !== undefined) updateData.value = data.value;
      if (data.trafficPercentage !== undefined) updateData.trafficPercentage = data.trafficPercentage;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await db('g_remote_config_variants').where('id', id).update(updateData);

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Failed to retrieve updated variant');
      }

      logger.info(`Variant updated: ID ${id}`);
      return updated;
    } catch (error) {
      logger.error('Error updating variant:', error);
      throw error;
    }
  }

  /**
   * Delete variant
   */
  static async delete(id: number): Promise<void> {
    try {
      await db('g_remote_config_variants').where('id', id).del();
      logger.info(`Variant deleted: ID ${id}`);
    } catch (error) {
      logger.error('Error deleting variant:', error);
      throw error;
    }
  }

  /**
   * Get active variants for a config (used by evaluation engine)
   */
  static async getActiveVariants(configId: number): Promise<ConfigVariant[]> {
    try {
      const variants = await db('g_remote_config_variants as v')
        .leftJoin('g_users as creator', 'v.createdBy', 'creator.id')
        .select([
          'v.*',
          'creator.name as createdByName'
        ])
        .where('v.configId', configId)
        .where('v.isActive', true)
        .where('v.trafficPercentage', '>', 0)
        .orderBy('v.trafficPercentage', 'desc');

      return variants.map(this.transformVariant);
    } catch (error) {
      logger.error('Error getting active variants:', error);
      throw error;
    }
  }

  /**
   * Validate total traffic percentage for a config
   */
  static async validateTrafficPercentage(configId: number, excludeVariantId?: number): Promise<{
    isValid: boolean;
    totalTraffic: number;
    maxAllowed: number;
  }> {
    try {
      const variants = await this.getVariantsByConfigId(configId);
      const activeVariants = variants.filter(v => 
        v.isActive && 
        (excludeVariantId ? v.id !== excludeVariantId : true)
      );
      
      const totalTraffic = activeVariants.reduce((sum, v) => sum + v.trafficPercentage, 0);
      
      return {
        isValid: totalTraffic <= 100,
        totalTraffic,
        maxAllowed: 100
      };
    } catch (error) {
      logger.error('Error validating traffic percentage:', error);
      throw error;
    }
  }

  /**
   * Get traffic distribution summary for a config
   */
  static async getTrafficSummary(configId: number): Promise<{
    totalAllocated: number;
    defaultTraffic: number;
    variants: Array<{
      id: number;
      name: string;
      percentage: number;
      isActive: boolean;
    }>;
  }> {
    try {
      const variants = await this.getVariantsByConfigId(configId);
      const activeVariants = variants.filter(v => v.isActive);
      
      const totalAllocated = activeVariants.reduce((sum, v) => sum + v.trafficPercentage, 0);
      const defaultTraffic = Math.max(0, 100 - totalAllocated);
      
      return {
        totalAllocated,
        defaultTraffic,
        variants: variants.map(v => ({
          id: v.id,
          name: v.variantName,
          percentage: v.trafficPercentage,
          isActive: v.isActive
        }))
      };
    } catch (error) {
      logger.error('Error getting traffic summary:', error);
      throw error;
    }
  }

  /**
   * Transform database row to ConfigVariant object
   */
  private static transformVariant(row: any): ConfigVariant {
    return {
      id: row.id,
      configId: row.configId,
      variantName: row.variantName,
      value: row.value,
      trafficPercentage: parseFloat(row.trafficPercentage),
      isActive: Boolean(row.isActive),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName
    };
  }
}

export default VariantModel;
