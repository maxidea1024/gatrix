import { EventEmitter } from 'events';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { config } from '../config';
import { createLogger } from '../config/logger';

const logger = createLogger('CacheService');

export class CacheService extends EventEmitter {
  private static instance: CacheService;
  private cache: any = null;
  private l1Cache: Keyv | null = null;
  private l2Cache: Keyv | null = null;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes (밀리초)
  private initialized = false;

  constructor() {
    super();
    // 지연 초기화 - import 시점에서 실행하지 않음
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }



  /**
   * Initialize multi-layer cache with Keyv (Memory + Redis)
   */
  public async initializeCache(): Promise<void> {
    if (this.initialized) return;

    try {
      // L1: Memory cache (fastest)
      this.l1Cache = new Keyv();

      // L2: Redis cache (shared, persistent) - optional
      if (config.redis.host) {
        try {
          // Use @keyv/redis for proper Redis support
          const redisUrl = `redis://${config.redis.password ? `:${config.redis.password}@` : ''}${config.redis.host}:${config.redis.port}/${config.redis.db}`;
          const redisStore = new KeyvRedis(redisUrl);
          this.l2Cache = new Keyv({ store: redisStore });
          logger.info('Redis cache layer initialized');
        } catch (redisError) {
          logger.warn('Redis cache initialization failed, using memory only:', redisError);
          this.l2Cache = null;
        }
      }

      // Create unified cache interface
      this.cache = this.createUnifiedCache();
      this.initialized = true;

      if (this.l2Cache) {
        logger.info('Cache initialized with Keyv multi-layer (Memory + Redis)');
      } else {
        logger.info('Cache initialized with Keyv memory-only');
      }
    } catch (error) {
      logger.error('Failed to initialize Keyv cache:', error);
      throw error;
    }
  }

  /**
   * Create unified cache interface for multi-layer access
   */
  private createUnifiedCache(): any {
    return {
      get: async (key: string) => {
        if (!this.l1Cache) return undefined;

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
        if (!this.l1Cache) return false;

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
        if (!this.l1Cache) return false;

        // Delete from L1 (memory)
        await this.l1Cache.delete(key);

        // Delete from L2 (redis) if available
        if (this.l2Cache) {
          await this.l2Cache.delete(key);
        }

        return true;
      },

      clear: async () => {
        if (!this.l1Cache) return;

        // Clear L1 (memory)
        await this.l1Cache.clear();

        // Clear L2 (redis) if available
        if (this.l2Cache) {
          await this.l2Cache.clear();
        }
      }
    };
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
    instance.set<T>(key, data, ttlMs);
  }

  /**
   * Static del method
   */
  public static async del(key: string): Promise<void> {
    const instance = CacheService.getInstance();
    instance.delete(key);
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
      if (!this.initialized) await this.initializeCache();
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
      if (!this.initialized) await this.initializeCache();
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
   * Get keys by pattern (not supported in Keyv)
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      // Keyv doesn't support pattern matching
      logger.warn(`Pattern matching not supported in Keyv: ${pattern}`);
      return [];
    } catch (error) {
      logger.error(`Cache pattern search error for ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.cache.clear();
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.cache.get(key);
      return value !== undefined && value !== null;
    } catch (error) {
      logger.error(`Cache has error for key ${key}:`, error);
      return false;
    }
  }
}
