import { Request, Response } from 'express';
import { TagService } from '../services/tag-service';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import { pubSubService } from '../services/pub-sub-service';
import { SERVER_SDK_ETAG } from '../constants/cache-keys';
import { ClientVersionModel } from '../models/client-version';
import { GameWorldModel } from '../models/game-world';
import { createLogger } from '../config/logger';

const logger = createLogger('TagController');

/**
 * Publish SDK cache invalidation events after tag changes.
 * Each entityType needs its own cache invalidation + SDK event so Edge SDK picks up the change.
 */
async function publishTagChangeSDKEvent(
  entityType: string,
  entityId: string
): Promise<void> {
  try {
    switch (entityType) {
      case 'client_version': {
        // Look up the client version to get its environmentId
        const cv = await ClientVersionModel.findByIdWithoutEnv(entityId);
        if (cv) {
          const environmentId = cv.environmentId;
          // Invalidate backend cache
          await pubSubService.invalidateByPattern('*client_version:*');
          await pubSubService.invalidateKey(
            `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${environmentId}`
          );
          // Publish SDK event so Edge refreshes client version cache
          await pubSubService.publishSDKEvent(
            {
              type: 'client_version.updated',
              data: { id: entityId, environmentId },
            },
            { environmentId }
          );
        }
        break;
      }
      case 'game_world': {
        const gw = await GameWorldModel.findByIdWithoutEnv(entityId);
        if (gw) {
          const environmentId = gw.environmentId;
          await pubSubService.invalidateByPattern('*game_world*');
          await pubSubService.invalidateKey(
            `${SERVER_SDK_ETAG.GAME_WORLDS}:${environmentId}`
          );
          await pubSubService.publishSDKEvent(
            {
              type: 'game_world.updated',
              data: { id: entityId, environmentId },
            },
            { environmentId }
          );
        }
        break;
      }
      case 'store_product': {
        await pubSubService.invalidateByPattern('*store_product*');
        break;
      }
      default:
        // Other entity types don't need SDK events (yet)
        break;
    }
  } catch (error) {
    logger.error(
      `Failed to publish SDK event after tag change for ${entityType}:${entityId}`,
      error
    );
  }
}

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

      // Publish SDK events so Edge servers refresh their cache
      await publishTagChangeSDKEvent(entityType, entityId);

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
