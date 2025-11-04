import { EventEmitter } from 'events';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import logger from '../config/logger';
import { config } from '../config/index';

export class CacheService extends EventEmitter {
  private static instance: CacheService;
  private cache!: any;
  private l1Cache!: Keyv; // Memory cache
  private l2Cache?: Keyv; // Redis cache
  private defaultTTL?: number; // No default TTL by default (persist cache unless explicitly provided)

  private keyRegistry: Set<string> = new Set(); // Track all cache keys

  constructor() {
    super();
    this.initializeCache();
  }

  /**
   * Initialize multi-layer cache with Keyv (Memory + Redis)
   */
  private initializeCache(): void {
    try {
      // L1: Memory cache (fastest)
      this.l1Cache = new Keyv();

      // L2: Redis cache (shared, persistent)
      try {
        const redisUrl = `redis://${config.redis.host}:${config.redis.port}`;
        this.l2Cache = new Keyv({
          store: new KeyvRedis(redisUrl),
        });
        logger.info('Redis cache initialized', { url: redisUrl });
      } catch (error) {
        logger.warn('Failed to initialize Redis cache, using memory cache only', { error });
        this.l2Cache = undefined;
      }

      // Create unified cache interface
      this.cache = this.createUnifiedCache();

      logger.info('Cache initialized with Keyv memory + Redis cache');
    } catch (error) {
      logger.error('Failed to initialize cache:', error);
      throw error;
    }
  }

  /**
   * Create unified cache interface for multi-layer access
   */
  private createUnifiedCache(): any {
    return {
      get: async (key: string) => {
        // Try L1 (memory) first
        let value = await this.l1Cache.get(key);
        if (value !== undefined) {
          return value;
        }

        // Try L2 (redis) if available and L1 miss
        if (this.l2Cache) {
          value = await this.l2Cache.get(key);
          if (value !== undefined) {
            // Populate L1 cache
            await this.l1Cache.set(key, value);
            return value;
          }
        }

        return undefined;
      },

      set: async (key: string, value: any, ttl?: number) => {
        const cacheTTL = ttl;

        // Track key in registry
        this.keyRegistry.add(key);

        // Set in L1 (memory) always
        await this.l1Cache.set(key, value, cacheTTL);

        // Set in L2 (redis) if available
        if (this.l2Cache) {
          await this.l2Cache.set(key, value, cacheTTL);
        }

        return true;
      },

      delete: async (key: string) => {
        // Remove from registry
        this.keyRegistry.delete(key);

        // Delete from L1 (memory)
        await this.l1Cache.delete(key);

        // Delete from L2 (redis) if available
        if (this.l2Cache) {
          await this.l2Cache.delete(key);
        }

        return true;
      },

      clear: async () => {
        // Clear registry
        this.keyRegistry.clear();

        // Clear L1 (memory)
        await this.l1Cache.clear();

        // Clear L2 (redis) if available
        if (this.l2Cache) {
          await this.l2Cache.clear();
        }
      }
    };
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Static get method
   */
  public static async get<T>(key: string): Promise<T | null> {
    const instance = CacheService.getInstance();
    return instance.get<T>(key);
  }

  /**
   * Static set method
   */
  public static async set<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    const instance = CacheService.getInstance();
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : undefined;
    await instance.set<T>(key, data, ttlMs);
  }

  /**
   * Static del method
   */
  public static async del(key: string): Promise<void> {
    const instance = CacheService.getInstance();
    await instance.delete(key);
  }

  /**
   * Static delete method (alias for del)
   */
  public static async delete(key: string): Promise<void> {
    return CacheService.del(key);
  }

  /**
   * Static method to get keys by pattern
   */
  public static async getKeysByPattern(pattern: string): Promise<string[]> {
    const instance = CacheService.getInstance();
    return instance.getKeysByPattern(pattern);
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cache.get(key);
      return value || null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      await this.cache.set(key, data, ttl);
      logger.debug(`Cache set: ${key}`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Set cached data explicitly without TTL (persistent)
   * This bypasses any default TTL configured on Keyv instances.
   */
  async setWithoutTTL<T>(key: string, data: T): Promise<void> {
    try {
      // Track key in registry
      this.keyRegistry.add(key);

      // Temporarily disable default TTL for L1, set value, then restore
      const l1Any: any = this.l1Cache as any;
      const prevL1Ttl = l1Any?.opts?.ttl;
      if (l1Any?.opts) l1Any.opts.ttl = undefined;
      await this.l1Cache.set(key, data);
      if (l1Any?.opts) l1Any.opts.ttl = prevL1Ttl;

      // Do the same for L2 (Redis) if available
      if (this.l2Cache) {
        const l2Any: any = this.l2Cache as any;
        const prevL2Ttl = l2Any?.opts?.ttl;
        if (l2Any?.opts) l2Any.opts.ttl = undefined;
        await this.l2Cache.set(key, data);
        if (l2Any?.opts) l2Any.opts.ttl = prevL2Ttl;
      }

      logger.debug(`Cache set (no TTL): ${key}`);
    } catch (error) {
      logger.error(`Cache set (no TTL) error for key ${key}:`, error);
    }
  }

  /**
   * Persist existing key by re-setting without TTL.
   * Returns true if key existed and was persisted, false otherwise.
   */
  async persistKey(key: string): Promise<boolean> {
    try {
      const current = await this.cache.get(key);
      if (current === undefined) return false;
      await this.setWithoutTTL(key, current);
      return true;
    } catch (error) {
      logger.error(`Cache persistKey error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Persist multiple keys by re-setting without TTL.
   * Returns number of keys successfully persisted.
   */
  async persistKeys(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      const ok = await this.persistKey(key);
      if (ok) count++;
    }
    return count;
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.cache.delete(key);
      logger.info(`Cache deleted: ${key}`);
      return result;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.cache.clear();
      logger.debug('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Delete cache by pattern
   * Supports wildcard patterns like 'client_version:*'
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      let deletedCount = 0;

      // Convert wildcard pattern to regex
      // e.g., 'client_version:*' -> /^client_version:.*/
      const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

      // Get all keys from registry that match the pattern
      const keysToDelete: string[] = [];
      for (const key of this.keyRegistry) {
        if (regexPattern.test(key)) {
          keysToDelete.push(key);
        }
      }

      // Delete matching keys
      for (const key of keysToDelete) {
        await this.cache.delete(key);
        deletedCount++;
      }

      logger.info(`Cache pattern deletion: ${pattern} - ${deletedCount} keys deleted`);
      return deletedCount;
    } catch (error) {
      logger.error(`Cache pattern delete error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics (limited in cache-manager)
   */
  async getStats() {
    try {
      return {
        totalItems: 'unknown', // cache-manager doesn't expose size
        validItems: 'unknown',
        expiredItems: 'unknown',
        memoryUsage: process.memoryUsage()
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {
        totalItems: 0,
        validItems: 0,
        expiredItems: 0,
        memoryUsage: process.memoryUsage()
      };
    }
  }

  /**
   * Get keys by pattern (limited support in cache-manager)
   */
  public async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      // cache-manager doesn't support pattern matching directly
      logger.warn(`Pattern matching not fully supported: ${pattern}`);
      return [];
    } catch (error) {
      logger.error(`Cache pattern search error for ${pattern}:`, error);
      return [];
    }
  }


}

// Singleton instance
export const cacheService = new CacheService();
