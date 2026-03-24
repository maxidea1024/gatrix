import { Model } from 'objection';
import { User } from './user';
import { ChangeRequest } from './change-request';

export class Approval extends Model {
  static tableName = 'g_approvals';

  id!: string;
  changeRequestId!: string;
  approverId!: string;
  comment?: string;
  createdAt!: Date;

  // Relations
  changeRequest?: ChangeRequest;
  approver?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['changeRequestId', 'approverId'],
      properties: {
        id: { type: 'string' },
        changeRequestId: { type: 'string' },
        approverId: { type: 'string' },
        comment: { type: ['string', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {
      changeRequest: {
        relation: Model.BelongsToOneRelation,
        modelClass: ChangeRequest,
        join: {
          from: 'g_approvals.changeRequestId',
          to: 'g_change_requests.id',
        },
      },
      approver: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_approvals.approverId',
          to: 'g_users.id',
        },
      },
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
  }
}
