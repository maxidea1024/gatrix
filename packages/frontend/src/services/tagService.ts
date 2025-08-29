import { apiService } from './api';

export interface Tag {
  id: number;
  name: string;
  color: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdByName?: string | null;
  updatedByName?: string | null;
}

export interface TagListParams {
  sort?: 'nameAsc' | 'nameDesc' | 'createdAtDesc' | 'createdAtAsc' | 'updatedAtDesc' | 'updatedAtAsc';
}

export const tagService = {
  async list(params?: TagListParams): Promise<Tag[]> {
    const res = await apiService.get<{ tags: Tag[] }>('/tags', { params });
    return res.data?.tags || [];
  },

  async create(payload: { name: string; color?: string; description?: string | null; }): Promise<Tag> {
    const res = await apiService.post<{ tag: Tag }>('/tags', payload);
    return res.data!.tag;
  },

  async update(id: number, payload: Partial<{ name: string; color: string; description: string | null; }>): Promise<Tag> {
    const res = await apiService.put<{ tag: Tag }>(`/tags/${id}`, payload);
    return res.data!.tag;
  },

  async remove(id: number): Promise<void> {
    await apiService.delete(`/tags/${id}`);
  },

  async listForEntity(entityType: string, entityId: number): Promise<Tag[]> {
    const res = await apiService.get<{ tags: Tag[] }>(`/tags/assignments`, { params: { entityType, entityId } });
    return res.data?.tags || [];
  },

  async setForEntity(entityType: string, entityId: number, tagIds: number[]): Promise<void> {
    await apiService.put(`/tags/assignments`, { entityType, entityId, tagIds });
  },
};
