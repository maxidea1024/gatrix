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
  executionParams: Record<string, unknown>;
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
  async getAll(projectApiPath: string): Promise<ActionSet[]> {
    const response = await api.get(`${projectApiPath}/actions`);
    return response.data;
  }

  async getById(projectApiPath: string, id: number): Promise<ActionSet> {
    const response = await api.get(`${projectApiPath}/actions/${id}`);
    return response.data;
  }

  async create(
    projectApiPath: string,
    data: {
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
        executionParams: Record<string, unknown>;
      }>;
    }
  ): Promise<ActionSet> {
    const response = await api.post(`${projectApiPath}/actions`, data);
    return response.data;
  }

  async update(
    projectApiPath: string,
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
        executionParams: Record<string, unknown>;
      }>;
    }
  ): Promise<ActionSet> {
    const response = await api.put(`${projectApiPath}/actions/${id}`, data);
    return response.data;
  }

  async delete(projectApiPath: string, id: number): Promise<void> {
    await api.delete(`${projectApiPath}/actions/${id}`);
  }

  async toggle(projectApiPath: string, id: number): Promise<ActionSet> {
    const response = await api.post(`${projectApiPath}/actions/${id}/toggle`);
    return response.data;
  }

  async getEvents(
    projectApiPath: string,
    id: number,
    limit = 50,
    offset = 0
  ): Promise<{
    data: ActionSetEvent[];
    pagination: { total: number; limit: number; offset: number };
  }> {
    const response = await api.get(`${projectApiPath}/actions/${id}/events`, {
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

export const actionSetService = new ActionSetService();
export default actionSetService;
