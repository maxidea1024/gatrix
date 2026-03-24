import TagModel, { CreateTagData, UpdateTagData } from '../models/tag';
import TagAssignmentModel from '../models/tag-assignment';
import { GatrixError } from '../middleware/error-handler';
import { pubSubService } from './pub-sub-service';
import { SERVER_SDK_ETAG } from '../constants/cache-keys';
import { ClientVersionModel } from '../models/client-version';
import { GameWorldModel } from '../models/game-world';
import { createLogger } from '../config/logger';

const logger = createLogger('TagService');

/**
 * Entity type → SDK cache key prefix mapping.
 * Tags are just data included in each entity — when tags change,
 * the entity itself needs to be invalidated.
 */
const ENTITY_SDK_ETAG: Record<string, string> = {
  client_version: SERVER_SDK_ETAG.CLIENT_VERSIONS,
  game_world: SERVER_SDK_ETAG.GAME_WORLDS,
  store_product: SERVER_SDK_ETAG.STORE_PRODUCTS,
};

export class TagService {
  static async list(projectId?: string) {
    return await TagModel.list(projectId);
  }

  static async create(data: CreateTagData, userId?: string) {
    const name = data.name?.trim();
    if (!name) throw new GatrixError('Tag name is required', 400);
    const existing = await TagModel.findByName(name);
    if (existing)
      throw new GatrixError('Tag with this name already exists', 409);
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
    await TagAssignmentModel.setTagsForEntity(
      entityType,
      entityId,
      tagIds,
      createdBy
    );

    // Tags are part of entity data — invalidate entity cache
    await this.invalidateEntityCache(entityType, entityId);
  }

  static async listTagsForEntity(entityType: string, entityId: string) {
    return await TagAssignmentModel.listTagsForEntity(entityType, entityId);
  }

  /**
   * Invalidate entity cache after tag changes.
   * Uses the same invalidation pattern as entity update flows.
   */
  private static async invalidateEntityCache(
    entityType: string,
    entityId: string
  ): Promise<void> {
    const sdkEtagPrefix = ENTITY_SDK_ETAG[entityType];
    if (!sdkEtagPrefix) return;

    try {
      const environmentId = await this.resolveEnvironmentId(
        entityType,
        entityId
      );
      if (!environmentId) return;

      await pubSubService.invalidateByPattern(`*${entityType}*`);
      await pubSubService.invalidateKey(
        `${sdkEtagPrefix}:${environmentId}`
      );
      await pubSubService.publishSDKEvent(
        {
          type: `${entityType}.updated`,
          data: { id: entityId, environmentId },
        },
        { environmentId }
      );
    } catch (error) {
      logger.error(
        `Failed to invalidate entity cache for ${entityType}:${entityId}`,
        error
      );
    }
  }

  /**
   * Resolve environmentId from entity record.
   */
  private static async resolveEnvironmentId(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    switch (entityType) {
      case 'client_version': {
        const cv = await ClientVersionModel.findByIdWithoutEnv(entityId);
        return cv?.environmentId || null;
      }
      case 'game_world': {
        const gw = await GameWorldModel.findByIdWithoutEnv(entityId);
        return gw?.environmentId || null;
      }
      default:
        return null;
    }
  }
}
