import { Model } from 'objection';
import { ChangeRequest } from './ChangeRequest';

/**
 * Outbox event status
 */
export type OutboxEventStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Outbox event types
 */
export const OUTBOX_EVENT_TYPES = {
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted'
} as const;

export type OutboxEventType = typeof OUTBOX_EVENT_TYPES[keyof typeof OUTBOX_EVENT_TYPES];

/**
 * OutboxEvent model
 *
 * Implements the Outbox Pattern for reliable event publishing.
 * Events are written to this table in the same transaction as data changes,
 * then processed asynchronously by a worker.
 *
 * This ensures:
 * - Atomicity: Events are only created if data changes commit
 * - Reliability: Events won't be lost even if the event bus is down
 * - Idempotency: Workers can safely retry failed events
 */
export class OutboxEvent extends Model {
    static tableName = 'g_outbox_events';

    id!: string;
    changeRequestId!: string;
    entityType!: string;
    entityId!: string;
    eventType!: OutboxEventType;
    payload!: Record<string, any>;
    status!: OutboxEventStatus;
    retryCount!: number;
    errorMessage?: string;
    createdAt!: Date;
    processedAt?: Date;

    // Relations
    changeRequest?: ChangeRequest;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['changeRequestId', 'entityType', 'entityId', 'eventType', 'payload'],
            properties: {
                id: { type: 'string' },
                changeRequestId: { type: 'string' },
                entityType: { type: 'string', maxLength: 100 },
                entityId: { type: 'string', maxLength: 255 },
                eventType: {
                    type: 'string',
                    enum: Object.values(OUTBOX_EVENT_TYPES)
                },
                payload: { type: 'object' },
                status: {
                    type: 'string',
                    enum: ['pending', 'processing', 'completed', 'failed']
                },
                retryCount: { type: 'integer', minimum: 0 },
                errorMessage: { type: ['string', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
                processedAt: { type: ['string', 'null'], format: 'date-time' }
            }
        };
    }

    static get relationMappings() {
        return {
            changeRequest: {
                relation: Model.BelongsToOneRelation,
                modelClass: ChangeRequest,
                join: {
                    from: 'g_outbox_events.changeRequestId',
                    to: 'g_change_requests.id'
                }
            }
        };
    }

    $beforeInsert() {
        this.createdAt = new Date();
        this.status = this.status || 'pending';
        this.retryCount = this.retryCount || 0;
    }
}
