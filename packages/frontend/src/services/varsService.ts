import { apiService } from './api';

export const varsService = {
  async get(key: string): Promise<string | null> {
    const res = await apiService.get<{ key: string; value: string | null }>(`/vars/${encodeURIComponent(key)}`);
    return (res as any)?.data?.value ?? null;
  },
  async set(key: string, value: any): Promise<void> {
    await apiService.put(`/vars/${encodeURIComponent(key)}`, { value });
  }
};

