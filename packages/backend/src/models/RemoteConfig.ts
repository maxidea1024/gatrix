import db from '../config/knex';
import logger from '../config/logger';
import {
  RemoteConfig,
  CreateRemoteConfigData,
  UpdateRemoteConfigData,
  RemoteConfigFilters,
  RemoteConfigListResponse,
  ConfigVersion,
  ConfigRule,
  ConfigVariant,
  CreateConfigVersionData
} from '../types/remoteConfig';

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
      
      let query = db('g_remote_configs as rc')
        .leftJoin('g_users as creator', 'rc.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'rc.updatedBy', 'updater.id')
        .select([
          'rc.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
        ]);

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

      // Transform snake_case to camelCase
      const transformedConfigs = configs.map(this.transformConfig);

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
  static async findById(id: number, includeRelations: boolean = true): Promise<RemoteConfig | null> {
    try {
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
        .first();

      if (!config) {
        return null;
      }

      const transformedConfig = this.transformConfig(config);

      if (includeRelations) {
        // Get current published version
        const currentVersion = await db('g_remote_config_versions')
          .where('config_id', id)
          .where('status', 'published')
          .orderBy('version_number', 'desc')
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
          .where('cv.config_id', id)
          .orderBy('cv.version_number', 'desc');

        transformedConfig.versions = versions.map(this.transformConfigVersion);

        // Get rules
        const rules = await db('g_remote_config_rules as cr')
          .leftJoin('g_users as creator', 'cr.createdBy', 'creator.id')
          .select([
            'cr.*',
            'creator.name as createdByName'
          ])
          .where('cr.config_id', id)
          .where('cr.is_active', true)
          .orderBy('cr.priority', 'desc');

        transformedConfig.rules = rules.map(this.transformConfigRule);

        // Get variants
        const variants = await db('g_remote_config_variants as cv')
          .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
          .select([
            'cv.*',
            'creator.name as createdByName'
          ])
          .where('cv.config_id', id)
          .where('cv.is_active', true);

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
  static async findByKey(keyName: string): Promise<RemoteConfig | null> {
    try {
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
      const [insertId] = await db('g_remote_configs').insert({
        keyName: data.keyName,
        defaultValue: data.defaultValue || null,
        valueType: data.valueType,
        description: data.description || null,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || null
      });

      const created = await this.findById(insertId, false);
      if (!created) {
        throw new Error('Failed to retrieve created remote config');
      }

      // Create initial draft version
      await db('g_remote_config_versions').insert({
        configId: insertId,
        versionNumber: 1,
        value: data.defaultValue || null,
        status: 'draft',
        changeDescription: 'Initial version',
        createdBy: data.createdBy || null
      });

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
  static async update(id: number, data: UpdateRemoteConfigData): Promise<RemoteConfig> {
    try {
      const updateData: any = {};

      if (data.keyName !== undefined) updateData.keyName = data.keyName;
      if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue;
      if (data.valueType !== undefined) updateData.valueType = data.valueType;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      await db('g_remote_configs').where('id', id).update(updateData);

      const updated = await this.findById(id, false);
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
  static async delete(id: number): Promise<void> {
    try {
      await db('g_remote_configs').where('id', id).del();
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
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      isActive: Boolean(row.isActive),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName
    };
  }
}

export default RemoteConfigModel;

/**
 * Config Version Model for Git-like versioning
 */
export class ConfigVersionModel {
  /**
   * Get all versions for a config
   */
  static async getVersionsByConfigId(configId: number): Promise<ConfigVersion[]> {
    try {
      const versions = await db('g_remote_config_versions as cv')
        .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
        .select([
          'cv.*',
          'creator.name as createdByName'
        ])
        .where('cv.configId', configId)
        .orderBy('cv.versionNumber', 'desc');

      return versions.map(RemoteConfigModel['transformConfigVersion']);
    } catch (error) {
      logger.error('Error getting config versions:', error);
      throw error;
    }
  }

  /**
   * Get current published version
   */
  static async getCurrentVersion(configId: number): Promise<ConfigVersion | null> {
    try {
      const version = await db('g_remote_config_versions as cv')
        .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
        .select([
          'cv.*',
          'creator.name as createdByName'
        ])
        .where('cv.configId', configId)
        .where('cv.status', 'published')
        .orderBy('cv.versionNumber', 'desc')
        .first();

      return version ? RemoteConfigModel['transformConfigVersion'](version) : null;
    } catch (error) {
      logger.error('Error getting current version:', error);
      throw error;
    }
  }

  /**
   * Create new version
   */
  static async createVersion(data: CreateConfigVersionData): Promise<ConfigVersion> {
    try {
      // Get next version number
      const lastVersion = await db('g_remote_config_versions')
        .where('configId', data.configId)
        .orderBy('versionNumber', 'desc')
        .first();

      const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

      const [insertId] = await db('g_remote_config_versions').insert({
        configId: data.configId,
        versionNumber: nextVersionNumber,
        value: data.value || null,
        status: data.status || 'draft',
        changeDescription: data.changeDescription || null,
        createdBy: data.createdBy || null
      });

      const created = await db('g_remote_config_versions as cv')
        .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
        .select([
          'cv.*',
          'creator.name as createdByName'
        ])
        .where('cv.id', insertId)
        .first();

      if (!created) {
        throw new Error('Failed to retrieve created version');
      }

      logger.info(`Config version created: Config ${data.configId}, Version ${nextVersionNumber}`);
      return RemoteConfigModel['transformConfigVersion'](created);
    } catch (error) {
      logger.error('Error creating config version:', error);
      throw error;
    }
  }

  /**
   * Stage versions (Git-like staging)
   */
  static async stageVersions(configIds: number[], userId?: number): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        for (const configId of configIds) {
          // Get latest draft version
          const draftVersion = await trx('g_remote_config_versions')
            .where('configId', configId)
            .where('status', 'draft')
            .orderBy('versionNumber', 'desc')
            .first();

          if (draftVersion) {
            await trx('g_remote_config_versions')
              .where('id', draftVersion.id)
              .update({ status: 'staged' });
          }
        }
      });

      logger.info(`Staged versions for configs: ${configIds.join(', ')}`);
    } catch (error) {
      logger.error('Error staging versions:', error);
      throw error;
    }
  }

  /**
   * Publish staged versions
   */
  static async publishStagedVersions(userId?: number): Promise<number[]> {
    try {
      const publishedConfigIds: number[] = [];

      await db.transaction(async (trx) => {
        // Get all staged versions
        const stagedVersions = await trx('g_remote_config_versions')
          .where('status', 'staged')
          .orderBy('configId');

        for (const version of stagedVersions) {
          // Archive current published version
          await trx('g_remote_config_versions')
            .where('configId', version.configId)
            .where('status', 'published')
            .update({ status: 'archived' });

          // Publish staged version
          await trx('g_remote_config_versions')
            .where('id', version.id)
            .update({
              status: 'published',
              publishedAt: new Date()
            });

          publishedConfigIds.push(version.configId);
        }
      });

      logger.info(`Published versions for configs: ${publishedConfigIds.join(', ')}`);
      return publishedConfigIds;
    } catch (error) {
      logger.error('Error publishing staged versions:', error);
      throw error;
    }
  }
}
