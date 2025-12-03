import { Model } from 'objection';
import { User } from './User';

// Environment type classification
export type EnvironmentType = 'development' | 'staging' | 'production';

// System-defined environment names that cannot be deleted or modified
export const SYSTEM_DEFINED_ENVIRONMENTS = ['development', 'qa', 'production'] as const;
export type SystemDefinedEnvironment = typeof SYSTEM_DEFINED_ENVIRONMENTS[number];

export interface RemoteConfigEnvironmentData {
  id?: number;
  environmentName: string;
  displayName: string;
  description?: string;
  environmentType: EnvironmentType;
  isSystemDefined: boolean;
  displayOrder: number;
  color: string;
  projectId?: number;
  isDefault: boolean;
  requiresApproval: boolean;
  requiredApprovers: number;
  createdBy: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RemoteConfigEnvironment extends Model implements RemoteConfigEnvironmentData {
  static tableName = 'g_remote_config_environments';

  id!: number;
  environmentName!: string;
  displayName!: string;
  description?: string;
  environmentType!: EnvironmentType;
  isSystemDefined!: boolean;
  displayOrder!: number;
  color!: string;
  projectId?: number;
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
        id: { type: 'integer' },
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
        projectId: { type: ['integer', 'null'] },
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
          from: 'g_remote_config_environments.createdBy',
          to: 'g_users.id'
        }
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_environments.updatedBy',
          to: 'g_users.id'
        }
      },
      project: {
        relation: Model.BelongsToOneRelation,
        modelClass: Project,
        join: {
          from: 'g_remote_config_environments.projectId',
          to: 'g_projects.id'
        }
      }
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  /**
   * Get default environment
   */
  static async getDefault(): Promise<RemoteConfigEnvironment | undefined> {
    return await this.query().where('isDefault', true).first();
  }

  /**
   * Get environment by name
   */
  static async getByName(environmentName: string): Promise<RemoteConfigEnvironment | undefined> {
    return await this.query().where('environmentName', environmentName).first();
  }

  /**
   * Get all active environments ordered by displayOrder
   */
  static async getAll(): Promise<RemoteConfigEnvironment[]> {
    return await this.query().orderBy('displayOrder', 'asc').orderBy('environmentName');
  }

  /**
   * Get all environments by project
   */
  static async getByProject(projectId: number): Promise<RemoteConfigEnvironment[]> {
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
  static async createEnvironment(data: Omit<RemoteConfigEnvironmentData, 'id' | 'createdAt' | 'updatedAt'>): Promise<RemoteConfigEnvironment> {
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
  async updateEnvironment(data: Partial<RemoteConfigEnvironmentData>, updatedBy: number): Promise<RemoteConfigEnvironment> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await RemoteConfigEnvironment.query().patch({ isDefault: false });
    }

    return await this.$query().patchAndFetch({
      ...data,
      updatedBy,
      updatedAt: new Date()
    });
  }

  /**
   * Delete environment (only if no templates exist and not system-defined)
   */
  async deleteEnvironment(): Promise<void> {
    // Cannot delete system-defined environments
    if (this.isSystemDefined) {
      throw new Error('Cannot delete system-defined environment');
    }

    // Check if environment has templates
    const { RemoteConfigTemplate } = require('./RemoteConfigTemplate');
    const templateCount = await RemoteConfigTemplate.query()
      .where('environmentId', this.id)
      .resultSize();

    if (templateCount > 0) {
      throw new Error('Cannot delete environment with existing templates');
    }

    // Cannot delete default environment
    if (this.isDefault) {
      throw new Error('Cannot delete default environment');
    }

    await this.$query().delete();
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
    const { RemoteConfigChangeRequest } = require('./RemoteConfigChangeRequest');

    const [templateStats, pendingApprovals] = await Promise.all([
      RemoteConfigTemplate.query()
        .where('environmentId', this.id)
        .select('status')
        .groupBy('status')
        .count('* as count'),
      RemoteConfigChangeRequest.query()
        .where('environmentId', this.id)
        .where('status', 'pending')
        .resultSize()
    ]);

    const totalTemplates = templateStats.reduce((sum: number, stat: any) => sum + parseInt(stat.count as string), 0);
    const publishedTemplates = templateStats.find((stat: any) => stat.status === 'published')?.count || 0;

    return {
      templateCount: totalTemplates,
      publishedTemplates: parseInt(publishedTemplates as string),
      pendingApprovals
    };
  }
}

export default RemoteConfigEnvironment;
