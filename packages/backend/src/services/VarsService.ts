import VarsModel, { VarItem } from '../models/Vars';
import { cacheService } from './CacheService';
import { pubSubService } from './PubSubService';
import { withEnvironment, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import logger from '../config/logger';

const CACHE_TTL = 300; // 5 minutes

export class VarsService {
  /**
   * Get a variable value by key with caching
   */
  static async get(key: string, environment: string): Promise<string | null> {
    const cacheKey = withEnvironment(environment, `vars:${key}`);

    // Try to get from cache first
    const cached = await cacheService.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch from database
    const value = await VarsModel.get(key, environment);

    // Store in cache (even if null, to avoid cache stampede)
    await cacheService.set(cacheKey, value, CACHE_TTL);

    return value;
  }

  /**
   * Get all KV items for an environment with caching
   */
  static async getAllKV(environment: string): Promise<VarItem[]> {
    const cacheKey = withEnvironment(environment, 'vars:all_kv');

    const cached = await cacheService.get<VarItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const items = await VarsModel.getAllKV(environment);
    await cacheService.set(cacheKey, items, CACHE_TTL);

    return items;
  }

  /**
   * Clear cache for a specific key
   */
  static async clearCache(key: string, environment: string): Promise<void> {
    const cacheKey = withEnvironment(environment, `vars:${key}`);
    const allKvCacheKey = withEnvironment(environment, 'vars:all_kv');

    // Invalidate data caches
    await pubSubService.invalidateKey(cacheKey);
    await pubSubService.invalidateKey(allKvCacheKey);

    // Also invalidate Server SDK ETag cache
    // This key must match exactly what is used in VarsController.getServerVars
    const etagKey = `${SERVER_SDK_ETAG.VARS}:${environment}`;
    await pubSubService.invalidateKey(etagKey);

    logger.info(`Vars cache cleared for key: ${key}, env: ${environment}`, {
      etagKey,
    });
  }

  /**
   * Update a KV item and clear cache
   */
  static async updateKV(
    key: string,
    value: string | null,
    userId: number,
    environment: string
  ): Promise<void> {
    await VarsModel.set(key, value, userId, environment);
    await this.clearCache(key, environment);

    // Publish change event with full data for direct SDK cache update
    await pubSubService.publishSDKEvent({
      type: 'vars.updated',
      data: { key, value, environment },
    });
  }
}
