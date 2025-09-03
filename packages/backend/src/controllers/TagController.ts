import { Request, Response } from 'express';
import { TagService } from '../services/TagService';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

export const TagController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const tags = await TagService.list();
    // Apply sort/filter on API layer for consistency with other pages
    const { sort, createdBy, updatedBy } = req.query as any;
    let result = tags as any[];
    if (createdBy) result = result.filter(t => String(t.createdBy) === String(createdBy));
    if (updatedBy) result = result.filter(t => String(t.updatedBy) === String(updatedBy));
    switch (sort) {
      case 'createdAtDesc': result = result.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'createdAtAsc':  result = result.sort((a,b)=> new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case 'updatedAtDesc': result = result.sort((a,b)=> new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); break;
      case 'updatedAtAsc':  result = result.sort((a,b)=> new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()); break;
      case 'nameDesc':      result = result.sort((a,b)=> b.name.localeCompare(a.name)); break;
      default:              result = result.sort((a,b)=> a.name.localeCompare(b.name));
    }
    res.json({ success: true, data: { tags: result } });
  }),

  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, color, description } = req.body;
    const tag = await TagService.create({ name, color, description }, req.user?.userId);
    res.json({ success: true, data: { tag }, message: 'Tag created' });
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new CustomError('Invalid tag ID', 400);
    const { name, color, description } = req.body;
    const tag = await TagService.update(id, { name, color, description }, req.user?.userId);
    res.json({ success: true, data: { tag }, message: 'Tag updated' });
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new CustomError('Invalid tag ID', 400);
    await TagService.delete(id);
    res.json({ success: true, message: 'Tag deleted' });
  }),

  setForEntity: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId, tagIds } = req.body;
    if (!entityType || !entityId || !Array.isArray(tagIds)) {
      throw new CustomError('Invalid payload', 400);
    }
    await TagService.setTagsForEntity(entityType, Number(entityId), tagIds.map(Number), req.user?.userId);
    res.json({ success: true, message: 'Tags set for entity' });
  }),

  listForEntity: asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.query as any;
    if (!entityType || !entityId) throw new CustomError('Invalid query', 400);
    const tags = await TagService.listTagsForEntity(entityType, Number(entityId));
    res.json({ success: true, data: { tags } });
  }),
};

