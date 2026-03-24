import { Request, Response } from 'express';
import { TagService } from '../services/tag-service';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';

export const TagController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const tags = await TagService.list(projectId);
    res.json({ success: true, data: { tags } });
  }),

  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, color, description } = req.body;
    const tag = await TagService.create(
      { name, color, description },
      req.user?.userId
    );
    res.json({ success: true, data: { tag }, message: 'Tag created' });
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) throw new GatrixError('Invalid tag ID', 400);
    const { name, color, description } = req.body;
    const tag = await TagService.update(
      id,
      { name, color, description },
      req.user?.userId
    );
    res.json({ success: true, data: { tag }, message: 'Tag updated' });
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) throw new GatrixError('Invalid tag ID', 400);
    await TagService.delete(id);
    res.json({ success: true, message: 'Tag deleted' });
  }),

  setForEntity: asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { entityType, entityId, tagIds } = req.body;
      if (!entityType || !entityId || !Array.isArray(tagIds)) {
        throw new GatrixError('Invalid payload', 400);
      }
      await TagService.setTagsForEntity(
        entityType,
        entityId,
        tagIds,
        req.user?.userId
      );

      res.json({ success: true, message: 'Tags set for entity' });
    }
  ),

  listForEntity: asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.query as Record<string, string>;
    if (!entityType || !entityId) throw new GatrixError('Invalid query', 400);
    const tags = await TagService.listTagsForEntity(entityType, entityId);
    res.json({ success: true, data: { tags } });
  }),
};
