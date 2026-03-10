/**
 * Base Service
 * Generic base class for services that handle per-environment data caching.
 *
 * DESIGN PRINCIPLES:
 * - Cache key = environmentId (NEVER token)
 * - Token is only used for API authentication (via ApiClientFactory)
 * - Single-environment mode (game servers): all methods use the default environment automatically
 * - Multi-environment mode (Edge): callers pass the target environmentId explicitly
 */

import { ApiClient } from '../client/api-client';
import { ApiClientFactory } from '../client/api-client-factory';
import { Logger } from '../utils/logger';
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
export abstract class BaseEnvironmentService<
  T,
  TResponse,
  TId = string | number,
> {
  protected apiClient: ApiClient;
  protected logger: Logger;
  protected storage?: CacheStorageProvider;
  protected cachedByEnv: Map<string, T[]> = new Map();
  /**
   * Whether this feature is enabled.
   * Set by CacheManager based on SDK configuration.
   */
  protected featureEnabled: boolean = true;

  /**
   * Default environment ID — the primary environment for this SDK instance.
   * In single-environment mode, this is the apiToken (resolved later to real environmentId).
   */
  protected defaultEnvironmentId: string;

  /**
   * Optional factory for multi-environment mode.
   * When set, each environment gets its own ApiClient with isolated ETag cache.
   */
  protected apiClientFactory?: ApiClientFactory;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironmentId = defaultEnvironmentId;
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
   * Set ApiClientFactory for multi-environment mode.
   * When set, listByEnvironment() uses the factory to get a per-environment ApiClient.
   */
  setApiClientFactory(factory: ApiClientFactory): void {
    this.apiClientFactory = factory;
  }

  /**
   * Get the appropriate ApiClient for a given environment.
   * Uses the factory if available, otherwise falls back to the default client.
   */
  protected getApiClient(environmentId?: string): ApiClient {
    if (this.apiClientFactory) {
      return this.apiClientFactory.getClient(environmentId);
    }
    return this.apiClient;
  }

  /**
   * Resolve environment — returns provided environmentId or default
   */
  protected resolveEnvironment(environmentId?: string): string {
    return environmentId || this.defaultEnvironmentId;
  }

  // ==================== Abstract Methods (must be implemented by subclasses) ====================

  /** Get the API endpoint */
  protected abstract getEndpoint(): string;

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
  async initializeAsync(environmentId?: string): Promise<void> {
    if (!this.storage) return;

    const resolvedEnv = this.resolveEnvironment(environmentId);
    const cacheKey = this.getCacheKey(resolvedEnv);
    const etagKey = this.getEtagKey(resolvedEnv);
    const responseKey = this.getResponseKey(resolvedEnv);

    try {
      const cachedJson = await this.storage.get(cacheKey);
      if (cachedJson) {
        const items = JSON.parse(cachedJson) as T[];
        if (Array.isArray(items)) {
          this.cachedByEnv.set(resolvedEnv, items);
          this.logger.debug(
            `Loaded ${items.length} ${this.getServiceName()} items from local storage`
          );
        }
      }

      // Restore ETag + raw response body into ApiClient so 304 optimization works after process restart
      const cachedEtag = await this.storage.get(etagKey);
      const cachedResponseJson = this.storage
        ? await this.storage.get(responseKey)
        : null;
      if (cachedEtag && cachedResponseJson) {
        try {
          const endpoint = this.getEndpoint();
          const responseBody = JSON.parse(cachedResponseJson) as TResponse;
          this.apiClient.setCache(endpoint, cachedEtag, responseBody);
          this.logger.debug(
            `Restored ETag for ${this.getServiceName()} from local storage`
          );
        } catch {
          // Ignore parse errors; next fetch will repopulate the cache
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to load ${this.getServiceName()} from local storage`,
        {
          error: error.message,
        }
      );
    }
  }

  /**
   * Fetch items using a specific environment (API call + cache update)
   * In multi-environment mode, uses the environment's associated token for auth.
   */
  async listByEnvironment(environmentId?: string): Promise<T[]> {
    const resolvedEnv = this.resolveEnvironment(environmentId);
    const endpoint = this.getEndpoint();
    const client = this.getApiClient(resolvedEnv);

    this.logger.debug(`Fetching ${this.getServiceName()}`);

    const response = await client.get<TResponse>(endpoint);

    // Safety check: if backend returns failure but we have local data
    const currentItems = this.cachedByEnv.get(resolvedEnv) || [];

    if (!response.success || !response.data) {
      if (currentItems.length > 0) {
        this.logger.warn(
          `Failed to fetch ${this.getServiceName()} from backend, but local cache has data. Keeping local data.`,
          { error: response.error?.message }
        );
        return currentItems;
      }
      throw new Error(
        response.error?.message || `Failed to fetch ${this.getServiceName()}`
      );
    }

    const items = this.extractItems(response.data);

    if (items.length === 0 && currentItems.length > 0) {
      this.logger.warn(
        `${this.getServiceName()} received empty list from backend, but local cache has data. Keeping local data.`,
        { localCount: currentItems.length }
      );
      return currentItems;
    }

    this.logger.info(`${this.getServiceName()} received from backend`, {
      itemCount: items.length,
    });

    this.cachedByEnv.set(resolvedEnv, items);

    // Persist data, raw response body, and ETag to local storage
    await this.persistCache(resolvedEnv);
    await this.persistEtag(resolvedEnv, endpoint, response.data);

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
  async listByEnvironments(environmentIds: string[]): Promise<T[]> {
    this.logger.debug(
      `Fetching ${this.getServiceName()} for multiple environments`,
      {
        count: environmentIds.length,
      }
    );

    const results: T[] = [];

    for (const envId of environmentIds) {
      try {
        const items = await this.listByEnvironment(envId);
        results.push(...items);
      } catch (error) {
        this.logger.error(
          `Failed to fetch ${this.getServiceName()} for environment`,
          {
            error,
          }
        );
      }
    }

    this.logger.info(`${this.getServiceName()} fetched for all environments`, {
      count: results.length,
      environmentCount: environmentIds.length,
    });

    return results;
  }

  /**
   * Get cached items for a specific environment
   */
  getCached(environmentId?: string): T[] {
    const resolvedEnv = this.resolveEnvironment(environmentId);
    return this.cachedByEnv.get(resolvedEnv) || [];
  }

  /**
   * Get all cached items across all environments (flat array)
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
   * Get list of cached environment IDs
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
    this.logger.debug(`${this.getServiceName()} cache cleared for environment`);
  }

  /**
   * Refresh cached items for a specific environment
   */
  async refreshByEnvironment(
    environmentId?: string,
    suppressWarnings?: boolean
  ): Promise<T[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshByEnvironment() called but feature is disabled`
      );
    }
    this.logger.info(`Refreshing ${this.getServiceName()} cache`);
    return await this.listByEnvironment(environmentId);
  }

  /**
   * Refresh cached items for all cached environments
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

    for (const envId of environments) {
      try {
        await this.listByEnvironment(envId);
      } catch (error) {
        this.logger.error(
          `Failed to refresh ${this.getServiceName()} for environment`,
          { error }
        );
      }
    }
  }

  /**
   * Update cache with new data
   */
  updateCache(items: T[], environmentId?: string): void {
    const resolvedEnv = this.resolveEnvironment(environmentId);
    this.cachedByEnv.set(resolvedEnv, items);
    this.persistCache(resolvedEnv).catch(() => {});
    this.logger.debug(`${this.getServiceName()} cache updated`, {
      count: items.length,
    });
  }

  /**
   * Update a single item in cache (immutable)
   */
  protected updateItemInCache(item: T, environmentId?: string): void {
    const resolvedEnv = this.resolveEnvironment(environmentId);
    const currentItems = this.cachedByEnv.get(resolvedEnv) || [];
    const itemId = this.getItemId(item);

    const existsInCache = currentItems.some(
      (i) => this.getItemId(i) === itemId
    );
    let newItems: T[];

    if (existsInCache) {
      newItems = currentItems.map((i) =>
        this.getItemId(i) === itemId ? item : i
      );
    } else {
      newItems = [...currentItems, item];
    }

    this.cachedByEnv.set(resolvedEnv, newItems);
    this.persistCache(resolvedEnv).catch(() => {});

    this.logger.debug(
      `Single ${this.getServiceName()} ${existsInCache ? 'updated' : 'added'} in cache`,
      { id: itemId }
    );
  }

  /**
   * Remove an item from cache by ID (immutable)
   */
  removeFromCache(id: TId, environmentId?: string): void {
    const resolvedEnv = this.resolveEnvironment(environmentId);
    const currentItems = this.cachedByEnv.get(resolvedEnv) || [];
    const newItems = currentItems.filter((item) => this.getItemId(item) !== id);
    this.cachedByEnv.set(resolvedEnv, newItems);
    this.persistCache(resolvedEnv).catch(() => {});

    this.logger.debug(`${this.getServiceName()} removed from cache`, { id });
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
      this.logger.error(
        `Failed to persist ${this.getServiceName()} to local storage`,
        {
          error: error.message,
        }
      );
    }
  }

  /**
   * Persist the current ETag and raw response body to local storage.
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
      this.logger.error(
        `Failed to persist ETag for ${this.getServiceName()} to local storage`,
        {
          error: error.message,
        }
      );
    }
  }

  /**
   * Get the list of cached environment IDs
   */
  getEnvironmentIds(): string[] {
    return Array.from(this.cachedByEnv.keys());
  }
}
