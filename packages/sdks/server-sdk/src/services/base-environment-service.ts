/**
 * Base Environment Service
 * Generic base class for services that handle per-environment data caching
 * Reduces code duplication across GameWorld, Banner, PopupNotice, Survey, etc.
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly
 * - Environment resolution is delegated to EnvironmentResolver
 * - In multi-environment mode (edge), environment MUST always be provided
 * - Services use EnvironmentResolver for consistent environment handling
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { EnvironmentResolver } from '../utils/environment-resolver';
import { CacheStorageProvider } from '../cache/storage-provider';

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
  protected envResolver: EnvironmentResolver;
  protected storage?: CacheStorageProvider;
  protected cachedByEnv: Map<string, T[]> = new Map();
  /**
   * Whether this feature is enabled.
   * Set by CacheManager based on SDK configuration.
   */
  protected featureEnabled: boolean = true;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    envResolver: EnvironmentResolver,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.envResolver = envResolver;
    this.storage = storage;
  }

  /**
   * Set feature enabled flag
   * When false, refresh methods will log a warning
   */
  setFeatureEnabled(enabled: boolean): void {
    this.featureEnabled = enabled;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  /**
   * Resolve environment using EnvironmentResolver
   * @param environment Optional environment parameter
   * @param methodName Method name for error messages
   */
  protected resolveEnvironment(environmentId?: string, methodName?: string): string {
    const context = methodName ? `${this.getServiceName()}.${methodName}` : this.getServiceName();
    return this.envResolver.resolve(environmentId, context);
  }

  // ==================== Abstract Methods (must be implemented by subclasses) ====================

  /** Get the API endpoint for a specific environment */
  protected abstract getEndpoint(environmentId: string): string;

  /** Extract items from API response */
  protected abstract extractItems(response: TResponse): T[];

  /** Get the service name for logging */
  protected abstract getServiceName(): string;

  /** Get the ID of an item */
  protected abstract getItemId(item: T): TId;

  // ==================== Common Implementation ====================

  /**
   * Initialize the service by loading data from local storage
   */
  async initializeAsync(environmentId: string): Promise<void> {
    if (!this.storage) return;

    const cacheKey = this.getCacheKey(environmentId);
    const etagKey = this.getEtagKey(environmentId);
    const responseKey = this.getResponseKey(environmentId);

    try {
      const cachedJson = await this.storage.get(cacheKey);
      if (cachedJson) {
        const items = JSON.parse(cachedJson) as T[];
        if (Array.isArray(items)) {
          this.cachedByEnv.set(environmentId, items);
          this.logger.debug(
            `Loaded ${items.length} ${this.getServiceName()} items from local storage`,
            {
              environmentId,
            }
          );
        }
      }

      // Restore ETag + raw response body into ApiClient so 304 optimization works after process restart
      const cachedEtag = await this.storage.get(etagKey);
      const cachedResponseJson = this.storage ? await this.storage.get(responseKey) : null;
      if (cachedEtag && cachedResponseJson) {
        try {
          const endpoint = this.getEndpoint(environmentId);
          const responseBody = JSON.parse(cachedResponseJson) as TResponse;
          this.apiClient.setCache(endpoint, cachedEtag, responseBody);
          this.logger.debug(`Restored ETag for ${this.getServiceName()} from local storage`, {
            environmentId,
          });
        } catch {
          // Ignore parse errors; next fetch will repopulate the cache
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to load ${this.getServiceName()} from local storage`, {
        environmentId,
        error: error.message,
      });
    }
  }

  /**
   * Fetch items for a specific environment (local + remote)
   */
  async listByEnvironment(environmentId: string): Promise<T[]> {
    const endpoint = this.getEndpoint(environmentId);

    this.logger.debug(`Fetching ${this.getServiceName()}`, { environmentId });

    // Note: ApiClient handles ETag/304 internally via its bodyCache
    const response = await this.apiClient.get<TResponse>(endpoint);

    // Safety check: if backend returns failure or empty list but we already have local data,
    // be careful about overwriting it during the initial sync or temporary backend issues.
    const currentItems = this.cachedByEnv.get(environmentId) || [];

    if (!response.success || !response.data) {
      if (currentItems.length > 0) {
        this.logger.warn(
          `Failed to fetch ${this.getServiceName()} from backend, but local cache has data. Keeping local data for now to avoid outage.`,
          {
            environmentId,
            error: response.error?.message,
          }
        );
        return currentItems;
      }
      throw new Error(response.error?.message || `Failed to fetch ${this.getServiceName()}`);
    }

    const items = this.extractItems(response.data);

    if (items.length === 0 && currentItems.length > 0) {
      this.logger.warn(
        `${this.getServiceName()} received empty list from backend, but local cache has data. Keeping local data for now to avoid outage.`,
        {
          environmentId,
          localCount: currentItems.length,
        }
      );
      return currentItems;
    }

    this.logger.info(`${this.getServiceName()} received from backend`, {
      environmentId,
      itemCount: items.length,
    });

    this.cachedByEnv.set(environmentId, items);

    // Persist data, raw response body, and ETag to local storage
    await this.persistCache(environmentId);
    await this.persistEtag(environmentId, endpoint, response.data);

    return items;
  }

  protected getCacheKey(environmentId: string): string {
    return `${this.getServiceName()}_${environmentId}_data`;
  }

  protected getEtagKey(environmentId: string): string {
    return `${this.getServiceName()}_${environmentId}_etag`;
  }

  protected getResponseKey(environmentId: string): string {
    return `${this.getServiceName()}_${environmentId}_response`;
  }

  /**
   * Fetch items for multiple environments
   */
  async listByEnvironments(environments: string[]): Promise<T[]> {
    this.logger.debug(`Fetching ${this.getServiceName()} for multiple environments`, {
      environments,
    });

    const results: T[] = [];

    for (const env of environments) {
      try {
        const items = await this.listByEnvironment(env);
        results.push(...items);
      } catch (error) {
        this.logger.error(`Failed to fetch ${this.getServiceName()} for environment ${env}`, {
          error,
        });
      }
    }

    this.logger.info(`${this.getServiceName()} fetched for all environments`, {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Get cached items for a specific environment
   * @param environment Environment name (required)
   */
  getCached(environmentId: string): T[] {
    return this.cachedByEnv.get(environmentId) || [];
  }

  /**
   * Get all cached items across all environments (for internal use)
   * Returns a flat array of all items
   */
  getAllCachedFlat(): T[] {
    return Array.from(this.cachedByEnv.values()).flat();
  }

  /**
   * Get all cached items organized by environment (for debugging/monitoring)
   */
  getAllCached(): Map<string, T[]> {
    return this.cachedByEnv;
  }

  /**
   * Get list of cached environments
   */
  getCachedEnvironments(): string[] {
    return Array.from(this.cachedByEnv.keys());
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
  clearCacheForEnvironment(environmentId: string): void {
    this.cachedByEnv.delete(environmentId);
    this.logger.debug(`${this.getServiceName()} cache cleared for environment`, { environmentId });
  }

  /**
   * Refresh cached items for a specific environment
   * @param environment Environment name
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(environmentId: string, suppressWarnings?: boolean): Promise<T[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshByEnvironment() called but feature is disabled`,
        { environmentId }
      );
    }
    this.logger.info(`Refreshing ${this.getServiceName()} cache`, {
      environmentId,
    });
    return await this.listByEnvironment(environmentId);
  }

  /**
   * Refresh cached items for all cached environments
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshAllEnvironments(suppressWarnings?: boolean): Promise<void> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshAllEnvironments() called but feature is disabled`
      );
    }
    const environments = this.getCachedEnvironments();
    if (environments.length === 0) {
      this.logger.debug(`${this.getServiceName()}: No environments to refresh`);
      return;
    }

    await this.listByEnvironments(environments);
  }

  /**
   * Update cache with new data
   * @param items Items to cache
   * @param environment Environment name (required)
   */
  updateCache(items: T[], environmentId: string): void {
    this.cachedByEnv.set(environmentId, items);
    this.persistCache(environmentId).catch(() => {});
    this.logger.debug(`${this.getServiceName()} cache updated`, {
      environmentId,
      count: items.length,
    });
  }

  /**
   * Update a single item in cache (immutable)
   * @param item Item to update/add
   * @param environment Environment name (required)
   */
  protected updateItemInCache(item: T, environmentId: string): void {
    const currentItems = this.cachedByEnv.get(environmentId) || [];
    const itemId = this.getItemId(item);

    const existsInCache = currentItems.some((i) => this.getItemId(i) === itemId);
    let newItems: T[];

    if (existsInCache) {
      newItems = currentItems.map((i) => (this.getItemId(i) === itemId ? item : i));
    } else {
      newItems = [...currentItems, item];
    }

    this.cachedByEnv.set(environmentId, newItems);
    this.persistCache(environmentId).catch(() => {});

    this.logger.debug(
      `Single ${this.getServiceName()} ${existsInCache ? 'updated' : 'added'} in cache`,
      {
        id: itemId,
        environmentId,
      }
    );
  }

  /**
   * Remove an item from cache by ID (immutable)
   * @param id Item ID to remove
   * @param environment Environment name (required)
   */
  removeFromCache(id: TId, environmentId: string): void {
    const currentItems = this.cachedByEnv.get(environmentId) || [];
    const newItems = currentItems.filter((item) => this.getItemId(item) !== id);
    this.cachedByEnv.set(environmentId, newItems);
    this.persistCache(environmentId).catch(() => {});

    this.logger.debug(`${this.getServiceName()} removed from cache`, {
      id,
      environmentId,
    });
  }

  /**
   * Persist current cache for an environment to local storage
   */
  protected async persistCache(environmentId: string): Promise<void> {
    if (!this.storage) return;

    try {
      const items = this.cachedByEnv.get(environmentId) || [];
      const cacheKey = this.getCacheKey(environmentId);
      await this.storage.save(cacheKey, JSON.stringify(items));
    } catch (error: any) {
      this.logger.error(`Failed to persist ${this.getServiceName()} to local storage`, {
        environmentId,
        error: error.message,
      });
    }
  }

  /**
   * Persist the current ETag and raw response body for an environment to local storage.
   * Called after a successful fetch so the ETag survives process restarts.
   */
  protected async persistEtag(
    environmentId: string,
    endpoint: string,
    responseData?: TResponse
  ): Promise<void> {
    if (!this.storage) return;

    try {
      const etag = this.apiClient.getEtag(endpoint);
      if (!etag) return;

      const etagKey = this.getEtagKey(environmentId);
      await this.storage.save(etagKey, etag);

      // Also persist the raw response body so we can restore bodyCache on restart
      if (responseData !== undefined) {
        const responseKey = this.getResponseKey(environmentId);
        await this.storage.save(responseKey, JSON.stringify(responseData));
      }
    } catch (error: any) {
      this.logger.error(`Failed to persist ETag for ${this.getServiceName()} to local storage`, {
        environmentId,
        error: error.message,
      });
    }
  }

  /**
   * Get default environment (for single-environment mode)
   */
  getDefaultEnvironment(): string {
    return this.envResolver.getDefaultEnvironment();
  }

  /**
   * Check if running in multi-environment mode
   */
  isMultiEnvironmentMode(): boolean {
    return this.envResolver.isMultiEnvironmentMode();
  }
}
