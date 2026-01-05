import { Model } from 'objection';
import { ChangeRequest } from './ChangeRequest';

export class ChangeItem extends Model {
    static tableName = 'g_change_items';

    id!: string;
    changeRequestId!: string;
    targetTable!: string;
    targetId!: string;
    beforeData?: any;
    afterData?: any;

    // Relations
    changeRequest?: ChangeRequest;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['changeRequestId', 'targetTable', 'targetId'],
            properties: {
                id: { type: 'string' },
                changeRequestId: { type: 'string' },
                targetTable: { type: 'string', maxLength: 100 },
                targetId: { type: 'string', maxLength: 255 },
                beforeData: { type: ['object', 'null'] },
                afterData: { type: ['object', 'null'] }
            }
        };
    }

    static get relationMappings() {
        return {
            changeRequest: {
                relation: Model.BelongsToOneRelation,
                modelClass: ChangeRequest,
                join: {
                    from: 'g_change_items.changeRequestId',
                    to: 'g_change_requests.id'
                }
            }
        };
    }
}
