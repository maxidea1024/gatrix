/**
 * Base Environment Service
 * Generic base class for services that handle per-environment data caching
 * Reduces code duplication across GameWorld, Banner, PopupNotice, Survey, etc.
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';

/**
 * Configuration for extracting items from API response
 */
export interface ItemExtractor<T, TResponse> {
  /** Extract items array from response */
  extractItems(response: TResponse): T[];
}

/**
 * Abstract base class for environment-aware services
 * @template T - The item type (e.g., GameWorld, Banner)
 * @template TResponse - The API response type
 * @template TId - The ID type for items (string or number)
 */
export abstract class BaseEnvironmentService<T, TResponse, TId = string | number> {
  protected apiClient: ApiClient;
  protected logger: Logger;
  protected defaultEnvironment: string;
  protected cachedByEnv: Map<string, T[]> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  // ==================== Abstract Methods (must be implemented by subclasses) ====================

  /** Get the API endpoint for a specific environment */
  protected abstract getEndpoint(environment: string): string;

  /** Extract items from API response */
  protected abstract extractItems(response: TResponse): T[];

  /** Get the service name for logging */
  protected abstract getServiceName(): string;

  /** Get the ID of an item */
  protected abstract getItemId(item: T): TId;

  // ==================== Common Implementation ====================

  /**
   * Fetch items for a specific environment
   */
  async listByEnvironment(environment: string): Promise<T[]> {
    const endpoint = this.getEndpoint(environment);

    this.logger.debug(`Fetching ${this.getServiceName()}`, { environment });

    const response = await this.apiClient.get<TResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || `Failed to fetch ${this.getServiceName()}`);
    }

    const items = this.extractItems(response.data);
    this.cachedByEnv.set(environment, items);

    this.logger.info(`${this.getServiceName()} fetched`, { count: items.length, environment });

    return items;
  }

  /**
   * Fetch items for multiple environments
   */
  async listByEnvironments(environments: string[]): Promise<T[]> {
    this.logger.debug(`Fetching ${this.getServiceName()} for multiple environments`, { environments });

    const results: T[] = [];

    for (const env of environments) {
      try {
        const items = await this.listByEnvironment(env);
        results.push(...items);
      } catch (error) {
        this.logger.error(`Failed to fetch ${this.getServiceName()} for environment ${env}`, { error });
      }
    }

    this.logger.info(`${this.getServiceName()} fetched for all environments`, {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Fetch items using default environment (for backward compatibility)
   */
  async list(): Promise<T[]> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached items
   * @param environment If omitted, returns all items as flat array
   */
  getCached(environment?: string): T[] {
    if (environment) {
      return this.cachedByEnv.get(environment) || [];
    }
    return Array.from(this.cachedByEnv.values()).flat();
  }

  /**
   * Get all cached items (all environments)
   */
  getAllCached(): Map<string, T[]> {
    return this.cachedByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedByEnv.clear();
    this.logger.debug(`${this.getServiceName()} cache cleared`);
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environment: string): void {
    this.cachedByEnv.delete(environment);
    this.logger.debug(`${this.getServiceName()} cache cleared for environment`, { environment });
  }

  /**
   * Refresh cached items for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<T[]> {
    this.logger.info(`Refreshing ${this.getServiceName()} cache`, { environment });
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached items using default environment (for backward compatibility)
   */
  async refresh(): Promise<T[]> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Update cache with new data
   */
  updateCache(items: T[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.cachedByEnv.set(envKey, items);
    this.logger.debug(`${this.getServiceName()} cache updated`, { environment: envKey, count: items.length });
  }

  /**
   * Update a single item in cache (immutable)
   */
  protected updateItemInCache(item: T, environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    const currentItems = this.cachedByEnv.get(envKey) || [];
    const itemId = this.getItemId(item);

    const existsInCache = currentItems.some(i => this.getItemId(i) === itemId);

    if (existsInCache) {
      const newItems = currentItems.map(i => this.getItemId(i) === itemId ? item : i);
      this.cachedByEnv.set(envKey, newItems);
      this.logger.debug(`Single ${this.getServiceName()} updated in cache`, { id: itemId, environment: envKey });
    } else {
      const newItems = [...currentItems, item];
      this.cachedByEnv.set(envKey, newItems);
      this.logger.debug(`Single ${this.getServiceName()} added to cache`, { id: itemId, environment: envKey });
    }
  }

  /**
   * Remove an item from cache by ID (immutable)
   */
  removeFromCache(id: TId, environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    const currentItems = this.cachedByEnv.get(envKey) || [];
    const newItems = currentItems.filter(item => this.getItemId(item) !== id);
    this.cachedByEnv.set(envKey, newItems);
    this.logger.debug(`${this.getServiceName()} removed from cache`, { id, environment: envKey });
  }

  /**
   * Get default environment
   */
  getDefaultEnvironment(): string {
    return this.defaultEnvironment;
  }
}

