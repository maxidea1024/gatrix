import { Model } from 'objection';
import { convertToMySQLDateTime } from '../utils/dateUtils';

export interface ServerLifecycleEventData {
    id?: number;
    environmentId: string;
    instanceId: string;
    serviceType: string;
    serviceGroup?: string;
    hostname?: string;
    externalAddress?: string;
    internalAddress?: string;
    ports?: Record<string, number>;
    cloudProvider?: string;
    cloudRegion?: string;
    cloudZone?: string;
    labels?: Record<string, any>;
    appVersion?: string;
    sdkVersion?: string;
    eventType: string; // INITIALIZING, READY, SHUTTING_DOWN, ERROR, TERMINATED, NO_RESPONSE
    instanceStatus: string;
    uptimeSeconds?: number;
    heartbeatCount?: number;
    lastHeartbeatAt?: string | Date;
    errorMessage?: string;
    errorStack?: string;
    metadata?: any;
    createdAt?: string | Date;
}

export class ServerLifecycleEvent extends Model implements ServerLifecycleEventData {
    static tableName = 'g_server_lifecycle_events';

    id?: number;
    environmentId!: string;
    instanceId!: string;
    serviceType!: string;
    serviceGroup?: string;
    hostname?: string;
    externalAddress?: string;
    internalAddress?: string;
    ports?: Record<string, number>;
    cloudProvider?: string;
    cloudRegion?: string;
    cloudZone?: string;
    labels?: Record<string, any>;
    appVersion?: string;
    sdkVersion?: string;
    eventType!: string;
    instanceStatus!: string;
    uptimeSeconds?: number;
    heartbeatCount?: number;
    lastHeartbeatAt?: string | Date;
    errorMessage?: string;
    errorStack?: string;
    metadata?: any;
    createdAt?: string | Date;

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['environmentId', 'instanceId', 'serviceType', 'eventType', 'instanceStatus'],
            properties: {
                id: { type: 'integer' },
                environmentId: { type: 'string', minLength: 1, maxLength: 127 },
                instanceId: { type: 'string', minLength: 1, maxLength: 127 },
                serviceType: { type: 'string', minLength: 1, maxLength: 63 },
                serviceGroup: { type: 'string', maxLength: 63 },
                hostname: { type: 'string', maxLength: 255 },
                externalAddress: { type: 'string', maxLength: 45 },
                internalAddress: { type: 'string', maxLength: 45 },
                ports: { type: ['object', 'null'] },
                cloudProvider: { type: 'string', maxLength: 63 },
                cloudRegion: { type: 'string', maxLength: 63 },
                cloudZone: { type: 'string', maxLength: 63 },
                labels: { type: ['object', 'null'] },
                appVersion: { type: 'string', maxLength: 63 },
                sdkVersion: { type: 'string', maxLength: 63 },
                eventType: { type: 'string', maxLength: 31 },
                instanceStatus: { type: 'string', maxLength: 31 },
                uptimeSeconds: { type: 'integer', minimum: 0 },
                heartbeatCount: { type: 'integer', minimum: 0 },
                lastHeartbeatAt: { type: ['string', 'null'], format: 'date-time' },
                errorMessage: { type: ['string', 'null'] },
                errorStack: { type: ['string', 'null'] },
                metadata: { type: ['object', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
            },
        };
    }

    $beforeInsert() {
        if (!this.createdAt) {
            this.createdAt = new Date();
        }

        // Ensure all dates are in MySQL format (YYYY-MM-DD HH:MM:SS)
        this.createdAt = convertToMySQLDateTime(this.createdAt) || this.createdAt;

        if (this.lastHeartbeatAt) {
            this.lastHeartbeatAt = convertToMySQLDateTime(this.lastHeartbeatAt) || this.lastHeartbeatAt;
        }
    }

    static async recordEvent(data: ServerLifecycleEventData): Promise<ServerLifecycleEvent> {
        // metadata is already JSON-ready
        return await this.query().insert(data);
    }

    /**
     * Delete events older than the specified number of days
     * @param retentionDays Number of days to retain events
     * @returns Number of deleted events
     */
    static async deleteOldEvents(retentionDays: number): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffDateStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

        const result = await this.query()
            .delete()
            .where('createdAt', '<', cutoffDateStr);

        return result;
    }
}

export default ServerLifecycleEvent;
