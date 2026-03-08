import { Model } from 'objection';
import { User } from './user';
import { ulid } from 'ulid';

// Environment type classification
export type EnvironmentType = 'development' | 'staging' | 'production';

export interface EnvironmentData {
  name: string;
  displayName: string;
  description?: string;
  environmentType: EnvironmentType;
  isSystemDefined: boolean;
  isHidden: boolean;
  displayOrder: number;
  color: string;
  projectId: string; // ULID
  isDefault: boolean;
  requiresApproval: boolean;
  requiredApprovers: number;
  strictConflictCheck?: boolean; // CR version conflict check strictness
  enableSoftLock?: boolean; // Soft lock for concurrent editing
  enableHardLock?: boolean; // Hard lock warning for pending CRs
  createdBy: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Environment extends Model implements EnvironmentData {
  static tableName = 'g_environments';
  static idColumn = 'id';

  id!: string;

  name!: string;
  displayName!: string;
  description?: string;
  environmentType!: EnvironmentType;
  isSystemDefined!: boolean;
  isHidden!: boolean;
  displayOrder!: number;
  color!: string;
  projectId!: string; // ULID
  isDefault!: boolean;
  requiresApproval!: boolean;
  requiredApprovers!: number;
  strictConflictCheck?: boolean; // CR version conflict check strictness
  enableSoftLock?: boolean; // Soft lock for concurrent editing
  enableHardLock?: boolean; // Hard lock warning for pending CRs
  createdBy!: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  creator?: User;
  updater?: User;
  project?: any;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name', 'displayName'],

      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-z0-9_-]+$',
        },
        displayName: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: ['string', 'null'], maxLength: 1000 },
        environmentType: {
          type: 'string',
          enum: ['development', 'staging', 'production'],
        },
        isSystemDefined: { type: 'boolean' },
        isHidden: { type: 'boolean' },
        displayOrder: { type: 'integer', minimum: 0 },
        color: { type: 'string', maxLength: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
        projectId: { type: 'string', minLength: 26, maxLength: 26 }, // ULID
        isDefault: { type: 'boolean' },
        requiresApproval: { type: 'boolean' },
        requiredApprovers: { type: 'integer', minimum: 1, maximum: 10 },
        strictConflictCheck: { type: 'boolean' },
        enableSoftLock: { type: 'boolean' },
        enableHardLock: { type: 'boolean' },
        createdBy: { type: 'string' },
        updatedBy: { type: ['string', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    const { Project } = require('./project');
    return {
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_environments.createdBy',
          to: 'g_users.id',
        },
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_environments.updatedBy',
          to: 'g_users.id',
        },
      },
      project: {
        relation: Model.BelongsToOneRelation,
        modelClass: Project,
        join: {
          from: 'g_environments.projectId',
          to: 'g_projects.id',
        },
      },
    };
  }

  $beforeInsert() {
    if (!this.id) {
      this.id = ulid();
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  /**
   * Get default environment
   * @deprecated Use explicit environment instead
   */
  static async getDefault(): Promise<Environment | undefined> {
    return await this.query().where('isDefault', true).first();
  }

  /**
   * Get environment by ID (ULID)
   */
  static async getById(id: string): Promise<Environment | undefined> {
    return await this.query().findById(id);
  }

  /**
   * Get environment by name within a project
   */
  static async getByName(projectId: string, name: string): Promise<Environment | undefined> {
    return await this.query().where('projectId', projectId).where('name', name).first();
  }

  /**
   * Resolve environment by full path: orgName → projectName → envName
   * Accepts names or IDs for each level of the hierarchy.
   */
  static async getByFullPath(
    orgNameOrId: string,
    projectNameOrId: string,
    envNameOrId: string
  ): Promise<Environment | undefined> {
    const { default: knex } = await import('../config/knex');
    const row = await knex('g_environments as e')
      .join('g_projects as p', 'e.projectId', 'p.id')
      .join('g_organisations as o', 'p.orgId', 'o.id')
      .where(function () {
        this.where('o.orgName', orgNameOrId).orWhere('o.id', orgNameOrId);
      })
      .where(function () {
        this.where('p.projectName', projectNameOrId).orWhere('p.id', projectNameOrId);
      })
      .where(function () {
        this.where('e.name', envNameOrId).orWhere('e.id', envNameOrId);
      })
      .select('e.*')
      .first();
    return row ? (Environment.fromJson(row) as Environment) : undefined;
  }

  /**
   * Get all active environments ordered by displayOrder (excluding hidden ones by default)
   */
  static async getAll(includeHidden: boolean = false): Promise<Environment[]> {
    const query = this.query().orderBy('displayOrder', 'asc').orderBy('displayName');

    if (!includeHidden) {
      query.where('isHidden', false);
    }

    return await query;
  }

  /**
   * Get all environments by project
   */
  static async getByProject(projectId: string): Promise<Environment[]> {
    return await this.query().where('projectId', projectId).orderBy('displayOrder', 'asc');
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
    if (!name || typeof name !== 'string') return false;
    return /^[a-z0-9_-]+$/.test(name) && name.length >= 1 && name.length <= 100;
  }

  /**
   * Create new environment
   */
  static async createEnvironment(
    data: Omit<EnvironmentData, 'createdAt' | 'updatedAt'>
  ): Promise<Environment> {
    // Check if environment with same name already exists in same project
    const existingName = await this.query()
      .where('name', data.name)
      .where('projectId', data.projectId)
      .first();
    if (existingName) {
      throw new Error(`Environment with name '${data.name}' already exists`);
    }

    // Also check displayName uniqueness within project
    const existingDisplay = await this.query()
      .where('displayName', data.displayName)
      .where('projectId', data.projectId)
      .first();
    if (existingDisplay) {
      throw new Error(`Environment '${data.displayName}' already exists`);
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
  async updateEnvironment(data: Partial<EnvironmentData>, updatedBy: string): Promise<Environment> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await Environment.query().patch({ isDefault: false });
    }

    return await this.$query().patchAndFetch({
      ...data,
      updatedBy,
    });
  }

  /**
   * Get related data counts for deletion check
   */
  async getRelatedDataDetails(): Promise<{
    gameWorlds: {
      count: number;
      items: Array<{ id: string; worldId: string; name: string }>;
    };
    clientVersions: {
      count: number;
      items: Array<{ id: string; clientVersion: string; platform: string }>;
    };
    accountWhitelist: { count: number; items: Array<{ id: string; accountId: string }> };
    ipWhitelist: { count: number; items: Array<{ id: string; ipAddress: string }> };
    vars: { count: number; items: Array<{ id: string; varKey: string }> };
    featureFlags: { count: number; items: Array<{ id: string; flagId: string }> };
    featureStrategies: { count: number; items: Array<{ id: string; strategyName: string }> };
    featureVariants: { count: number; items: Array<{ id: string; variantName: string }> };
    featureSegments: { count: number; items: Array<{ id: string; segmentName: string }> };
    featureMetrics: { count: number; items: Array<{ id: string; flagName: string }> };
    featureVariantMetrics: { count: number; items: Array<{ id: string; flagName: string }> };
    featureNetworkTraffic: { count: number; items: Array<{ id: string; appName: string }> };
    unknownFlags: { count: number; items: Array<{ id: string; flagName: string }> };
    changeRequests: { count: number; items: Array<{ id: string; title: string }> };
    entityLocks: { count: number; items: Array<{ id: string; entityType: string }> };
    messageTemplates: {
      count: number;
      items: Array<{ id: string; name: string }>;
    };
    jobTypes: { count: number; items: Array<{ id: string; name: string }> };
    jobs: { count: number; items: Array<{ id: string; name: string }> };
    serviceNotices: {
      count: number;
      items: Array<{ id: string; title: string }>;
    };
    ingamePopups: {
      count: number;
      items: Array<{ id: string; description: string }>;
    };
    surveys: {
      count: number;
      items: Array<{ id: string; surveyTitle: string }>;
    };
    crashes: { count: number; items: Array<{ id: string; branch: string }> };
    crashEvents: { count: number; items: Array<{ id: string; platform: string }> };
    rewardItemTemplates: { count: number; items: Array<{ id: string; name: string }> };
    rewardTemplates: { count: number; items: Array<{ id: string; name: string }> };
    couponSettings: { count: number; items: Array<{ id: string; name: string }> };
    coupons: { count: number; items: Array<{ id: string; code: string }> };
    storeProducts: {
      count: number;
      items: Array<{ id: string; productId: string; productName: string }>;
    };
    banners: {
      count: number;
      items: Array<{ id: string; name: string }>;
    };
    apiTokens: { count: number; items: Array<{ id: string; name: string }> };
    serverLifecycleEvents: { count: number; items: Array<{ id: string; eventType: string }> };
    userEnvironments: { count: number; items: Array<{ id: string; userId: string }> };
    auditLogs: { count: number; items: Array<{ id: string; action: string }> };
    total: number;
  }> {
    const { default: knex } = await import('../config/knex');
    const maxItems = 10; // Limit items for display

    // Helper function to safely get rows with environment column
    const safeQuery = async <T>(
      tableName: string,
      selectColumns: string[],
      modifyQuery?: (builder: any) => void
    ): Promise<{ count: number; items: T[] }> => {
      try {
        // Check if table has environment column
        const columns = await knex.raw(`SHOW COLUMNS FROM ${tableName} LIKE 'environmentId'`);
        if (columns[0].length === 0) {
          return { count: 0, items: [] };
        }

        const query = knex(tableName).where('environmentId', this.id);
        if (modifyQuery) {
          modifyQuery(query);
        }

        // Clone query for count
        const countQuery = query.clone().count('* as count').first();
        const countResult = await countQuery;
        const count = Number(countResult?.count || 0);

        const items = count > 0 ? await query.clone().select(selectColumns).limit(maxItems) : [];

        return { count, items: items as T[] };
      } catch {
        return { count: 0, items: [] };
      }
    };

    const [
      gameWorlds,
      clientVersions,
      accountWhitelist,
      ipWhitelist,
      vars,
      featureFlags,
      featureStrategies,
      featureVariants,
      featureSegments,
      featureMetrics,
      featureVariantMetrics,
      featureNetworkTraffic,
      unknownFlags,
      changeRequests,
      entityLocks,
      messageTemplates,
      jobTypes,
      jobs,
      serviceNotices,
      ingamePopups,
      surveys,
      crashes,
      crashEvents,
      rewardItemTemplates,
      rewardTemplates,
      couponSettings,
      coupons,
      storeProducts,
      banners,
      apiTokenEnvs,
      serverLifecycleEvents,
      userEnvironments,
      auditLogs,
    ] = await Promise.all([
      safeQuery<{ id: string; worldId: string; name: string }>('g_game_worlds', [
        'id',
        'worldId',
        'name',
      ]),
      safeQuery<{ id: string; clientVersion: string; platform: string }>('g_client_versions', [
        'id',
        'clientVersion',
        'platform',
      ]),
      safeQuery<{ id: string; accountId: string }>('g_account_whitelist', ['id', 'accountId']),
      safeQuery<{ id: string; ipAddress: string }>('g_ip_whitelist', ['id', 'ipAddress']),
      safeQuery<{ id: string; varKey: string }>('g_vars', ['id', 'varKey'], (qb) => {
        qb.where(function (this: any) {
          this.where('varKey', 'like', 'kv:%').orWhere('varKey', 'like', '$%');
        });
      }),
      safeQuery<{ id: string; flagId: string }>('g_feature_flag_environments', ['id', 'flagId']),
      safeQuery<{ id: string; strategyName: string }>('g_feature_strategies', [
        'id',
        'strategyName',
      ]),
      safeQuery<{ id: string; variantName: string }>('g_feature_variants', ['id', 'variantName']),
      safeQuery<{ id: string; segmentName: string }>('g_feature_segments', ['id', 'segmentName']),
      safeQuery<{ id: string; flagName: string }>('g_feature_metrics', ['id', 'flagName']),
      safeQuery<{ id: string; flagName: string }>('g_feature_variant_metrics', ['id', 'flagName']),
      safeQuery<{ id: string; appName: string }>('g_feature_network_traffic', ['id', 'appName']),
      safeQuery<{ id: string; flagName: string }>('g_unknown_flags', ['id', 'flagName']),
      safeQuery<{ id: string; title: string }>('g_change_requests', ['id', 'title']),
      safeQuery<{ id: string; entityType: string }>('g_entity_locks', ['id', 'entityType']),
      safeQuery<{ id: string; name: string }>('g_message_templates', ['id', 'name']),
      safeQuery<{ id: string; name: string }>('g_job_types', ['id', 'name']),
      safeQuery<{ id: string; name: string }>('g_jobs', ['id', 'name']),
      safeQuery<{ id: string; title: string }>('g_service_notices', ['id', 'title']),
      safeQuery<{ id: string; description: string }>('g_ingame_popup_notices', [
        'id',
        'description',
      ]),
      safeQuery<{ id: string; surveyTitle: string }>('g_surveys', ['id', 'surveyTitle']),
      safeQuery<{ id: string; branch: string }>('g_crashes', ['id', 'branch']),
      safeQuery<{ id: string; platform: string }>('g_crash_events', ['id', 'platform']),
      safeQuery<{ id: string; name: string }>('g_reward_item_templates', ['id', 'name']),
      safeQuery<{ id: string; name: string }>('g_reward_templates', ['id', 'name']),
      safeQuery<{ id: string; name: string }>('g_coupon_settings', ['id', 'name']),
      safeQuery<{ id: string; code: string }>('g_coupons', ['id', 'code']),
      safeQuery<{ id: string; productId: string; productName: string }>(
        'g_store_products',
        ['id', 'productId', 'productName'],
        (qb) => {
          qb.where('isActive', true);
        }
      ),
      safeQuery<{ id: string; name: string }>('g_banners', ['id', 'name']),
      safeQuery<{ id: string; tokenName: string }>('g_api_access_tokens', ['id', 'tokenName']),
      safeQuery<{ id: string; eventType: string }>('g_server_lifecycle_events', [
        'id',
        'eventType',
      ]),
      safeQuery<{ id: string; userId: string }>('g_user_environments', ['id', 'userId']),
      safeQuery<{ id: string; action: string }>('g_audit_logs', ['id', 'action']),
    ]);

    // API tokens now have direct environmentId column
    const apiTokens = {
      count: apiTokenEnvs.count,
      items: apiTokenEnvs.items.map((t: any) => ({ id: t.id, name: t.tokenName })),
    };

    const result = {
      gameWorlds,
      clientVersions,
      accountWhitelist,
      ipWhitelist,
      vars,
      featureFlags,
      featureStrategies,
      featureVariants,
      featureSegments,
      featureMetrics,
      featureVariantMetrics,
      featureNetworkTraffic,
      unknownFlags,
      changeRequests,
      entityLocks,
      messageTemplates,
      jobTypes,
      jobs,
      serviceNotices,
      ingamePopups,
      surveys,
      crashes,
      crashEvents,
      rewardItemTemplates,
      rewardTemplates,
      couponSettings,
      coupons,
      storeProducts,
      banners,
      apiTokens,
      serverLifecycleEvents,
      userEnvironments,
      auditLogs,
      total: 0,
    };

    result.total =
      gameWorlds.count +
      clientVersions.count +
      accountWhitelist.count +
      ipWhitelist.count +
      vars.count +
      featureFlags.count +
      featureStrategies.count +
      featureVariants.count +
      featureSegments.count +
      featureMetrics.count +
      featureVariantMetrics.count +
      featureNetworkTraffic.count +
      unknownFlags.count +
      changeRequests.count +
      entityLocks.count +
      messageTemplates.count +
      jobTypes.count +
      jobs.count +
      serviceNotices.count +
      ingamePopups.count +
      surveys.count +
      crashes.count +
      crashEvents.count +
      rewardItemTemplates.count +
      rewardTemplates.count +
      couponSettings.count +
      coupons.count +
      storeProducts.count +
      banners.count +
      apiTokens.count +
      serverLifecycleEvents.count +
      userEnvironments.count +
      auditLogs.count;

    return result;
  }

  /**
   * Get related data counts only
   */
  async getRelatedDataCounts(): Promise<{
    gameWorlds: number;
    clientVersions: number;
    accountWhitelist: number;
    ipWhitelist: number;
    vars: number;
    featureFlags: number;
    featureStrategies: number;
    featureVariants: number;
    featureSegments: number;
    featureMetrics: number;
    featureVariantMetrics: number;
    featureNetworkTraffic: number;
    unknownFlags: number;
    changeRequests: number;
    entityLocks: number;
    messageTemplates: number;
    jobTypes: number;
    jobs: number;
    serviceNotices: number;
    ingamePopups: number;
    surveys: number;
    crashes: number;
    crashEvents: number;
    rewardItemTemplates: number;
    rewardTemplates: number;
    couponSettings: number;
    coupons: number;
    storeProducts: number;
    banners: number;
    apiTokens: number;
    serverLifecycleEvents: number;
    userEnvironments: number;
    auditLogs: number;
    total: number;
  }> {
    const details = await this.getRelatedDataDetails();
    return {
      gameWorlds: details.gameWorlds.count,
      clientVersions: details.clientVersions.count,
      accountWhitelist: details.accountWhitelist.count,
      ipWhitelist: details.ipWhitelist.count,
      vars: details.vars.count,
      featureFlags: details.featureFlags.count,
      featureStrategies: details.featureStrategies.count,
      featureVariants: details.featureVariants.count,
      featureSegments: details.featureSegments.count,
      featureMetrics: details.featureMetrics.count,
      featureVariantMetrics: details.featureVariantMetrics.count,
      featureNetworkTraffic: details.featureNetworkTraffic.count,
      unknownFlags: details.unknownFlags.count,
      changeRequests: details.changeRequests.count,
      entityLocks: details.entityLocks.count,
      messageTemplates: details.messageTemplates.count,
      jobTypes: details.jobTypes.count,
      jobs: details.jobs.count,
      serviceNotices: details.serviceNotices.count,
      ingamePopups: details.ingamePopups.count,
      surveys: details.surveys.count,
      crashes: details.crashes.count,
      crashEvents: details.crashEvents.count,
      rewardItemTemplates: details.rewardItemTemplates.count,
      rewardTemplates: details.rewardTemplates.count,
      couponSettings: details.couponSettings.count,
      coupons: details.coupons.count,
      storeProducts: details.storeProducts.count,
      banners: details.banners.count,
      apiTokens: details.apiTokens.count,
      serverLifecycleEvents: details.serverLifecycleEvents.count,
      userEnvironments: details.userEnvironments.count,
      auditLogs: details.auditLogs.count,
      total: details.total,
    };
  }

  /**
   * Delete environment (only if no data exists and not system-defined)
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
      const environment = this.id;

      // Helper to safely delete from a table if it has environment column
      const safeDelete = async (trx: any, tableName: string): Promise<void> => {
        try {
          const columns = await trx.raw(`SHOW COLUMNS FROM ${tableName} LIKE 'environmentId'`);
          if (columns[0].length > 0) {
            await trx(tableName).where('environmentId', environment).del();
          }
        } catch {
          // Table doesn't exist or other error, skip
        }
      };

      await knex.transaction(async (trx) => {
        // Delete other environment-scoped data
        await safeDelete(trx, 'g_audit_logs');
        await safeDelete(trx, 'g_game_worlds');
        await safeDelete(trx, 'g_client_versions');
        await safeDelete(trx, 'g_account_whitelist');
        await safeDelete(trx, 'g_ip_whitelist');
        await safeDelete(trx, 'g_vars');
        await safeDelete(trx, 'g_feature_flag_environments');
        await safeDelete(trx, 'g_feature_strategies');
        await safeDelete(trx, 'g_feature_variants');
        await safeDelete(trx, 'g_feature_segments');
        await safeDelete(trx, 'g_feature_metrics');
        await safeDelete(trx, 'g_feature_variant_metrics');
        await safeDelete(trx, 'g_feature_network_traffic');
        await safeDelete(trx, 'g_unknown_flags');
        await safeDelete(trx, 'g_change_requests');
        await safeDelete(trx, 'g_entity_locks');
        await safeDelete(trx, 'g_message_templates');
        await safeDelete(trx, 'g_job_types');
        await safeDelete(trx, 'g_jobs');
        await safeDelete(trx, 'g_service_notices');
        await safeDelete(trx, 'g_ingame_popup_notices');
        await safeDelete(trx, 'g_surveys');
        await safeDelete(trx, 'g_crashes');
        await safeDelete(trx, 'g_crash_events');
        await safeDelete(trx, 'g_reward_item_templates');
        await safeDelete(trx, 'g_reward_templates');
        await safeDelete(trx, 'g_coupon_settings');
        await safeDelete(trx, 'g_coupons');
        await safeDelete(trx, 'g_store_products');
        await safeDelete(trx, 'g_banners');
        await safeDelete(trx, 'g_api_access_tokens');
        await safeDelete(trx, 'g_server_lifecycle_events');
        await safeDelete(trx, 'g_user_environments');
        await safeDelete(trx, 'g_tags');

        // Finally delete the environment itself
        await trx('g_environments').where('id', environment).del();
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
    // Note: Remote config templates removed - will be reimplemented with new system
    return {
      templateCount: 0,
      publishedTemplates: 0,
      pendingApprovals: 0,
    };
  }
}

export default Environment;
