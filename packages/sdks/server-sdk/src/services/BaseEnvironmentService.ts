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

import { ApiClient } from "../client/ApiClient";
import { Logger } from "../utils/logger";
import { EnvironmentResolver } from "../utils/EnvironmentResolver";

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
  protected envResolver: EnvironmentResolver;
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
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.envResolver = envResolver;
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
  protected resolveEnvironment(
    environment?: string,
    methodName?: string,
  ): string {
    const context = methodName
      ? `${this.getServiceName()}.${methodName}`
      : this.getServiceName();
    return this.envResolver.resolve(environment, context);
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
      throw new Error(
        response.error?.message || `Failed to fetch ${this.getServiceName()}`,
      );
    }

    const items = this.extractItems(response.data);
    this.cachedByEnv.set(environment, items);

    this.logger.info(`${this.getServiceName()} fetched`, {
      count: items.length,
      environment,
    });

    return items;
  }

  /**
   * Fetch items for multiple environments
   */
  async listByEnvironments(environments: string[]): Promise<T[]> {
    this.logger.debug(
      `Fetching ${this.getServiceName()} for multiple environments`,
      { environments },
    );

    const results: T[] = [];

    for (const env of environments) {
      try {
        const items = await this.listByEnvironment(env);
        results.push(...items);
      } catch (error) {
        this.logger.error(
          `Failed to fetch ${this.getServiceName()} for environment ${env}`,
          { error },
        );
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
  getCached(environment: string): T[] {
    return this.cachedByEnv.get(environment) || [];
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
  clearCacheForEnvironment(environment: string): void {
    this.cachedByEnv.delete(environment);
    this.logger.debug(
      `${this.getServiceName()} cache cleared for environment`,
      { environment },
    );
  }

  /**
   * Refresh cached items for a specific environment
   * @param environment Environment name
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    environment: string,
    suppressWarnings?: boolean,
  ): Promise<T[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshByEnvironment() called but feature is disabled`,
        { environment },
      );
    }
    this.logger.info(`Refreshing ${this.getServiceName()} cache`, {
      environment,
    });
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached items for all cached environments
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshAllEnvironments(suppressWarnings?: boolean): Promise<void> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshAllEnvironments() called but feature is disabled`,
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
  updateCache(items: T[], environment: string): void {
    this.cachedByEnv.set(environment, items);
    this.logger.debug(`${this.getServiceName()} cache updated`, {
      environment,
      count: items.length,
    });
  }

  /**
   * Update a single item in cache (immutable)
   * @param item Item to update/add
   * @param environment Environment name (required)
   */
  protected updateItemInCache(item: T, environment: string): void {
    const currentItems = this.cachedByEnv.get(environment) || [];
    const itemId = this.getItemId(item);

    const existsInCache = currentItems.some(
      (i) => this.getItemId(i) === itemId,
    );

    if (existsInCache) {
      const newItems = currentItems.map((i) =>
        this.getItemId(i) === itemId ? item : i,
      );
      this.cachedByEnv.set(environment, newItems);
      this.logger.debug(`Single ${this.getServiceName()} updated in cache`, {
        id: itemId,
        environment,
      });
    } else {
      const newItems = [...currentItems, item];
      this.cachedByEnv.set(environment, newItems);
      this.logger.debug(`Single ${this.getServiceName()} added to cache`, {
        id: itemId,
        environment,
      });
    }
  }

  /**
   * Remove an item from cache by ID (immutable)
   * @param id Item ID to remove
   * @param environment Environment name (required)
   */
  removeFromCache(id: TId, environment: string): void {
    const currentItems = this.cachedByEnv.get(environment) || [];
    const newItems = currentItems.filter((item) => this.getItemId(item) !== id);
    this.cachedByEnv.set(environment, newItems);
    this.logger.debug(`${this.getServiceName()} removed from cache`, {
      id,
      environment,
    });
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
