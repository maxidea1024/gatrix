import { apiService } from "./api";

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
  createdByEmail?: string | null;
  updatedByEmail?: string | null;
}

export const tagService = {
  async list(): Promise<Tag[]> {
    const res = await apiService.get<{ tags: Tag[] }>("/admin/tags");
    return res.data?.tags || [];
  },

  async create(payload: {
    name: string;
    color?: string;
    description?: string | null;
  }): Promise<Tag> {
    const res = await apiService.post<{ tag: Tag }>("/admin/tags", payload);
    return res.data!.tag;
  },

  async update(
    id: number,
    payload: Partial<{
      name: string;
      color: string;
      description: string | null;
    }>,
  ): Promise<Tag> {
    const res = await apiService.put<{ tag: Tag }>(
      `/admin/tags/${id}`,
      payload,
    );
    return res.data!.tag;
  },

  async remove(id: number): Promise<void> {
    await apiService.delete(`/admin/tags/${id}`);
  },

  async listForEntity(entityType: string, entityId: number): Promise<Tag[]> {
    const res = await apiService.get<{ tags: Tag[] }>(
      `/admin/tags/assignments`,
      { params: { entityType, entityId } },
    );
    return res.data?.tags || [];
  },

  async setForEntity(
    entityType: string,
    entityId: number,
    tagIds: number[],
  ): Promise<void> {
    await apiService.put(`/admin/tags/assignments`, {
      entityType,
      entityId,
      tagIds,
    });
  },
};
