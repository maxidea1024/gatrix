import { apiService } from './api';
import {
  PlatformOption,
  ChannelOption,
  PlatformConfig,
} from '../types/platformConfig';

export type VarValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'object'
  | 'array';

export interface VarItem {
  id: number;
  varKey: string;
  varValue: string | null;
  valueType: VarValueType;
  description: string | null;
  isSystemDefined: boolean;
  createdBy: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
  isCopyable?: boolean;
}

export interface CreateVarData {
  varKey: string;
  varValue: string | null;
  valueType: VarValueType;
  description?: string | null;
}

export interface UpdateVarData {
  varValue: string | null;
  valueType?: VarValueType;
  description?: string | null;
}

export const varsService = {
  async get(projectApiPath: string, key: string): Promise<string | null> {
    const res = await apiService.get<{ key: string; value: string | null }>(
      `${projectApiPath}/vars/${encodeURIComponent(key)}`
    );
    return (res as any)?.data?.value ?? null;
  },
  async set(projectApiPath: string, key: string, value: any): Promise<void> {
    await apiService.put(`${projectApiPath}/vars/${encodeURIComponent(key)}`, {
      value,
    });
  },

  // KV Management
  async getAllKV(projectApiPath: string): Promise<VarItem[]> {
    const res = await apiService.get<VarItem[]>(`${projectApiPath}/vars/kv`);
    return (res as any)?.data ?? [];
  },

  async getKV(projectApiPath: string, key: string): Promise<VarItem | null> {
    const res = await apiService.get<VarItem>(
      `${projectApiPath}/vars/kv/${encodeURIComponent(key)}`
    );
    return (res as any)?.data ?? null;
  },

  async createKV(
    projectApiPath: string,
    data: CreateVarData
  ): Promise<VarItem> {
    const res = await apiService.post<VarItem>(
      `${projectApiPath}/vars/kv`,
      data
    );
    return (res as any)?.data;
  },

  async updateKV(
    projectApiPath: string,
    key: string,
    data: UpdateVarData
  ): Promise<VarItem> {
    const res = await apiService.put<VarItem>(
      `${projectApiPath}/vars/kv/${encodeURIComponent(key)}`,
      data
    );
    return (res as any)?.data;
  },

  async deleteKV(projectApiPath: string, key: string): Promise<void> {
    await apiService.delete(
      `${projectApiPath}/vars/kv/${encodeURIComponent(key)}`
    );
  },

  // Platform and Channel Configuration
  async getPlatforms(projectApiPath: string): Promise<PlatformOption[]> {
    try {
      const res = await apiService.get<VarItem>(
        `${projectApiPath}/vars/kv/${encodeURIComponent('$platforms')}`
      );
      const item = (res as any)?.data;
      if (!item || !item.varValue) {
        return [];
      }
      const parsed =
        typeof item.varValue === 'string'
          ? JSON.parse(item.varValue)
          : item.varValue;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to load platforms:', error);
      return [];
    }
  },

  async getChannels(projectApiPath: string): Promise<ChannelOption[]> {
    try {
      const res = await apiService.get<VarItem>(
        `${projectApiPath}/vars/kv/${encodeURIComponent('$channels')}`
      );
      const item = (res as any)?.data;
      if (!item || !item.varValue) {
        return [];
      }
      const parsed =
        typeof item.varValue === 'string'
          ? JSON.parse(item.varValue)
          : item.varValue;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to load channels:', error);
      return [];
    }
  },

  async getPlatformConfig(projectApiPath: string): Promise<PlatformConfig> {
    try {
      const [platforms, channels] = await Promise.all([
        this.getPlatforms(projectApiPath),
        this.getChannels(projectApiPath),
      ]);
      return { platforms, channels };
    } catch (error) {
      console.error('Failed to load platform config:', error);
      return { platforms: [], channels: [] };
    }
  },
};
