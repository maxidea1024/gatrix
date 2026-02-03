import { Model } from 'objection';
import { User } from './User';
import { Environment } from './Environment';

export type ChangeRequestStatus =
  | 'draft'
  | 'open'
  | 'approved'
  | 'applied'
  | 'rejected'
  | 'conflict';
export type ChangeRequestPriority = 'low' | 'medium' | 'high' | 'critical';

export class ChangeRequest extends Model {
  static tableName = 'g_change_requests';

  id!: string;
  requesterId!: number;
  environment!: string;
  status!: ChangeRequestStatus;
  title!: string;
  description?: string;
  reason?: string;
  impactAnalysis?: string;
  priority!: ChangeRequestPriority;
  category!: string;
  type?: string;
  rejectedBy?: number;
  rejectedAt?: string;
  rejectionReason?: string;
  executedBy?: number;
  createdAt!: Date;
  updatedAt!: Date;

  // Relations
  requester?: User;
  rejector?: User;
  environmentModel?: Environment;
  changeItems?: any[];
  actionGroups?: any[];
  approvals?: any[];

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['requesterId', 'environment', 'title'],
      properties: {
        id: { type: 'string' },
        requesterId: { type: 'integer' },
        environment: { type: 'string' },
        status: {
          type: 'string',
          enum: ['draft', 'open', 'approved', 'applied', 'rejected', 'conflict'],
        },
        title: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: ['string', 'null'] },
        reason: { type: ['string', 'null'] },
        impactAnalysis: { type: ['string', 'null'] },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
        },
        category: { type: 'string', maxLength: 50 },
        type: { type: 'string' },
        rejectedBy: { type: ['integer', 'null'] },
        rejectedAt: { type: ['string', 'null'], format: 'date-time' },
        rejectionReason: { type: ['string', 'null'] },
        executedBy: { type: ['integer', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    // Lazy load to avoid circular dependencies
    const { ChangeItem } = require('./ChangeItem');
    const { ActionGroup } = require('./ActionGroup');
    const { Approval } = require('./Approval');

    return {
      executor: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_change_requests.executedBy',
          to: 'g_users.id',
        },
      },
      requester: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_change_requests.requesterId',
          to: 'g_users.id',
        },
      },
      rejector: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_change_requests.rejectedBy',
          to: 'g_users.id',
        },
      },
      environmentModel: {
        relation: Model.BelongsToOneRelation,
        modelClass: Environment,
        join: {
          from: 'g_change_requests.environment',
          to: 'g_environments.environment',
        },
      },
      changeItems: {
        relation: Model.HasManyRelation,
        modelClass: ChangeItem,
        join: {
          from: 'g_change_requests.id',
          to: 'g_change_items.changeRequestId',
        },
      },
      actionGroups: {
        relation: Model.HasManyRelation,
        modelClass: ActionGroup,
        join: {
          from: 'g_change_requests.id',
          to: 'g_action_groups.changeRequestId',
        },
      },
      approvals: {
        relation: Model.HasManyRelation,
        modelClass: Approval,
        join: {
          from: 'g_change_requests.id',
          to: 'g_approvals.changeRequestId',
        },
      },
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  $formatJson(json: any) {
    const formatted = super.$formatJson(json);
    // Convert Date objects to ISO strings for proper timezone handling
    if (formatted.createdAt instanceof Date) {
      formatted.createdAt = formatted.createdAt.toISOString();
    } else if (
      formatted.createdAt &&
      typeof formatted.createdAt === 'string' &&
      !formatted.createdAt.endsWith('Z')
    ) {
      // MySQL DATETIME format - append Z to indicate UTC
      formatted.createdAt = formatted.createdAt.replace(' ', 'T') + '.000Z';
    }
    if (formatted.updatedAt instanceof Date) {
      formatted.updatedAt = formatted.updatedAt.toISOString();
    } else if (
      formatted.updatedAt &&
      typeof formatted.updatedAt === 'string' &&
      !formatted.updatedAt.endsWith('Z')
    ) {
      formatted.updatedAt = formatted.updatedAt.replace(' ', 'T') + '.000Z';
    }
    if (formatted.rejectedAt instanceof Date) {
      formatted.rejectedAt = formatted.rejectedAt.toISOString();
    } else if (
      formatted.rejectedAt &&
      typeof formatted.rejectedAt === 'string' &&
      !formatted.rejectedAt.endsWith('Z')
    ) {
      formatted.rejectedAt = formatted.rejectedAt.replace(' ', 'T') + '.000Z';
    }
    return formatted;
  }
}
