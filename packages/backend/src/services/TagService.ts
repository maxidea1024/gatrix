import TagModel, { CreateTagData, UpdateTagData } from '../models/Tag';
import TagAssignmentModel from '../models/TagAssignment';
import { GatrixError } from '../middleware/errorHandler';

export class TagService {
  static async list(projectId?: string) {
    return await TagModel.list(projectId);
  }

  static async create(data: CreateTagData, userId?: string) {
    const name = data.name?.trim();
    if (!name) throw new GatrixError('Tag name is required', 400);
    const existing = await TagModel.findByName(name);
    if (existing) throw new GatrixError('Tag with this name already exists', 409);
    return await TagModel.create({ ...data, name, createdBy: userId ?? null });
  }

  static async update(id: string, data: UpdateTagData, userId?: string) {
    if (data.name !== undefined) {
      const name = data.name?.trim();
      if (!name) throw new GatrixError('Tag name is required', 400);
      const existing = await TagModel.findByName(name);
      if (existing && existing.id !== id)
        throw new GatrixError('Tag with this name already exists', 409);
      data.name = name;
    }
    const tag = await TagModel.update(id, {
      ...data,
      updatedBy: userId ?? null,
    });
    if (!tag) throw new GatrixError('Tag not found', 404);
    return tag;
  }

  static async delete(id: string): Promise<void> {
    await TagModel.delete(id);
  }

  static async setTagsForEntity(
    entityType: string,
    entityId: string,
    tagIds: string[],
    createdBy?: string
  ): Promise<void> {
    await TagAssignmentModel.setTagsForEntity(entityType, entityId, tagIds, createdBy);
  }

  static async listTagsForEntity(entityType: string, entityId: string) {
    return await TagAssignmentModel.listTagsForEntity(entityType, entityId);
  }
}
