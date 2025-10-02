import { EventEmitter } from 'events';
import Keyv from 'keyv';
import logger from '../config/logger';

export class CacheService extends EventEmitter {
  private static instance: CacheService;
  private cache!: any;
  private l1Cache!: Keyv; // Memory cache
  private l2Cache?: Keyv; // Redis cache
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

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

      // L2: Redis cache (shared, persistent) - optional
      // Backend typically doesn't need Redis cache, but keeping for consistency
      // You can add Redis config here if needed

      // Create unified cache interface
      this.cache = this.createUnifiedCache();

      logger.info('Cache initialized with Keyv memory cache');
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
            await this.l1Cache.set(key, value, this.defaultTTL);
            return value;
          }
        }

        return undefined;
      },

      set: async (key: string, value: any, ttl?: number) => {
        const cacheTTL = ttl || this.defaultTTL;

        // Set in L1 (memory) always
        await this.l1Cache.set(key, value, cacheTTL);

        // Set in L2 (redis) if available
        if (this.l2Cache) {
          await this.l2Cache.set(key, value, cacheTTL);
        }

        return true;
      },

      delete: async (key: string) => {
        // Delete from L1 (memory)
        await this.l1Cache.delete(key);

        // Delete from L2 (redis) if available
        if (this.l2Cache) {
          await this.l2Cache.delete(key);
        }

        return true;
      },

      clear: async () => {
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
      await this.cache.set(key, data, ttl || this.defaultTTL);
      logger.debug(`Cache set: ${key}`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
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
   * Delete cache by pattern (limited support in cache-manager)
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      // cache-manager doesn't support pattern deletion directly
      logger.warn(`Pattern deletion not fully supported: ${pattern}`);
      return 0;
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
