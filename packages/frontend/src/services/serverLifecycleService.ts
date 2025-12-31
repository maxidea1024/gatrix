import api from './api';

export interface ServerLifecycleEvent {
    id: number;
    environment: string; // Environment name (primary identifier)
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
    eventType: string;
    instanceStatus: string;
    uptimeSeconds: number;
    lastHeartbeatAt: string;
    errorMessage?: string;
    errorStack?: string;
    metadata?: any;
    createdAt: string;
}

export interface EventsResponse {
    data: ServerLifecycleEvent[];
    total: number;
    page: number;
    limit: number;
}

class ServerLifecycleService {
    async getEvents(params: {
        page?: number;
        limit?: number;
        serviceType?: string;
        instanceId?: string;
        environment?: string;
        eventType?: string;
    }): Promise<EventsResponse> {
        const response = await api.get('/admin/server-lifecycle/events', { params });
        // api.get returns response.data (the body)
        return response as any;
    }

    async getSummary(limit: number = 10): Promise<ServerLifecycleEvent[]> {
        const response = await api.get('/admin/server-lifecycle/summary', { params: { limit } });
        // api.get returns response.data (the body) which is { success, data: [...] }
        return response.data;
    }
}

export default new ServerLifecycleService();
