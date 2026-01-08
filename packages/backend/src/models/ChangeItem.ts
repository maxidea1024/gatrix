import { Model } from 'objection';
import { ChangeRequest } from './ChangeRequest';

export class ChangeItem extends Model {
    static tableName = 'g_change_items';

    id!: string;
    changeRequestId!: string;
    actionGroupId?: string;
    targetTable!: string;
    targetId!: string;
    entityVersion?: number;
    beforeData?: any;
    afterData?: any;

    // Relations
    changeRequest?: ChangeRequest;
    actionGroup?: any; // Avoid circular import

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['changeRequestId', 'targetTable', 'targetId'],
            properties: {
                id: { type: 'string' },
                changeRequestId: { type: 'string' },
                actionGroupId: { type: ['string', 'null'] },
                targetTable: { type: 'string', maxLength: 100 },
                targetId: { type: 'string', maxLength: 255 },
                entityVersion: { type: ['integer', 'null'] },
                beforeData: { type: ['object', 'null'] },
                afterData: { type: ['object', 'null'] }
            }
        };
    }

    static get relationMappings() {
        const { ActionGroup } = require('./ActionGroup');

        return {
            changeRequest: {
                relation: Model.BelongsToOneRelation,
                modelClass: ChangeRequest,
                join: {
                    from: 'g_change_items.changeRequestId',
                    to: 'g_change_requests.id'
                }
            },
            actionGroup: {
                relation: Model.BelongsToOneRelation,
                modelClass: ActionGroup,
                join: {
                    from: 'g_change_items.actionGroupId',
                    to: 'g_action_groups.id'
                }
            }
        };
    }
}
