import db from '../config/knex';
import logger from '../config/logger';
import {
  RemoteConfig,
  CreateRemoteConfigData,
  UpdateRemoteConfigData,
  RemoteConfigFilters,
  RemoteConfigListResponse,
  ConfigVersion,
  ConfigVersionStatus,
  ConfigRule,
  ConfigVariant,
  CreateConfigVersionData
} from '../types/remoteConfig';
import { getCurrentEnvironmentId } from '../utils/environmentContext';

export class RemoteConfigModel {
  /**
   * Get all remote configs with pagination and filters
   */
  static async list(
    page: number = 1,
    limit: number = 10,
    filters: RemoteConfigFilters = {}
  ): Promise<RemoteConfigListResponse> {
    try {
      const offset = (page - 1) * limit;
      const envId = filters.environmentId ?? getCurrentEnvironmentId();

      let query = db('g_remote_configs as rc')
        .leftJoin('g_users as creator', 'rc.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'rc.updatedBy', 'updater.id')
        .select([
          'rc.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
        ])
        .where('rc.environmentId', envId);

      // Apply filters
      if (filters.search) {
        query = query.where(function() {
          this.where('rc.keyName', 'like', `%${filters.search}%`)
              .orWhere('rc.description', 'like', `%${filters.search}%`);
        });
      }

      if (filters.valueType) {
        query = query.where('rc.valueType', filters.valueType);
      }

      if (filters.isActive !== undefined) {
        query = query.where('rc.isActive', filters.isActive);
      }

      if (filters.createdBy) {
        query = query.where('rc.createdBy', filters.createdBy);
      }

      // Get total count
      const totalQuery = query.clone().clearSelect().count('* as count');
      const [{ count: total }] = await totalQuery;

      // Apply sorting
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'desc';
      query = query.orderBy(`rc.${sortBy}`, sortOrder);

      // Apply pagination
      const configs = await query.limit(limit).offset(offset);

      // Transform snake_case to camelCase and add status from latest version
      const transformedConfigs = await Promise.all(
        configs.map(async (config) => {
          const transformedConfig = this.transformConfig(config);

          // Get config status based on Git-style workflow
          // Priority: draft > staged > published > archived
          const versions = await db('g_remote_config_versions')
            .where('configId', config.id)
            .orderBy('versionNumber', 'desc');

          let status: ConfigVersionStatus = 'draft';
          if (versions.length > 0) {
            // Check for draft versions first (highest priority)
            const draftVersion = versions.find(v => v.status === 'draft');
            if (draftVersion) {
              status = 'draft';
            } else {
              // Check for staged versions
              const stagedVersion = versions.find(v => v.status === 'staged');
              if (stagedVersion) {
                status = 'staged';
              } else {
                // Check for published versions
                const publishedVersion = versions.find(v => v.status === 'published');
                if (publishedVersion) {
                  status = 'published';
                } else {
                  // Default to latest version status
                  status = versions[0]?.status || 'draft';
                }
              }
            }
          }

          transformedConfig.status = status;
          return transformedConfig;
        })
      );

      return {
        configs: transformedConfigs,
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit)
      };
    } catch (error) {
      logger.error('Error listing remote configs:', error);
      throw error;
    }
  }

  /**
   * Get remote config by ID with relations
   */
  static async findById(id: number, includeRelations: boolean = true, environmentId?: string): Promise<RemoteConfig | null> {
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      const config = await db('g_remote_configs as rc')
        .leftJoin('g_users as creator', 'rc.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'rc.updatedBy', 'updater.id')
        .select([
          'rc.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
        ])
        .where('rc.id', id)
        .where('rc.environmentId', envId)
        .first();

      if (!config) {
        return null;
      }

      const transformedConfig = this.transformConfig(config);

      if (includeRelations) {
        // Get current published version
        const currentVersion = await db('g_remote_config_versions')
          .where('configId', id)
          .where('status', 'published')
          .orderBy('versionNumber', 'desc')
          .first();

        if (currentVersion) {
          transformedConfig.currentVersion = this.transformConfigVersion(currentVersion);
        }

        // Get all versions
        const versions = await db('g_remote_config_versions as cv')
          .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
          .select([
            'cv.*',
            'creator.name as createdByName'
          ])
          .where('cv.configId', id)
          .orderBy('cv.versionNumber', 'desc');

        transformedConfig.versions = versions.map(this.transformConfigVersion);

        // Get rules
        const rules = await db('g_remote_config_rules as cr')
          .leftJoin('g_users as creator', 'cr.createdBy', 'creator.id')
          .select([
            'cr.*',
            'creator.name as createdByName'
          ])
          .where('cr.configId', id)
          .where('cr.isActive', true)
          .orderBy('cr.priority', 'desc');

        transformedConfig.rules = rules.map(this.transformConfigRule);

        // Get variants
        const variants = await db('g_remote_config_variants as cv')
          .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
          .select([
            'cv.*',
            'creator.name as createdByName'
          ])
          .where('cv.configId', id)
          .where('cv.isActive', true);

        transformedConfig.variants = variants.map(this.transformConfigVariant);
      }

      return transformedConfig;
    } catch (error) {
      logger.error('Error finding remote config by ID:', error);
      throw error;
    }
  }

