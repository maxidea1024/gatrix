import { apiService } from './api';
import { PlatformOption, ChannelOption, PlatformConfig } from '../types/platformConfig';

export type VarValueType = 'string' | 'number' | 'boolean' | 'color' | 'object' | 'array';

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
  async get(key: string): Promise<string | null> {
    const res = await apiService.get<{ key: string; value: string | null }>(
      `/admin/vars/${encodeURIComponent(key)}`
    );
    return (res as any)?.data?.value ?? null;
  },
  async set(key: string, value: any): Promise<void> {
    await apiService.put(`/admin/vars/${encodeURIComponent(key)}`, { value });
  },

  // KV Management
  async getAllKV(): Promise<VarItem[]> {
    const res = await apiService.get<VarItem[]>('/admin/vars/kv');
    return (res as any)?.data ?? [];
  },

  async getKV(key: string): Promise<VarItem | null> {
    const res = await apiService.get<VarItem>(`/admin/vars/kv/${encodeURIComponent(key)}`);
    return (res as any)?.data ?? null;
  },

  async createKV(data: CreateVarData): Promise<VarItem> {
    const res = await apiService.post<VarItem>('/admin/vars/kv', data);
    return (res as any)?.data;
  },

  async updateKV(key: string, data: UpdateVarData): Promise<VarItem> {
    const res = await apiService.put<VarItem>(`/admin/vars/kv/${encodeURIComponent(key)}`, data);
    return (res as any)?.data;
  },

  async deleteKV(key: string): Promise<void> {
    await apiService.delete(`/admin/vars/kv/${encodeURIComponent(key)}`);
  },

  // Platform and Channel Configuration
  async getPlatforms(): Promise<PlatformOption[]> {
    try {
      const res = await apiService.get<VarItem>(
        `/admin/vars/kv/${encodeURIComponent('$platforms')}`
      );
      const item = (res as any)?.data;
      if (!item || !item.varValue) {
        return [];
      }
      const parsed = typeof item.varValue === 'string' ? JSON.parse(item.varValue) : item.varValue;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load platforms:', error);
      return [];
    }
  },

  async getChannels(): Promise<ChannelOption[]> {
    try {
      const res = await apiService.get<VarItem>(
        `/admin/vars/kv/${encodeURIComponent('$channels')}`
      );
      const item = (res as any)?.data;
      if (!item || !item.varValue) {
        return [];
      }
      const parsed = typeof item.varValue === 'string' ? JSON.parse(item.varValue) : item.varValue;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load channels:', error);
      return [];
    }
  },

  async getPlatformConfig(): Promise<PlatformConfig> {
    try {
      const [platforms, channels] = await Promise.all([this.getPlatforms(), this.getChannels()]);
      return { platforms, channels };
    } catch (error) {
      console.error('Failed to load platform config:', error);
      return { platforms: [], channels: [] };
    }
  },
};
