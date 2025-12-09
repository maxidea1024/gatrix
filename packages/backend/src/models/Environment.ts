import { Model } from 'objection';
import { User } from './User';
import { ulid } from 'ulid';

// Environment type classification
export type EnvironmentType = 'development' | 'staging' | 'production';

// System-defined environment names that cannot be deleted or modified
export const SYSTEM_DEFINED_ENVIRONMENTS = ['development', 'qa', 'production'] as const;
export type SystemDefinedEnvironment = typeof SYSTEM_DEFINED_ENVIRONMENTS[number];

export interface EnvironmentData {
  id?: string; // ULID (26 characters)
  environmentName: string;
  displayName: string;
  description?: string;
  environmentType: EnvironmentType;
  isSystemDefined: boolean;
  displayOrder: number;
  color: string;
  projectId?: string; // ULID
  isDefault: boolean;
  requiresApproval: boolean;
  requiredApprovers: number;
  createdBy: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Environment extends Model implements EnvironmentData {
  static tableName = 'g_environments';

  id!: string; // ULID
  environmentName!: string;
  displayName!: string;
  description?: string;
  environmentType!: EnvironmentType;
  isSystemDefined!: boolean;
  displayOrder!: number;
  color!: string;
  projectId?: string; // ULID
  isDefault!: boolean;
  requiresApproval!: boolean;
  requiredApprovers!: number;
  createdBy!: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  creator?: User;
  updater?: User;
  project?: any; // Will be typed after Project model is created

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['environmentName', 'displayName', 'createdBy'],
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 127 }, // Format: {environmentName}.{ulid}
        environmentName: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-z0-9_-]+$' // Only lowercase, numbers, underscore, hyphen
        },
        displayName: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: ['string', 'null'], maxLength: 1000 },
        environmentType: { type: 'string', enum: ['development', 'staging', 'production'] },
        isSystemDefined: { type: 'boolean' },
        displayOrder: { type: 'integer', minimum: 0 },
        color: { type: 'string', maxLength: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
        projectId: { type: ['string', 'null'], minLength: 26, maxLength: 26 }, // ULID
        isDefault: { type: 'boolean' },
        requiresApproval: { type: 'boolean' },
        requiredApprovers: { type: 'integer', minimum: 1, maximum: 10 },
        createdBy: { type: 'integer' },
        updatedBy: { type: ['integer', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    const { Project } = require('./Project');
    return {
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_environments.createdBy',
          to: 'g_users.id'
        }
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_environments.updatedBy',
          to: 'g_users.id'
        }
      },
      project: {
        relation: Model.BelongsToOneRelation,
        modelClass: Project,
        join: {
          from: 'g_environments.projectId',
          to: 'g_projects.id'
        }
      }
    };
  }

  $beforeInsert() {
    if (!this.id) {
      // Generate ID in format: {environmentName}.{ulid}
      this.id = `${this.environmentName}.${ulid()}`;
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  /**
   * Get default environment
   */
  static async getDefault(): Promise<Environment | undefined> {
    return await this.query().where('isDefault', true).first();
  }

  /**
   * Get environment by name
   */
  static async getByName(environmentName: string): Promise<Environment | undefined> {
    return await this.query().where('environmentName', environmentName).first();
  }

  /**
   * Get all active environments ordered by displayOrder
   */
  static async getAll(): Promise<Environment[]> {
    return await this.query().orderBy('displayOrder', 'asc').orderBy('environmentName');
  }

  /**
   * Get all environments by project
   */
  static async getByProject(projectId: string): Promise<Environment[]> {
    return await this.query()
      .where('projectId', projectId)
      .orderBy('displayOrder', 'asc');
  }

  /**
   * Check if environment is system-defined
   */
  isSystemEnvironment(): boolean {
    return this.isSystemDefined;
  }

  /**
   * Check if environment requires approval
   */
  needsApproval(): boolean {
    return this.requiresApproval;
  }

  /**
   * Get required approvers count
   */
  getRequiredApprovers(): number {
    return this.requiredApprovers;
  }

  /**
   * Validate environment name format
   */
  static isValidEnvironmentName(name: string): boolean {
    return /^[a-z0-9_-]+$/.test(name) && name.length >= 1 && name.length <= 100;
  }

  /**
   * Create new environment
   */
  static async createEnvironment(data: Omit<EnvironmentData, 'id' | 'createdAt' | 'updatedAt'>): Promise<Environment> {
    // Validate environment name
    if (!this.isValidEnvironmentName(data.environmentName)) {
      throw new Error('Invalid environment name. Use only lowercase letters, numbers, underscore, and hyphen.');
    }

    // Check if environment already exists
    const existing = await this.getByName(data.environmentName);
    if (existing) {
      throw new Error(`Environment '${data.environmentName}' already exists`);
    }

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await this.query().patch({ isDefault: false });
    }

    return await this.query().insert(data);
  }

  /**
   * Update environment
   */
  async updateEnvironment(data: Partial<EnvironmentData>, updatedBy: number): Promise<Environment> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await Environment.query().patch({ isDefault: false });
    }

    return await this.$query().patchAndFetch({
      ...data,
      updatedBy,
      updatedAt: new Date()
    });
  }

  /**
   * Get related data counts for deletion check
   */
  async getRelatedDataDetails(): Promise<{
    templates: { count: number; items: Array<{ id: string; name: string }> };
    gameWorlds: { count: number; items: Array<{ id: string; worldId: string; name: string }> };
    segments: { count: number; items: Array<{ id: string; name: string }> };
    tags: { count: number; items: Array<{ id: string; name: string }> };
    vars: { count: number; items: Array<{ id: string; varKey: string }> };
    messageTemplates: { count: number; items: Array<{ id: string; name: string }> };
    serviceNotices: { count: number; items: Array<{ id: string; title: string }> };
    ingamePopups: { count: number; items: Array<{ id: string; description: string }> };
    surveys: { count: number; items: Array<{ id: string; surveyTitle: string }> };
    coupons: { count: number; items: Array<{ id: string; name: string }> };
    banners: { count: number; items: Array<{ bannerId: string; name: string }> };
    jobs: { count: number; items: Array<{ id: string; name: string }> };
    clientVersions: { count: number; items: Array<{ id: string; version: string; platform: string }> };
    apiTokens: { count: number; items: Array<{ id: string; name: string }> };
    total: number;
  }> {
    const { default: knex } = await import('../config/knex');
    const maxItems = 10; // Limit items for display

    // Helper function to safely get rows with environmentId column
    const safeQuery = async <T>(
      tableName: string,
      selectColumns: string[],
      modifyQuery?: (builder: any) => void
    ): Promise<{ count: number; items: T[] }> => {
      try {
        // Check if table has environmentId column
        const columns = await knex.raw(`SHOW COLUMNS FROM ${tableName} LIKE 'environmentId'`);
        if (columns[0].length === 0) {
          return { count: 0, items: [] };
        }

        let query = knex(tableName).where('environmentId', this.id);
        if (modifyQuery) {
          modifyQuery(query);
        }

        // Clone query for count
        const countQuery = query.clone().count('* as count').first();
        const countResult = await countQuery;
        const count = Number(countResult?.count || 0);

        const items = count > 0
          ? await query.clone().select(selectColumns).limit(maxItems)
          : [];

        return { count, items: items as T[] };
      } catch {
        return { count: 0, items: [] };
      }
    };

    const [
      templates,
      gameWorlds,
      segments,
      tags,
      vars,
      messageTemplates,
      serviceNotices,
      ingamePopups,
      surveys,
      coupons,
      banners,
      jobs,
      clientVersions,
      apiTokenEnvs,
    ] = await Promise.all([
      safeQuery<{ id: string; name: string }>('g_remote_config_templates', ['id', 'name']),
      safeQuery<{ id: string; worldId: string; name: string }>('g_game_worlds', ['id', 'worldId', 'name']),
      safeQuery<{ id: string; name: string }>('g_remote_config_segments', ['id', 'name']),
      // Tags are global now, but if column exists we count, otherwise 0.
      // Since we just removed environmentId from tags in logic, safeQuery might fail or return 0 if column missing.
      // But typically safeQuery checks for column existence.
      // The user wants tags to be global, so getting "related data" for environment might not make sense for tags anymore.
      // However, for consistency, if column remains (rollback) it counts. 
      // If column is gone (migration applied), safeQuery returns 0.
      safeQuery<{ id: string; name: string }>('g_tags', ['id', 'name']),
      safeQuery<{ id: string; varKey: string }>('g_vars', ['id', 'varKey'], (qb) => {
        qb.where(function (this: any) {
          this.where('varKey', 'like', 'kv:%').orWhere('varKey', 'like', '$%');
        });
      }),
      safeQuery<{ id: string; name: string }>('g_message_templates', ['id', 'name']),
      safeQuery<{ id: string; title: string }>('g_service_notices', ['id', 'title']),
      safeQuery<{ id: string; description: string }>('g_ingame_popup_notices', ['id', 'description']),
      safeQuery<{ id: string; surveyTitle: string }>('g_surveys', ['id', 'surveyTitle']),
      safeQuery<{ id: string; name: string }>('g_coupon_settings', ['id', 'name']),
      safeQuery<{ bannerId: string; name: string }>('g_banners', ['bannerId', 'name']),
      safeQuery<{ id: string; name: string }>('g_jobs', ['id', 'name']),
      safeQuery<{ id: string; version: string; platform: string }>('g_client_versions', ['id', 'version', 'platform']),
      safeQuery<{ tokenId: string }>('g_api_access_token_environments', ['tokenId']),
    ]);

    // For API tokens, we need to get the token names
    let apiTokens: { count: number; items: Array<{ id: string; name: string }> } = { count: 0, items: [] };
    if (apiTokenEnvs.count > 0) {
      const tokenIds = apiTokenEnvs.items.map((item) => item.tokenId);
      const tokens = await knex('g_api_access_tokens')
        .whereIn('id', tokenIds)
        .select(['id', 'name'])
        .limit(maxItems);
      apiTokens = { count: apiTokenEnvs.count, items: tokens };
    }

    const result = {
      templates,
      gameWorlds,
      segments,
      tags,
      vars,
      messageTemplates,
      serviceNotices,
      ingamePopups,
      surveys,
      coupons,
      banners,
      jobs,
      clientVersions,
      apiTokens,
      total: 0,
    };

    result.total = templates.count + gameWorlds.count + segments.count + tags.count +
      vars.count + messageTemplates.count + serviceNotices.count + ingamePopups.count +
      surveys.count + coupons.count + banners.count + jobs.count + clientVersions.count + apiTokens.count;

    return result;
  }

  /**
   * Get related data counts only (for backward compatibility and delete check)
   */
  async getRelatedDataCounts(): Promise<{
    templates: number;
    gameWorlds: number;
    segments: number;
    tags: number;
    vars: number;
    messageTemplates: number;
    serviceNotices: number;
    ingamePopups: number;
    surveys: number;
    coupons: number;
    banners: number;
    jobs: number;
    clientVersions: number;
    apiTokens: number;
    total: number;
  }> {
    const details = await this.getRelatedDataDetails();
    return {
      templates: details.templates.count,
      gameWorlds: details.gameWorlds.count,
      segments: details.segments.count,
      tags: details.tags.count,
      vars: details.vars.count,
      messageTemplates: details.messageTemplates.count,
      serviceNotices: details.serviceNotices.count,
      ingamePopups: details.ingamePopups.count,
      surveys: details.surveys.count,
      coupons: details.coupons.count,
      banners: details.banners.count,
      jobs: details.jobs.count,
      clientVersions: details.clientVersions.count,
      apiTokens: details.apiTokens.count,
      total: details.total,
    };
  }

  /**
   * Delete environment (only if no data exists and not system-defined)
   * This will check all related tables before allowing deletion
   */
  async deleteEnvironment(force: boolean = false): Promise<void> {
    const { default: knex } = await import('../config/knex');

    // Cannot delete system-defined environments
    if (this.isSystemDefined) {
      throw new Error('CANNOT_DELETE_SYSTEM_ENVIRONMENT');
    }

    // Cannot delete default environment
    if (this.isDefault) {
      throw new Error('CANNOT_DELETE_DEFAULT_ENVIRONMENT');
    }

    // Get related data counts
    const relatedData = await this.getRelatedDataCounts();

    // If not forcing and there's related data, throw error with details
    if (!force && relatedData.total > 0) {
      const error = new Error('ENVIRONMENT_HAS_RELATED_DATA');
      (error as any).relatedData = relatedData;
      throw error;
    }

    // If force delete, remove all related data in correct order
    if (force && relatedData.total > 0) {
      // Delete in order to respect foreign key constraints
      // Note: g_api_access_token_environments has ON DELETE CASCADE so it's handled automatically
      const environmentId = this.id;

      // Helper to safely delete from a table if it has environmentId column
      const safeDelete = async (trx: any, tableName: string): Promise<void> => {
        try {
          const columns = await trx.raw(`SHOW COLUMNS FROM ${tableName} LIKE 'environmentId'`);
          if (columns[0].length > 0) {
            await trx(tableName).where('environmentId', environmentId).del();
          }
        } catch {
          // Table doesn't exist or other error, skip
        }
      };

      await knex.transaction(async (trx) => {
        // Delete remote config related data first (template versions depend on templates)
        try {
          await trx('g_remote_config_template_versions')
            .whereIn('templateId', trx('g_remote_config_templates').select('id').where('environmentId', environmentId))
            .del();
        } catch {
          // Template versions table might not exist
        }

        await safeDelete(trx, 'g_remote_config_templates');
        await safeDelete(trx, 'g_remote_config_segments');

        // Delete other environment-scoped data
        await safeDelete(trx, 'g_game_worlds');
        await safeDelete(trx, 'g_tags');
        await safeDelete(trx, 'g_vars');
        await safeDelete(trx, 'g_message_templates');
        await safeDelete(trx, 'g_service_notices');
        await safeDelete(trx, 'g_ingame_popup_notices');
        await safeDelete(trx, 'g_surveys');
        await safeDelete(trx, 'g_coupons');
        await safeDelete(trx, 'g_banners');
        await safeDelete(trx, 'g_jobs');
        await safeDelete(trx, 'g_client_versions');

        // Finally delete the environment itself
        await trx('g_environments').where('id', environmentId).del();
      });
    } else {
      // No related data, just delete
      await this.$query().delete();
    }
  }

  /**
   * Get environment statistics
   */
  async getStats(): Promise<{
    templateCount: number;
    publishedTemplates: number;
    pendingApprovals: number;
  }> {
    const { RemoteConfigTemplate } = require('./RemoteConfigTemplate');

    const templateStats = await RemoteConfigTemplate.query()
      .where('environmentId', this.id)
      .select('status')
      .groupBy('status')
      .count('* as count');

    const totalTemplates = templateStats.reduce((sum: number, stat: any) => sum + parseInt(stat.count as string), 0);
    const publishedTemplates = templateStats.find((stat: any) => stat.status === 'published')?.count || 0;

    return {
      templateCount: totalTemplates,
      publishedTemplates: parseInt(publishedTemplates as string),
      pendingApprovals: 0 // Change requests are not environment-specific
    };
  }
}

export default Environment;
