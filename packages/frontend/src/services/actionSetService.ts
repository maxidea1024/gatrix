import api from './api';

// Types
export interface ActionSet {
    id: number;
    name: string;
    description: string | null;
    isEnabled: boolean;
    actorId: number | null;
    source: string | null;
    sourceId: number | null;
    filters: Record<string, unknown> | null;
    createdBy: number;
    updatedBy: number | null;
    createdAt: string;
    updatedAt: string;
    actions?: Action[];
}

export interface Action {
    id: number;
    actionSetId: number;
    actionType: string;
    sortOrder: number;
    params: Record<string, unknown>;
    createdAt: string;
}

export interface ActionSetEvent {
    id: number;
    actionSetId: number;
    signalId: number | null;
    eventState: 'started' | 'success' | 'failed';
    details: Record<string, unknown> | null;
    createdAt: string;
}

class ActionSetService {
    async getAll(): Promise<ActionSet[]> {
        const response = await api.get('/admin/actions');
        return response.data;
    }

    async getById(id: number): Promise<ActionSet> {
        const response = await api.get(`/admin/actions/${id}`);
        return response.data;
    }

    async create(data: {
        name: string;
        description?: string;
        isEnabled?: boolean;
        actorId?: number;
        source?: string;
        sourceId?: number;
        filters?: Record<string, unknown>;
        actions: Array<{
            actionType: string;
            sortOrder: number;
            params: Record<string, unknown>;
        }>;
    }): Promise<ActionSet> {
        const response = await api.post('/admin/actions', data);
        return response.data;
    }

    async update(
        id: number,
        data: {
            name?: string;
            description?: string;
            isEnabled?: boolean;
            actorId?: number;
            source?: string;
            sourceId?: number;
            filters?: Record<string, unknown>;
            actions?: Array<{
                actionType: string;
                sortOrder: number;
                params: Record<string, unknown>;
            }>;
        }
    ): Promise<ActionSet> {
        const response = await api.put(`/admin/actions/${id}`, data);
        return response.data;
    }

    async delete(id: number): Promise<void> {
        await api.delete(`/admin/actions/${id}`);
    }

    async toggle(id: number): Promise<ActionSet> {
        const response = await api.post(`/admin/actions/${id}/toggle`);
        return response.data;
    }

    async getEvents(
        id: number,
        limit = 50,
        offset = 0
    ): Promise<{
        data: ActionSetEvent[];
        pagination: { total: number; limit: number; offset: number };
    }> {
        const response = await api.get(`/admin/actions/${id}/events`, {
            params: { limit, offset },
        });
        return {
            data: response.data,
            pagination: (response as Record<string, unknown>).pagination as {
                total: number;
                limit: number;
                offset: number;
            },
        };
    }
}

export const actionSetService = new ActionSetService();
export default actionSetService;
