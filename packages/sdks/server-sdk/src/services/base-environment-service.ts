/**
 * Base Service
 * Generic base class for services that handle per-token data caching.
 * Each API token maps to exactly one environment (1:1).
 * Cache key = token (or token hash) to isolate data per environment.
 *
 * DESIGN PRINCIPLES:
 * - Single-token mode (game servers): all methods use the default token automatically
 * - Multi-token mode (Edge): callers pass the target token explicitly
 * - Token is used as both the API auth header and the cache partition key
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
 * Abstract base class for token-aware services
 * @template T - The item type (e.g., GameWorld, Banner)
 * @template TResponse - The API response type
 * @template TId - The ID type for items (string or number)
 */
export abstract class BaseEnvironmentService<T, TResponse, TId = string | number> {
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
   * Default token — the primary apiToken from SDK config.
   * Used as cache key in single-token mode.
   */
  protected defaultToken: string;

  /**
   * Optional factory for multi-token mode.
   * When set, each token gets its own ApiClient with isolated ETag cache.
   */
  protected apiClientFactory?: ApiClientFactory;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultToken: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultToken = defaultToken;
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
   * Set ApiClientFactory for multi-token mode.
   * When set, listByEnvironment() uses the factory to get a per-token ApiClient.
   */
  setApiClientFactory(factory: ApiClientFactory): void {
    this.apiClientFactory = factory;
  }

  /**
   * Get the appropriate ApiClient for a given token.
   * Uses the factory if available, otherwise falls back to the default client.
   */
  protected getApiClient(token?: string): ApiClient {
    if (this.apiClientFactory) {
      return this.apiClientFactory.getClient(token);
    }
    return this.apiClient;
  }

