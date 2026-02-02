import { Request, Response } from "express";
import { TagService } from "../services/TagService";
import { asyncHandler, GatrixError } from "../middleware/errorHandler";
import { AuthenticatedRequest } from "../middleware/auth";

export const TagController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const tags = await TagService.list();
    res.json({ success: true, data: { tags } });
  }),

  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, color, description } = req.body;
    const tag = await TagService.create(
      { name, color, description },
      req.user?.userId,
    );
    res.json({ success: true, data: { tag }, message: "Tag created" });
  }),

  update: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new GatrixError("Invalid tag ID", 400);
    const { name, color, description } = req.body;
    const tag = await TagService.update(
      id,
      { name, color, description },
      req.user?.userId,
    );
    res.json({ success: true, data: { tag }, message: "Tag updated" });
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new GatrixError("Invalid tag ID", 400);
    await TagService.delete(id);
    res.json({ success: true, message: "Tag deleted" });
  }),

  setForEntity: asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { entityType, entityId, tagIds } = req.body;
      if (!entityType || !entityId || !Array.isArray(tagIds)) {
        throw new GatrixError("Invalid payload", 400);
      }
      await TagService.setTagsForEntity(
        entityType,
        Number(entityId),
        tagIds.map(Number),
        req.user?.userId,
      );
      res.json({ success: true, message: "Tags set for entity" });
    },
  ),

  listForEntity: asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.query as any;
    if (!entityType || !entityId) throw new GatrixError("Invalid query", 400);
    const tags = await TagService.listTagsForEntity(
      entityType,
      Number(entityId),
    );
    res.json({ success: true, data: { tags } });
  }),
};
