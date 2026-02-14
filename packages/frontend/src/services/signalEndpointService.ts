import api from './api';

// Types
export interface SignalEndpoint {
    id: number;
    name: string;
    description: string | null;
    isEnabled: boolean;
    createdBy: number;
    updatedBy: number | null;
    createdAt: string;
    updatedAt: string;
    tokens?: SignalEndpointToken[];
}

export interface SignalEndpointToken {
    id: number;
    endpointId: number;
    tokenName: string;
    tokenHash: string;
    createdBy: number;
    createdAt: string;
}

export interface Signal {
    id: number;
    endpointId: number;
    payload: Record<string, unknown>;
    source: string | null;
    sourceId: string | null;
    isProcessed: boolean;
    createdAt: string;
}

class SignalEndpointService {
    async getAll(): Promise<SignalEndpoint[]> {
        const response = await api.get('/admin/signal-endpoints');
        return response.data;
    }

    async getById(id: number): Promise<SignalEndpoint> {
        const response = await api.get(`/admin/signal-endpoints/${id}`);
        return response.data;
    }

    async create(data: { name: string; description?: string }): Promise<SignalEndpoint> {
        const response = await api.post('/admin/signal-endpoints', data);
        return response.data;
    }

    async update(
        id: number,
        data: { name?: string; description?: string; isEnabled?: boolean }
    ): Promise<SignalEndpoint> {
        const response = await api.put(`/admin/signal-endpoints/${id}`, data);
        return response.data;
    }

    async delete(id: number): Promise<void> {
        await api.delete(`/admin/signal-endpoints/${id}`);
    }

    async toggle(id: number): Promise<SignalEndpoint> {
        const response = await api.post(`/admin/signal-endpoints/${id}/toggle`);
        return response.data;
    }

    async createToken(
        endpointId: number,
        data: { name: string }
    ): Promise<SignalEndpointToken & { secret: string }> {
        const response = await api.post(`/admin/signal-endpoints/${endpointId}/tokens`, data);
        return response.data;
    }

    async deleteToken(endpointId: number, tokenId: number): Promise<void> {
        await api.delete(`/admin/signal-endpoints/${endpointId}/tokens/${tokenId}`);
    }

    async getSignals(
        endpointId: number,
        limit = 50,
        offset = 0
    ): Promise<{ data: Signal[]; pagination: { total: number; limit: number; offset: number } }> {
        const response = await api.get(`/admin/signal-endpoints/${endpointId}/signals`, {
            params: { limit, offset },
        });
        return { data: response.data, pagination: (response as Record<string, unknown>).pagination as { total: number; limit: number; offset: number } };
    }
}

export const signalEndpointService = new SignalEndpointService();
export default signalEndpointService;