  /**
   * Resolve token — returns provided token or default token
   */
  protected resolveToken(token?: string): string {
    return token || this.defaultToken;
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
  async initializeAsync(token?: string): Promise<void> {
    if (!this.storage) return;

    const resolvedToken = this.resolveToken(token);
    const cacheKey = this.getCacheKey(resolvedToken);
    const etagKey = this.getEtagKey(resolvedToken);
    const responseKey = this.getResponseKey(resolvedToken);

    try {
      const cachedJson = await this.storage.get(cacheKey);
      if (cachedJson) {
        const items = JSON.parse(cachedJson) as T[];
        if (Array.isArray(items)) {
          this.cachedByEnv.set(resolvedToken, items);
          this.logger.debug(
            `Loaded ${items.length} ${this.getServiceName()} items from local storage`
          );
        }
      }

      // Restore ETag + raw response body into ApiClient so 304 optimization works after process restart
      const cachedEtag = await this.storage.get(etagKey);
      const cachedResponseJson = this.storage ? await this.storage.get(responseKey) : null;
      if (cachedEtag && cachedResponseJson) {
        try {
          const endpoint = this.getEndpoint();
          const responseBody = JSON.parse(cachedResponseJson) as TResponse;
          this.apiClient.setCache(endpoint, cachedEtag, responseBody);
          this.logger.debug(`Restored ETag for ${this.getServiceName()} from local storage`);
        } catch {
          // Ignore parse errors; next fetch will repopulate the cache
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to load ${this.getServiceName()} from local storage`, {
        error: error.message,
      });
    }
  }

  /**
   * Fetch items using a specific token (API call + cache update)
   * In multi-token mode, uses the provided token for auth.
   */
  async listByEnvironment(token?: string): Promise<T[]> {
    const resolvedToken = this.resolveToken(token);
    const endpoint = this.getEndpoint();
    const client = this.getApiClient(resolvedToken);

    this.logger.debug(`Fetching ${this.getServiceName()}`);

    const response = await client.get<TResponse>(endpoint);

    // Safety check: if backend returns failure but we have local data
    const currentItems = this.cachedByEnv.get(resolvedToken) || [];

    if (!response.success || !response.data) {
      if (currentItems.length > 0) {
        this.logger.warn(
          `Failed to fetch ${this.getServiceName()} from backend, but local cache has data. Keeping local data.`,
          { error: response.error?.message }
        );
        return currentItems;
      }
      throw new Error(response.error?.message || `Failed to fetch ${this.getServiceName()}`);
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

    this.cachedByEnv.set(resolvedToken, items);

    // Persist data, raw response body, and ETag to local storage
    await this.persistCache(resolvedToken);
    await this.persistEtag(resolvedToken, endpoint, response.data);

    return items;
  }

  protected getCacheKey(token: string): string {
    return `${this.getServiceName()}_${this.hashToken(token)}_data`;
  }

  protected getEtagKey(token: string): string {
    return `${this.getServiceName()}_${this.hashToken(token)}_etag`;
  }

  protected getResponseKey(token: string): string {
    return `${this.getServiceName()}_${this.hashToken(token)}_response`;
  }

  /**
   * Hash a token for use as cache key (avoid storing raw tokens in file names)
   */
  private hashToken(token: string): string {
    // Simple hash: first 8 chars of a basic hash
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Fetch items for multiple tokens
   */
  async listByEnvironments(tokens: string[]): Promise<T[]> {
    this.logger.debug(`Fetching ${this.getServiceName()} for multiple tokens`, {
      count: tokens.length,
    });

    const results: T[] = [];

    for (const token of tokens) {
      try {
        const items = await this.listByEnvironment(token);
        results.push(...items);
      } catch (error) {
        this.logger.error(`Failed to fetch ${this.getServiceName()} for token`, {
          error,
        });
      }
    }

    this.logger.info(`${this.getServiceName()} fetched for all tokens`, {
      count: results.length,
      tokenCount: tokens.length,
    });

    return results;
  }

  /**
   * Get cached items for a specific token
   */
  getCached(token?: string): T[] {
    const resolvedToken = this.resolveToken(token);
    return this.cachedByEnv.get(resolvedToken) || [];
  }

  /**
   * Get all cached items across all tokens (flat array)
   */
  getAllCachedFlat(): T[] {
    return Array.from(this.cachedByEnv.values()).flat();
  }

  /**
   * Get all cached items organized by token (for debugging/monitoring)
   */
  getAllCached(): Map<string, T[]> {
    return this.cachedByEnv;
  }

  /**
   * Get list of cached tokens
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
   * Clear cached data for a specific token
   */
  clearCacheForEnvironment(token: string): void {
    this.cachedByEnv.delete(token);
    this.logger.debug(`${this.getServiceName()} cache cleared for token`);
  }

  /**
   * Refresh cached items for a specific token
   */
  async refreshByEnvironment(token?: string, suppressWarnings?: boolean): Promise<T[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshByEnvironment() called but feature is disabled`
      );
    }
    this.logger.info(`Refreshing ${this.getServiceName()} cache`);
    return await this.listByEnvironment(token);
  }

  /**
   * Refresh cached items for all cached tokens
   */
  async refreshAllEnvironments(suppressWarnings?: boolean): Promise<void> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshAllEnvironments() called but feature is disabled`
      );
    }
    const tokens = this.getCachedEnvironments();
    if (tokens.length === 0) {
      this.logger.debug(`${this.getServiceName()}: No tokens to refresh`);
      return;
    }

    for (const token of tokens) {
      try {
        await this.listByEnvironment(token);
      } catch (error) {
        this.logger.error(`Failed to refresh ${this.getServiceName()} for token`, { error });
      }
    }
  }

  /**
   * Update cache with new data
   */
  updateCache(items: T[], token?: string): void {
    const resolvedToken = this.resolveToken(token);
    this.cachedByEnv.set(resolvedToken, items);
    this.persistCache(resolvedToken).catch(() => {});
    this.logger.debug(`${this.getServiceName()} cache updated`, {
      count: items.length,
    });
  }

  /**
   * Update a single item in cache (immutable)
   */
  protected updateItemInCache(item: T, token?: string): void {
    const resolvedToken = this.resolveToken(token);
    const currentItems = this.cachedByEnv.get(resolvedToken) || [];
    const itemId = this.getItemId(item);

    const existsInCache = currentItems.some((i) => this.getItemId(i) === itemId);
    let newItems: T[];

    if (existsInCache) {
      newItems = currentItems.map((i) => (this.getItemId(i) === itemId ? item : i));
    } else {
      newItems = [...currentItems, item];
    }

    this.cachedByEnv.set(resolvedToken, newItems);
    this.persistCache(resolvedToken).catch(() => {});

    this.logger.debug(
      `Single ${this.getServiceName()} ${existsInCache ? 'updated' : 'added'} in cache`,
      { id: itemId }
    );
  }

  /**
   * Remove an item from cache by ID (immutable)
   */
  removeFromCache(id: TId, token?: string): void {
    const resolvedToken = this.resolveToken(token);
    const currentItems = this.cachedByEnv.get(resolvedToken) || [];
    const newItems = currentItems.filter((item) => this.getItemId(item) !== id);
    this.cachedByEnv.set(resolvedToken, newItems);
    this.persistCache(resolvedToken).catch(() => {});

    this.logger.debug(`${this.getServiceName()} removed from cache`, { id });
  }

  /**
   * Persist current cache for a token to local storage
   */
  protected async persistCache(token: string): Promise<void> {
    if (!this.storage) return;

    try {
      const items = this.cachedByEnv.get(token) || [];
      const cacheKey = this.getCacheKey(token);
      await this.storage.save(cacheKey, JSON.stringify(items));
    } catch (error: any) {
      this.logger.error(`Failed to persist ${this.getServiceName()} to local storage`, {
        error: error.message,
      });
    }
  }

  /**
   * Persist the current ETag and raw response body to local storage.
   */
  protected async persistEtag(
    token: string,
    endpoint: string,
    responseData?: TResponse
  ): Promise<void> {
    if (!this.storage) return;

    try {
      const etag = this.apiClient.getEtag(endpoint);
      if (!etag) return;

      const etagKey = this.getEtagKey(token);
      await this.storage.save(etagKey, etag);

      // Also persist the raw response body so we can restore bodyCache on restart
      if (responseData !== undefined) {
        const responseKey = this.getResponseKey(token);
        await this.storage.save(responseKey, JSON.stringify(responseData));
      }
    } catch (error: any) {
      this.logger.error(`Failed to persist ETag for ${this.getServiceName()} to local storage`, {
        error: error.message,
      });
    }
  }

  /**
   * Get the list of cached environment IDs
   */
  getEnvironmentIds(): string[] {
    return Array.from(this.cachedByEnv.keys());
  }
}
