import TagModel, { CreateTagData, UpdateTagData } from '../models/Tag';
import TagAssignmentModel from '../models/TagAssignment';
import { GatrixError } from '../middleware/errorHandler';

export class TagService {
  static async list() {
    return await TagModel.list();
  }

  static async create(data: CreateTagData, userId?: number) {
    const name = data.name?.trim();
    if (!name) throw new GatrixError('Tag name is required', 400);
    const existing = await TagModel.findByName(name);
    if (existing) throw new GatrixError('Tag with this name already exists', 409);
    return await TagModel.create({ ...data, name, createdBy: userId ?? null });
  }

  static async update(id: number, data: UpdateTagData, userId?: number) {
    if (data.name) {
      const name = data.name.trim();
      const existing = await TagModel.findByName(name);
      if (existing && existing.id !== id) throw new GatrixError('Tag with this name already exists', 409);
      data.name = name;
    }
    const tag = await TagModel.update(id, { ...data, updatedBy: userId ?? null });
    if (!tag) throw new GatrixError('Tag not found', 404);
    return tag;
  }

  static async delete(id: number): Promise<void> {
    await TagModel.delete(id);
  }

  static async setTagsForEntity(entityType: string, entityId: number, tagIds: number[]): Promise<void> {
    await TagAssignmentModel.setTagsForEntity(entityType, entityId, tagIds);
  }

  static async listTagsForEntity(entityType: string, entityId: number) {
    return await TagAssignmentModel.listTagsForEntity(entityType, entityId);
  }
}
