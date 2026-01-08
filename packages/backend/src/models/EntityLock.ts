import { Model } from 'objection';
import { User } from './User';

/**
 * Lock type
 */
export type LockType = 'soft' | 'hard';

/**
 * EntityLock model
 *
 * Manages locks on entities to control concurrent modifications.
 *
 * Lock Types:
 * - Soft: Warning only, allows concurrent edits
 * - Hard: Blocks concurrent edits until lock expires or is released
 *
 * Lock policies can be configured per entity type and environment.
 */
export class EntityLock extends Model {
    static tableName = 'g_entity_locks';

    id!: string;
    entityType!: string;
    entityId!: string;
    environment!: string;
    lockedBy!: number;
    lockType!: LockType;
    expiresAt?: Date;
    createdAt!: Date;

    // Relations
    user?: User;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['entityType', 'entityId', 'environment', 'lockedBy', 'lockType'],
            properties: {
                id: { type: 'string' },
                entityType: { type: 'string', maxLength: 100 },
                entityId: { type: 'string', maxLength: 255 },
                environment: { type: 'string', maxLength: 100 },
                lockedBy: { type: 'integer' },
                lockType: {
                    type: 'string',
                    enum: ['soft', 'hard']
                },
                expiresAt: { type: ['string', 'null'], format: 'date-time' },
                createdAt: { type: 'string', format: 'date-time' }
            }
        };
    }

    static get relationMappings() {
        return {
            user: {
                relation: Model.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: 'g_entity_locks.lockedBy',
                    to: 'g_users.id'
                }
            }
        };
    }

    $beforeInsert() {
        this.createdAt = new Date();
    }

    /**
     * Check if the lock is expired
     */
    isExpired(): boolean {
        if (!this.expiresAt) return false;
        return new Date() > new Date(this.expiresAt);
    }

    /**
     * Check if the lock is active (not expired)
     */
    isActive(): boolean {
        return !this.isExpired();
    }
}
