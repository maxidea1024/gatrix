import { Model } from 'objection';
import { User } from './User';
import { RemoteConfigTemplate, TemplateData } from './RemoteConfigTemplate';
import { Environment } from './Environment';
import { pubSubService } from '../services/PubSubService';

export type ChangeRequestType = 'create' | 'update' | 'delete' | 'import';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface RemoteConfigChangeRequestData {
  id?: number;
  templateId: number;
  environmentId: string; // ULID
  requestType: ChangeRequestType;
  status: ChangeRequestStatus;
  proposedChanges: any;
  currentData?: any;
  description?: string;
  requestedBy: number;
  approvedBy?: number;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RemoteConfigChangeRequest extends Model implements RemoteConfigChangeRequestData {
  static tableName = 'g_remote_config_change_requests';

  id!: number;
  templateId!: number;
  environmentId!: string; // ULID
  requestType!: ChangeRequestType;
  status!: ChangeRequestStatus;
  proposedChanges!: any;
  currentData?: any;
  description?: string;
  requestedBy!: number;
  approvedBy?: number;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  template?: RemoteConfigTemplate;
  environment?: Environment;
  requester?: User;
  approver?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['templateId', 'environmentId', 'requestType', 'proposedChanges', 'requestedBy'],
      properties: {
        id: { type: 'integer' },
        templateId: { type: 'integer' },
        environmentId: { type: 'string', minLength: 26, maxLength: 26 }, // ULID
        requestType: { type: 'string', enum: ['create', 'update', 'delete', 'import'] },
        status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] },
        proposedChanges: { type: 'object' },
        currentData: { type: ['object', 'null'] },
        description: { type: ['string', 'null'], maxLength: 1000 },
        requestedBy: { type: 'integer' },
        approvedBy: { type: ['integer', 'null'] },
        approvedAt: { type: ['string', 'null'], format: 'date-time' },
        rejectionReason: { type: ['string', 'null'], maxLength: 1000 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      template: {
        relation: Model.BelongsToOneRelation,
        modelClass: RemoteConfigTemplate,
        join: {
          from: 'g_remote_config_change_requests.templateId',
          to: 'g_remote_config_templates.id'
        }
      },
      environment: {
        relation: Model.BelongsToOneRelation,
        modelClass: Environment,
        join: {
          from: 'g_remote_config_change_requests.environmentId',
          to: 'g_environments.id'
        }
      },
      requester: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_change_requests.requestedBy',
          to: 'g_users.id'
        }
      },
      approver: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_change_requests.approvedBy',
          to: 'g_users.id'
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
   * Create change request
   */
  static async createChangeRequest(data: Omit<RemoteConfigChangeRequestData, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<RemoteConfigChangeRequest> {
    // Check if environment requires approval
    const environment = await Environment.query().findById(data.environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }

    // If environment doesn't require approval, auto-approve
    const status = environment.requiresApproval ? 'pending' : 'approved';
    const approvedBy = environment.requiresApproval ? undefined : data.requestedBy;
    const approvedAt = environment.requiresApproval ? undefined : new Date();

    const changeRequest = await this.query().insert({
      ...data,
      status,
      approvedBy,
      approvedAt
    });

    // If auto-approved, apply changes immediately
    if (status === 'approved') {
      await changeRequest.applyChanges();
    }

    return changeRequest;
  }

  /**
   * Get pending requests for environment
   */
  static async getPendingForEnvironment(environmentId: number): Promise<RemoteConfigChangeRequest[]> {
    return await this.query()
      .where('environmentId', environmentId)
      .where('status', 'pending')
      .withGraphFetched('[template, requester(basicInfo)]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      })
      .orderBy('createdAt', 'asc');
  }

  /**
   * Get requests by status
   */
  static async getByStatus(status: ChangeRequestStatus, environmentId?: number): Promise<RemoteConfigChangeRequest[]> {
    let query = this.query().where('status', status);
    
    if (environmentId) {
      query = query.where('environmentId', environmentId);
    }

    return await query
      .withGraphFetched('[template, environment, requester(basicInfo), approver(basicInfo)]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      })
      .orderBy('createdAt', 'desc');
  }

  /**
   * Approve change request
   */
  async approve(approvedBy: number): Promise<RemoteConfigChangeRequest> {
    if (this.status !== 'pending') {
      throw new Error('Only pending requests can be approved');
    }

    // Update status
    const updatedRequest = await this.$query().patchAndFetch({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date()
    });

    // Apply changes
    await this.applyChanges();

    // Send notification
    await this.sendApprovalNotification('approved');

    return updatedRequest;
  }

  /**
   * Reject change request
   */
  async reject(rejectedBy: number, reason: string): Promise<RemoteConfigChangeRequest> {
    if (this.status !== 'pending') {
      throw new Error('Only pending requests can be rejected');
    }

    const updatedRequest = await this.$query().patchAndFetch({
      status: 'rejected',
      approvedBy: rejectedBy,
      rejectionReason: reason,
      updatedAt: new Date()
    });

    // Send notification
    await this.sendApprovalNotification('rejected');

    return updatedRequest;
  }

  /**
   * Cancel change request
   */
  async cancel(): Promise<RemoteConfigChangeRequest> {
    if (this.status !== 'pending') {
      throw new Error('Only pending requests can be cancelled');
    }

    return await this.$query().patchAndFetch({
      status: 'cancelled',
      updatedAt: new Date()
    });
  }

  /**
   * Apply approved changes to template
   */
  async applyChanges(): Promise<void> {
    if (this.status !== 'approved') {
      throw new Error('Only approved requests can be applied');
    }

    const template = await RemoteConfigTemplate.query().findById(this.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    switch (this.requestType) {
      case 'create':
        // Template should already be created, just publish it
        await template.publish(this.approvedBy!);
        break;

      case 'update':
        // Update template data
        await template.updateTemplate(
          this.proposedChanges,
          this.approvedBy!,
          this.description
        );
        break;

      case 'delete':
        // Archive template
        await template.archive(this.approvedBy!);
        break;

      case 'import':
        // Replace entire template data
        await template.updateTemplate(
          this.proposedChanges,
          this.approvedBy!,
          'Template imported'
        );
        break;
    }
  }

  /**
   * Send approval notification
   */
  async sendApprovalNotification(action: 'approved' | 'rejected'): Promise<void> {
    const notification = {
      type: 'remote_config_approval',
      data: {
        changeRequestId: this.id,
        action,
        templateId: this.templateId,
        environmentId: this.environmentId,
        requestType: this.requestType,
        approvedBy: this.approvedBy,
        rejectionReason: this.rejectionReason
      },
      targetChannels: ['remote_config_approvals', 'admin'],
      targetUsers: [this.requestedBy]
    };

    await pubSubService.publishNotification(notification);
  }

  /**
   * Get change summary
   */
  getChangeSummary(): any {
    switch (this.requestType) {
      case 'create':
        return {
          type: 'Template Creation',
          summary: `Create new template: ${this.proposedChanges.templateName || 'Unknown'}`
        };

      case 'update':
        const configChanges = this.getConfigChanges();
        return {
          type: 'Template Update',
          summary: `Update template with ${configChanges.totalChanges} changes`,
          details: configChanges
        };

      case 'delete':
        return {
          type: 'Template Deletion',
          summary: 'Archive template'
        };

      case 'import':
        return {
          type: 'Template Import',
          summary: 'Replace template with imported data'
        };

      default:
        return {
          type: 'Unknown',
          summary: 'Unknown change type'
        };
    }
  }

  /**
   * Get detailed config changes
   */
  getConfigChanges(): any {
    if (this.requestType !== 'update' || !this.currentData || !this.proposedChanges) {
      return { totalChanges: 0 };
    }

    const currentConfigs = this.currentData.configs || {};
    const proposedConfigs = this.proposedChanges.configs || {};

    const changes = {
      added: {} as any,
      modified: {} as any,
      deleted: {} as any,
      totalChanges: 0
    };

    // Find added configs
    for (const [key, config] of Object.entries(proposedConfigs)) {
      if (!currentConfigs[key]) {
        changes.added[key] = config;
        changes.totalChanges++;
      }
    }

    // Find deleted configs
    for (const [key, config] of Object.entries(currentConfigs)) {
      if (!proposedConfigs[key]) {
        changes.deleted[key] = config;
        changes.totalChanges++;
      }
    }

    // Find modified configs
    for (const [key, proposedConfig] of Object.entries(proposedConfigs)) {
      const currentConfig = currentConfigs[key];
      if (currentConfig && JSON.stringify(currentConfig) !== JSON.stringify(proposedConfig)) {
        changes.modified[key] = {
          old: currentConfig,
          new: proposedConfig
        };
        changes.totalChanges++;
      }
    }

    return changes;
  }

  /**
   * Check if request can be approved
   */
  canApprove(): boolean {
    return this.status === 'pending';
  }

  /**
   * Check if request can be rejected
   */
  canReject(): boolean {
    return this.status === 'pending';
  }

  /**
   * Check if request can be cancelled
   */
  canCancel(): boolean {
    return this.status === 'pending';
  }
}

export default RemoteConfigChangeRequest;
