import VarsModel, { VarItem } from '../models/vars';
import { cacheService } from './cache-service';
import { pubSubService } from './pub-sub-service';
import { withEnvironment, SERVER_SDK_ETAG } from '../constants/cache-keys';
import { createLogger } from '../config/logger';

const logger = createLogger('VarsService');

const CACHE_TTL = 300; // 5 minutes

export class VarsService {
  /**
   * Get a variable value by key with caching
   */
  static async get(key: string, environmentId: string): Promise<string | null> {
    const cacheKey = withEnvironment(environmentId, `vars:${key}`);

    // Try to get from cache first
    const cached = await cacheService.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch from database
    const value = await VarsModel.get(key, environmentId);

    // Store in cache (even if null, to avoid cache stampede)
    await cacheService.set(cacheKey, value, CACHE_TTL);

    return value;
  }

  /**
   * Get all KV items for an environment with caching
   */
  static async getAllKV(environmentId: string): Promise<VarItem[]> {
    const cacheKey = withEnvironment(environmentId, 'vars:all_kv');

    const cached = await cacheService.get<VarItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const items = await VarsModel.getAllKV(environmentId);
    await cacheService.set(cacheKey, items, CACHE_TTL);

    return items;
  }

  /**
   * Clear cache for a specific key
   */
  static async clearCache(key: string, environmentId: string): Promise<void> {
    const cacheKey = withEnvironment(environmentId, `vars:${key}`);
    const allKvCacheKey = withEnvironment(environmentId, 'vars:all_kv');

    // Invalidate data caches
    await pubSubService.invalidateKey(cacheKey);
    await pubSubService.invalidateKey(allKvCacheKey);

    // Also invalidate Server SDK ETag cache
    // This key must match exactly what is used in VarsController.getServerVars
    const etagKey = `${SERVER_SDK_ETAG.VARS}:${environmentId}`;
    await pubSubService.invalidateKey(etagKey);

    logger.info(`Vars cache cleared for key: ${key}, env: ${environmentId}`, {
      etagKey,
    });
  }

  /**
   * Update a KV item and clear cache
   */
  static async updateKV(
    key: string,
    value: string | null,
    userId: string,
    environmentId: string
  ): Promise<void> {
    await VarsModel.set(key, value, userId, environmentId);
    await this.clearCache(key, environmentId);

    // Publish change event with full data for direct SDK cache update
    await pubSubService.publishSDKEvent(
      {
        type: 'vars.updated',
        data: { key, value, environmentId },
      },
      { environmentId }
    );
  }
}
