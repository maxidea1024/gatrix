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
  createdByEmail?: string | null;
  updatedByEmail?: string | null;
}

/** Build tags base path from project-scoped path (tags are project-scoped) */
function basePath(projectApiPath: string | null): string | null {
  return projectApiPath ? `${projectApiPath}/tags` : null;
}

export const tagService = {
  async list(projectApiPath: string | null = null): Promise<Tag[]> {
    const res = await apiService.get<{ tags: Tag[] }>(basePath(projectApiPath));
    return res.data?.tags || [];
  },

  async create(
    payload: {
      name: string;
      color?: string;
      description?: string | null;
    },
    projectApiPath: string | null = null
  ): Promise<Tag> {
    const res = await apiService.post<{ tag: Tag }>(
      basePath(projectApiPath),
      payload
    );
    return res.data!.tag;
  },

  async update(
    id: number,
    payload: Partial<{
      name: string;
      color: string;
      description: string | null;
    }>,
    projectApiPath: string | null = null
  ): Promise<Tag> {
    const res = await apiService.put<{ tag: Tag }>(
      `${basePath(projectApiPath)}/${id}`,
      payload
    );
    return res.data!.tag;
  },

  async remove(
    id: number,
    projectApiPath: string | null = null
  ): Promise<void> {
    await apiService.delete(`${basePath(projectApiPath)}/${id}`);
  },

  async listForEntity(
    entityType: string,
    entityId: number,
    projectApiPath: string | null = null
  ): Promise<Tag[]> {
    const res = await apiService.get<{ tags: Tag[] }>(
      `${basePath(projectApiPath)}/assignments`,
      {
        params: { entityType, entityId },
      }
    );
    return res.data?.tags || [];
  },

  async setForEntity(
    entityType: string,
    entityId: number,
    tagIds: number[],
    projectApiPath: string | null = null
  ): Promise<void> {
    await apiService.put(`${basePath(projectApiPath)}/assignments`, {
      entityType,
      entityId,
      tagIds,
    });
  },
};