  /**
   * Get remote config by key name
   */
  static async findByKey(keyName: string, environmentId?: string): Promise<RemoteConfig | null> {
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      const config = await db('g_remote_configs as rc')
        .leftJoin('g_users as creator', 'rc.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'rc.updatedBy', 'updater.id')
        .select([
          'rc.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
        ])
        .where('rc.keyName', keyName)
        .where('rc.environmentId', envId)
        .first();

      return config ? this.transformConfig(config) : null;
    } catch (error) {
      logger.error('Error finding remote config by key:', error);
      throw error;
    }
  }

  /**
   * Create new remote config
   */
  static async create(data: CreateRemoteConfigData): Promise<RemoteConfig> {
    try {
      const envId = getCurrentEnvironmentId();
      const [insertId] = await db('g_remote_configs').insert({
        environmentId: envId,
        keyName: data.keyName,
        defaultValue: data.defaultValue || null,
        valueType: data.valueType,
        description: data.description || null,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || null
      });

      const created = await this.findById(insertId, false, envId);
      if (!created) {
        throw new Error('Failed to retrieve created remote config');
      }

      // Version creation removed - using template version system instead

      logger.info(`Remote config created: ${data.keyName} (ID: ${insertId})`);
      return created;
    } catch (error) {
      logger.error('Error creating remote config:', error);
      throw error;
    }
  }

  /**
   * Update remote config
   */
  static async update(id: number, data: UpdateRemoteConfigData, environmentId?: string): Promise<RemoteConfig> {
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      const updateData: any = {};

      if (data.keyName !== undefined) updateData.keyName = data.keyName;
      if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue;
      if (data.valueType !== undefined) updateData.valueType = data.valueType;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      await db('g_remote_configs').where('id', id).where('environmentId', envId).update(updateData);

      const updated = await this.findById(id, false, envId);
      if (!updated) {
        throw new Error('Failed to retrieve updated remote config');
      }

      logger.info(`Remote config updated: ID ${id}`);
      return updated;
    } catch (error) {
      logger.error('Error updating remote config:', error);
      throw error;
    }
  }

  /**
   * Delete remote config
   */
  static async delete(id: number, environmentId?: string): Promise<void> {
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      await db('g_remote_configs').where('id', id).where('environmentId', envId).del();
      logger.info(`Remote config deleted: ID ${id}`);
    } catch (error) {
      logger.error('Error deleting remote config:', error);
      throw error;
    }
  }

  /**
   * Transform database row to RemoteConfig object
   */
  private static transformConfig(row: any): RemoteConfig {
    return {
      id: row.id,
      keyName: row.keyName,
      defaultValue: row.defaultValue,
      valueType: row.valueType,
      description: row.description,
      isActive: Boolean(row.isActive),
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName,
      createdByEmail: row.createdByEmail,
      updatedByName: row.updatedByName,
      updatedByEmail: row.updatedByEmail
    };
  }

  /**
   * Transform database row to ConfigVersion object
   */
  private static transformConfigVersion(row: any): ConfigVersion {
    return {
      id: row.id,
      configId: row.configId,
      versionNumber: row.versionNumber,
      value: row.value,
      status: row.status,
      changeDescription: row.changeDescription,
      publishedAt: row.publishedAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      createdByName: row.createdByName
    };
  }

  /**
   * Transform database row to ConfigRule object
   */
  private static transformConfigRule(row: any): ConfigRule {
    return {
      id: row.id,
      configId: row.configId,
      ruleName: row.ruleName,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      value: row.value,
      priority: row.priority,
      isActive: Boolean(row.isActive),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName
    };
  }

  /**
   * Transform database row to ConfigVariant object
   */
  private static transformConfigVariant(row: any): ConfigVariant {
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

export default RemoteConfigModel;

// ConfigVersionModel removed - using template version system instead






