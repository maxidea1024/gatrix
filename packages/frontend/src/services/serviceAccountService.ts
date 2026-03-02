import api from './api';

// Types
export interface ServiceAccount {
  id: number;
  name: string;
  email: string;
  authType: string;
  status: string;
  role: string;
  permissions: string[] | null;
  allowAllEnvironments: boolean;
  environments: string[];
  createdAt: string;
  updatedAt: string;
  tokens?: ServiceAccountToken[];
}

export interface ServiceAccountToken {
  id: number;
  userId: number;
  tokenName: string;
  description: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

class ServiceAccountService {
  async getAll(projectApiPath: string): Promise<ServiceAccount[]> {
    const response = await api.get(`${projectApiPath}/service-accounts`);
    return response.data;
  }

  async getById(projectApiPath: string, id: number): Promise<ServiceAccount> {
    const response = await api.get(`${projectApiPath}/service-accounts/${id}`);
    return response.data;
  }

  async create(
    projectApiPath: string,
    data: {
      name: string;
      role?: string;
      permissions?: string[];
      allowAllEnvironments?: boolean;
      environments?: string[];
    }
  ): Promise<ServiceAccount> {
    const response = await api.post(`${projectApiPath}/service-accounts`, data);
    return response.data;
  }

  async update(
    projectApiPath: string,
    id: number,
    data: {
      name?: string;
      role?: string;
      permissions?: string[];
      allowAllEnvironments?: boolean;
      environments?: string[];
    }
  ): Promise<ServiceAccount> {
    const response = await api.put(`${projectApiPath}/service-accounts/${id}`, data);
    return response.data;
  }

  async delete(projectApiPath: string, id: number): Promise<void> {
    await api.delete(`${projectApiPath}/service-accounts/${id}`);
  }

  async createToken(
    projectApiPath: string,
    accountId: number,
    data: { name: string; description?: string; expiresAt?: string }
  ): Promise<ServiceAccountToken & { secret: string }> {
    const response = await api.post(`${projectApiPath}/service-accounts/${accountId}/tokens`, data);
    return response.data;
  }

  async deleteToken(projectApiPath: string, accountId: number, tokenId: number): Promise<void> {
    await api.delete(`${projectApiPath}/service-accounts/${accountId}/tokens/${tokenId}`);
  }
}

export const serviceAccountService = new ServiceAccountService();
export default serviceAccountService;
