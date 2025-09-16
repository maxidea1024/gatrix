import { EventEmitter } from 'events';
import logger from '../config/logger';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService extends EventEmitter {
  private static instance: CacheService;
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
    this.setupCleanupInterval();
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
   * Get cached data
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    this.cache.set(key, item);
    logger.debug(`Cache set: ${key}`);
  }

  /**
   * Delete cached data
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.info(`Cache deleted: ${key}`);
    } else {
      // logger.warn(`Cache delete attempted but key not found: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  /**
   * Delete cache by pattern
   */
  deleteByPattern(pattern: string): number {
    let deletedCount = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.debug(`Cache deleted by pattern ${pattern}: ${deletedCount} items`);
    }

    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validItems = 0;
    let expiredItems = 0;

    for (const [_key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        expiredItems++;
      } else {
        validItems++;
      }
    }

    return {
      totalItems: this.cache.size,
      validItems,
      expiredItems,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Setup cleanup interval to remove expired items
   */
  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000); // Run every minute
  }

  /**
   * Remove expired items
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cache cleanup: removed ${cleanedCount} expired items`);
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();
