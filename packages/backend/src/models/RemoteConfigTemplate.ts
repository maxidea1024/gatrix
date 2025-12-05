import { Model } from 'objection';
import { User } from './User';
import { Environment } from './Environment';
import crypto from 'crypto';

export type TemplateStatus = 'draft' | 'staged' | 'published' | 'archived';
export type TemplateType = 'server' | 'client';

export interface ConfigItem {
  type: 'string' | 'number' | 'boolean' | 'json' | 'yaml';
  defaultValue: any;
  description?: string;
  campaigns?: any[];
  variants?: any[];
}

export interface TemplateData {
  configs: Record<string, ConfigItem>;
  segments?: Record<string, any>;
  campaigns?: any[];
}

export interface RemoteConfigTemplateData {
  id?: number;
  environmentId: string; // ULID
  templateName: string;
  displayName: string;
  description?: string;
  templateType: TemplateType;
  status: TemplateStatus;
  version: number;
  templateData: TemplateData;
  metadata?: any;
  etag?: string;
  createdBy: number;
  updatedBy?: number;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RemoteConfigTemplate extends Model implements RemoteConfigTemplateData {
  static tableName = 'g_remote_config_templates';

  id!: number;
  environmentId!: string; // ULID
  templateName!: string;
  displayName!: string;
  description?: string;
  templateType!: TemplateType;
  status!: TemplateStatus;
  version!: number;
  templateData!: TemplateData;
  metadata?: any;
  etag?: string;
  createdBy!: number;
  updatedBy?: number;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  environment?: Environment;
  creator?: User;
  updater?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['environmentId', 'templateName', 'displayName', 'templateType', 'templateData', 'createdBy'],
      properties: {
        id: { type: 'integer' },
        environmentId: { type: 'integer' },
        templateName: { 
          type: 'string', 
          minLength: 1, 
          maxLength: 200,
          pattern: '^[a-z0-9_-]+$'
        },
        displayName: { type: 'string', minLength: 1, maxLength: 300 },
        description: { type: ['string', 'null'], maxLength: 1000 },
        templateType: { type: 'string', enum: ['server', 'client'] },
        status: { type: 'string', enum: ['draft', 'staged', 'published', 'archived'] },
        version: { type: 'integer', minimum: 1 },
        templateData: { type: 'object' },
        metadata: { type: ['object', 'null'] },
        etag: { type: ['string', 'null'] },
        createdBy: { type: 'integer' },
        updatedBy: { type: ['integer', 'null'] },
        publishedAt: { type: ['string', 'null'], format: 'date-time' },
        archivedAt: { type: ['string', 'null'], format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      environment: {
        relation: Model.BelongsToOneRelation,
        modelClass: Environment,
        join: {
          from: 'g_remote_config_templates.environmentId',
          to: 'g_environments.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_templates.createdBy',
          to: 'g_users.id'
        }
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_templates.updatedBy',
          to: 'g_users.id'
        }
      }
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.generateEtag();
    this.generateMetadata();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
    this.generateEtag();
    this.generateMetadata();
  }

  /**
   * Generate ETag for caching
   */
  generateEtag(): void {
    const content = JSON.stringify({
      templateData: this.templateData,
      version: this.version,
      updatedAt: this.updatedAt
    });
    this.etag = crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Generate metadata for performance
   */
  generateMetadata(): void {
    const configCount = Object.keys(this.templateData.configs || {}).length;
    const campaignCount = (this.templateData.campaigns || []).length;
    
    this.metadata = {
      configCount,
      campaignCount,
      lastModified: new Date().toISOString(),
      templateType: this.templateType,
      status: this.status
    };
  }

  /**
   * Get template by environment and name
   */
  static async getByEnvironmentAndName(environmentId: string, templateName: string): Promise<RemoteConfigTemplate | undefined> {
    return await this.query()
      .where('environmentId', environmentId)
      .where('templateName', templateName)
      .first();
  }

  /**
   * Get published templates for environment
   */
  static async getPublishedByEnvironment(environmentId: string, templateType?: TemplateType): Promise<RemoteConfigTemplate[]> {
    let query = this.query()
      .where('environmentId', environmentId)
      .where('status', 'published');
    
    if (templateType) {
      query = query.where('templateType', templateType);
    }
    
    return await query.orderBy('templateName');
  }

  /**
   * Get templates by status
   */
  static async getByStatus(environmentId: number, status: TemplateStatus): Promise<RemoteConfigTemplate[]> {
    return await this.query()
      .where('environmentId', environmentId)
      .where('status', status)
      .orderBy('updatedAt', 'desc');
  }

  /**
   * Create new template
   */
  static async createTemplate(data: Omit<RemoteConfigTemplateData, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<RemoteConfigTemplate> {
    // Validate template name
    if (!this.isValidTemplateName(data.templateName)) {
      throw new Error('Invalid template name. Use only lowercase letters, numbers, underscore, and hyphen.');
    }

    // Check if template already exists
    const existing = await this.getByEnvironmentAndName(data.environmentId, data.templateName);
    if (existing) {
      throw new Error(`Template '${data.templateName}' already exists in this environment`);
    }

    // Validate template data
    this.validateTemplateData(data.templateData);

    return await this.query().insert({
      ...data,
      version: 1,
      status: data.status || 'draft'
    });
  }

  /**
   * Update template
   */
  async updateTemplate(data: Partial<TemplateData>, updatedBy: number, changeDescription?: string): Promise<RemoteConfigTemplate> {
    // Validate template data if provided
    if (data) {
      RemoteConfigTemplate.validateTemplateData(data as TemplateData);
    }

    // Create version history
    await this.createVersion(changeDescription, updatedBy);

    // Update template
    return await this.$query().patchAndFetch({
      templateData: data as any,
      version: this.version + 1,
      updatedBy,
      updatedAt: new Date()
    });
  }

  /**
   * Publish template
   */
  async publish(publishedBy: number): Promise<RemoteConfigTemplate> {
    if (this.status === 'published') {
      throw new Error('Template is already published');
    }

    return await this.$query().patchAndFetch({
      status: 'published',
      publishedAt: new Date(),
      updatedBy: publishedBy,
      updatedAt: new Date()
    });
  }

  /**
   * Archive template
   */
  async archive(archivedBy: number): Promise<RemoteConfigTemplate> {
    return await this.$query().patchAndFetch({
      status: 'archived',
      archivedAt: new Date(),
      updatedBy: archivedBy,
      updatedAt: new Date()
    });
  }

  /**
   * Create version history
   */
  async createVersion(changeDescription?: string, createdBy?: number): Promise<void> {
    const { RemoteConfigTemplateVersion } = require('./RemoteConfigTemplateVersion');
    
    await RemoteConfigTemplateVersion.query().insert({
      templateId: this.id,
      version: this.version,
      templateData: this.templateData,
      metadata: this.metadata,
      changeDescription,
      createdBy: createdBy || this.updatedBy || this.createdBy
    });
  }

  /**
   * Validate template name
   */
  static isValidTemplateName(name: string): boolean {
    return /^[a-z0-9_-]+$/.test(name) && name.length >= 1 && name.length <= 200;
  }

  /**
   * Validate template data structure
   */
  static validateTemplateData(templateData: TemplateData): void {
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data must be an object');
    }

    if (!templateData.configs || typeof templateData.configs !== 'object') {
      throw new Error('Template data must contain configs object');
    }

    // Validate each config
    for (const [key, config] of Object.entries(templateData.configs)) {
      this.validateConfigItem(key, config);
    }
  }

  /**
   * Validate individual config item
   */
  static validateConfigItem(key: string, config: ConfigItem): void {
    const validTypes = ['string', 'number', 'boolean', 'json', 'yaml'];
    
    if (!validTypes.includes(config.type)) {
      throw new Error(`Invalid config type '${config.type}' for '${key}'. Must be one of: ${validTypes.join(', ')}`);
    }

    if (config.defaultValue === undefined) {
      throw new Error(`Config '${key}' must have a defaultValue`);
    }

    // Type-specific validation
    switch (config.type) {
      case 'string':
        if (typeof config.defaultValue !== 'string') {
          throw new Error(`Config '${key}' defaultValue must be a string`);
        }
        break;
      case 'number':
        if (typeof config.defaultValue !== 'number') {
          throw new Error(`Config '${key}' defaultValue must be a number`);
        }
        break;
      case 'boolean':
        if (typeof config.defaultValue !== 'boolean') {
          throw new Error(`Config '${key}' defaultValue must be a boolean`);
        }
        break;
      case 'json':
      case 'yaml':
        if (typeof config.defaultValue !== 'object') {
          throw new Error(`Config '${key}' defaultValue must be an object`);
        }
        break;
    }
  }

  /**
   * Get config value by key
   */
  getConfigValue(key: string): any {
    return this.templateData.configs[key]?.defaultValue;
  }

  /**
   * Check if template can be edited
   */
  canEdit(): boolean {
    return ['draft', 'staged'].includes(this.status);
  }

  /**
   * Check if template can be published
   */
  canPublish(): boolean {
    return ['draft', 'staged'].includes(this.status);
  }

  /**
   * Check if template can be archived
   */
  canArchive(): boolean {
    return this.status === 'published';
  }
}

export default RemoteConfigTemplate;
