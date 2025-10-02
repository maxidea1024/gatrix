import { Model } from 'objection';
import { User } from './User';
import { RemoteConfigTemplate, TemplateData } from './RemoteConfigTemplate';

export interface RemoteConfigTemplateVersionData {
  id?: number;
  templateId: number;
  version: number;
  templateData: TemplateData;
  metadata?: any;
  changeDescription?: string;
  createdBy: number;
  createdAt?: Date;
}

export class RemoteConfigTemplateVersion extends Model implements RemoteConfigTemplateVersionData {
  static tableName = 'g_remote_config_template_versions';

  id!: number;
  templateId!: number;
  version!: number;
  templateData!: TemplateData;
  metadata?: any;
  changeDescription?: string;
  createdBy!: number;
  createdAt?: Date;

  // Relations
  template?: RemoteConfigTemplate;
  creator?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['templateId', 'version', 'templateData', 'createdBy'],
      properties: {
        id: { type: 'integer' },
        templateId: { type: 'integer' },
        version: { type: 'integer', minimum: 1 },
        templateData: { type: 'object' },
        metadata: { type: ['object', 'null'] },
        changeDescription: { type: ['string', 'null'], maxLength: 500 },
        createdBy: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      template: {
        relation: Model.BelongsToOneRelation,
        modelClass: RemoteConfigTemplate,
        join: {
          from: 'g_remote_config_template_versions.templateId',
          to: 'g_remote_config_templates.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_template_versions.createdBy',
          to: 'g_users.id'
        }
      }
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
  }

  /**
   * Get versions for a template
   */
  static async getVersionsForTemplate(templateId: number, limit = 10): Promise<RemoteConfigTemplateVersion[]> {
    return await this.query()
      .where('templateId', templateId)
      .orderBy('version', 'desc')
      .limit(limit)
      .withGraphFetched('creator(basicInfo)')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      });
  }

  /**
   * Get specific version
   */
  static async getVersion(templateId: number, version: number): Promise<RemoteConfigTemplateVersion | undefined> {
    return await this.query()
      .where('templateId', templateId)
      .where('version', version)
      .withGraphFetched('creator(basicInfo)')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      })
      .first();
  }

  /**
   * Get latest version
   */
  static async getLatestVersion(templateId: number): Promise<RemoteConfigTemplateVersion | undefined> {
    return await this.query()
      .where('templateId', templateId)
      .orderBy('version', 'desc')
      .first();
  }

  /**
   * Compare two versions
   */
  static async compareVersions(templateId: number, fromVersion: number, toVersion: number): Promise<{
    from: RemoteConfigTemplateVersion | undefined;
    to: RemoteConfigTemplateVersion | undefined;
    diff: any;
  }> {
    const [from, to] = await Promise.all([
      this.getVersion(templateId, fromVersion),
      this.getVersion(templateId, toVersion)
    ]);

    const diff = this.generateDiff(from?.templateData, to?.templateData);

    return { from, to, diff };
  }

  /**
   * Generate diff between two template data objects
   */
  static generateDiff(oldData?: TemplateData, newData?: TemplateData): any {
    if (!oldData && !newData) return null;
    if (!oldData) return { type: 'created', data: newData };
    if (!newData) return { type: 'deleted', data: oldData };

    const diff: any = {
      type: 'modified',
      configs: {
        added: {},
        modified: {},
        deleted: {}
      }
    };

    const oldConfigs = oldData.configs || {};
    const newConfigs = newData.configs || {};

    // Find added configs
    for (const [key, config] of Object.entries(newConfigs)) {
      if (!oldConfigs[key]) {
        diff.configs.added[key] = config;
      }
    }

    // Find deleted configs
    for (const [key, config] of Object.entries(oldConfigs)) {
      if (!newConfigs[key]) {
        diff.configs.deleted[key] = config;
      }
    }

    // Find modified configs
    for (const [key, newConfig] of Object.entries(newConfigs)) {
      const oldConfig = oldConfigs[key];
      if (oldConfig && JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
        diff.configs.modified[key] = {
          old: oldConfig,
          new: newConfig
        };
      }
    }

    return diff;
  }

  /**
   * Create version from template
   */
  static async createFromTemplate(template: RemoteConfigTemplate, changeDescription?: string): Promise<RemoteConfigTemplateVersion> {
    return await this.query().insert({
      templateId: template.id,
      version: template.version,
      templateData: template.templateData,
      metadata: template.metadata,
      changeDescription,
      createdBy: template.updatedBy || template.createdBy
    });
  }

  /**
   * Restore template to this version
   */
  async restoreToTemplate(restoredBy: number): Promise<RemoteConfigTemplate> {
    const template = await RemoteConfigTemplate.query().findById(this.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Create new version before restoring
    await template.createVersion(`Restored to version ${this.version}`, restoredBy);

    // Update template with this version's data
    return await template.$query().patchAndFetch({
      templateData: this.templateData,
      version: template.version + 1,
      updatedBy: restoredBy,
      updatedAt: new Date()
    });
  }

  /**
   * Get version history summary
   */
  static async getVersionHistory(templateId: number): Promise<{
    totalVersions: number;
    versions: Array<{
      version: number;
      changeDescription?: string;
      createdBy: number;
      createdAt: Date;
      creator?: { id: number; username: string; email: string };
    }>;
  }> {
    const versions = await this.query()
      .where('templateId', templateId)
      .orderBy('version', 'desc')
      .withGraphFetched('creator(basicInfo)')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      });

    return {
      totalVersions: versions.length,
      versions: versions.map(v => ({
        version: v.version,
        changeDescription: v.changeDescription,
        createdBy: v.createdBy,
        createdAt: v.createdAt!,
        creator: v.creator ? {
          id: v.creator.id,
          username: v.creator.name || v.creator.email,
          email: v.creator.email
        } : undefined
      }))
    };
  }

  /**
   * Delete old versions (keep only recent ones)
   */
  static async cleanupOldVersions(templateId: number, keepCount = 10): Promise<number> {
    const versions = await this.query()
      .where('templateId', templateId)
      .orderBy('version', 'desc')
      .select('id', 'version');

    if (versions.length <= keepCount) {
      return 0;
    }

    const versionsToDelete = versions.slice(keepCount);
    const idsToDelete = versionsToDelete.map(v => v.id);

    await this.query().whereIn('id', idsToDelete).delete();
    
    return idsToDelete.length;
  }

  /**
   * Get config changes in this version
   */
  getConfigChanges(): any {
    if (!this.metadata?.configChanges) {
      return null;
    }
    return this.metadata.configChanges;
  }

  /**
   * Check if version has breaking changes
   */
  hasBreakingChanges(): boolean {
    const changes = this.getConfigChanges();
    if (!changes) return false;

    // Consider deleted configs or type changes as breaking
    return Object.keys(changes.deleted || {}).length > 0 ||
           Object.values(changes.modified || {}).some((change: any) => 
             change.old?.type !== change.new?.type
           );
  }
}

export default RemoteConfigTemplateVersion;
