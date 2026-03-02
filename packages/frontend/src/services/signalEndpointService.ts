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
  async getAll(projectApiPath: string): Promise<SignalEndpoint[]> {
    const response = await api.get(`${projectApiPath}/signal-endpoints`);
    return response.data;
  }

  async getById(projectApiPath: string, id: number): Promise<SignalEndpoint> {
    const response = await api.get(`${projectApiPath}/signal-endpoints/${id}`);
    return response.data;
  }

  async create(
    projectApiPath: string,
    data: { name: string; description?: string }
  ): Promise<SignalEndpoint> {
    const response = await api.post(`${projectApiPath}/signal-endpoints`, data);
    return response.data;
  }

  async update(
    projectApiPath: string,
    id: number,
    data: { name?: string; description?: string; isEnabled?: boolean }
  ): Promise<SignalEndpoint> {
    const response = await api.put(`${projectApiPath}/signal-endpoints/${id}`, data);
    return response.data;
  }

  async delete(projectApiPath: string, id: number): Promise<void> {
    await api.delete(`${projectApiPath}/signal-endpoints/${id}`);
  }

  async toggle(projectApiPath: string, id: number): Promise<SignalEndpoint> {
    const response = await api.post(`${projectApiPath}/signal-endpoints/${id}/toggle`);
    return response.data;
  }

  async createToken(
    projectApiPath: string,
    endpointId: number,
    data: { name: string }
  ): Promise<SignalEndpointToken & { secret: string }> {
    const response = await api.post(
      `${projectApiPath}/signal-endpoints/${endpointId}/tokens`,
      data
    );
    return response.data;
  }

  async deleteToken(projectApiPath: string, endpointId: number, tokenId: number): Promise<void> {
    await api.delete(`${projectApiPath}/signal-endpoints/${endpointId}/tokens/${tokenId}`);
  }

  async getSignals(
    projectApiPath: string,
    endpointId: number,
    limit = 50,
    offset = 0
  ): Promise<{ data: Signal[]; pagination: { total: number; limit: number; offset: number } }> {
    const response = await api.get(`${projectApiPath}/signal-endpoints/${endpointId}/signals`, {
      params: { limit, offset },
    });
    return {
      data: response.data,
      pagination: (response as any).pagination as {
        total: number;
        limit: number;
        offset: number;
      },
    };
  }
}

export const signalEndpointService = new SignalEndpointService();
export default signalEndpointService;
