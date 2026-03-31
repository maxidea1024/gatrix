/**
 * Base Project Service
 * Generic base class for services that handle per-project data caching.
 *
 * DESIGN PRINCIPLES:
 * - Cache key = projectId (NOT environmentId, NOT token)
 * - Uses the default ApiClient for API calls (project-scoped data
 *   does not need per-environment clients)
 * - Single-environment mode (game servers): uses the resolved projectId
 * - Multi-environment mode (Edge): same — one cache entry per project
 */

import { ApiClient } from '../client/api-client';
import { ApiClientFactory } from '../client/api-client-factory';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';

/**
 * Abstract base class for project-scoped services
 * @template T - The item type (e.g., ClientVersion)
 * @template TResponse - The API response type
 * @template TId - The ID type for items (string or number)
 */
export abstract class BaseProjectService<
  T,
  TResponse,
  TId = string | number,
> {
  protected apiClient: ApiClient;
  protected logger: Logger;
  protected storage?: CacheStorageProvider;
  protected cachedByProject: Map<string, T[]> = new Map();
  /**
   * Whether this feature is enabled.
   * Set by CacheManager based on SDK configuration.
   */
  protected featureEnabled: boolean = true;

  /**
   * Default project ID — set after /ready endpoint responds (single-env mode).
   */
  protected defaultProjectId: string;

  /**
   * Optional factory for multi-tenant mode (Edge).
   * When set, each environment gets its own ApiClient with isolated ETag cache.
   */
  protected apiClientFactory?: ApiClientFactory;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultProjectId: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultProjectId = defaultProjectId;
    this.storage = storage;
  }

  /**
   * Set feature enabled flag
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
   * Update the default project ID.
   * Called after /ready endpoint resolves the real projectId.
   */
  setDefaultProjectId(projectId: string): void {
    this.defaultProjectId = projectId;
  }

  /**
   * Set ApiClientFactory for multi-tenant mode (Edge).
   * When set, listByProject() uses the factory to get a per-environment ApiClient for the correct auth context.
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
   * Resolve project — returns provided projectId or default
   */
  protected resolveProject(projectId?: string): string {
    return projectId || this.defaultProjectId;
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

  /**
   * Extract projectId from an item.
   * Used in multi-tenant mode to determine which project a set of items belongs to.
   */
  protected abstract getProjectIdFromItem(item: T): string | undefined;

  // ==================== Common Implementation ====================

  /**
   * Initialize the service by loading data from local storage
   */
  async initializeAsync(projectId?: string): Promise<void> {
    if (!this.storage) return;

    const resolvedProject = this.resolveProject(projectId);
    const storageKey = this.getStorageKey(resolvedProject);

    try {
      const cachedJson = await this.storage.get(storageKey);
      if (cachedJson) {
        const items = JSON.parse(cachedJson) as T[];
        if (Array.isArray(items)) {
          this.cachedByProject.set(resolvedProject, items);
          this.logger.debug(
            `Loaded ${items.length} ${this.getServiceName()} items from local storage`
          );
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
   * Fetch items for the project (API call + cache update).
   * @param projectId The project to cache under (optional, uses default)
   * @param environmentId Used in multi-tenant mode to select the correct API client
   */
  async listByProject(projectId?: string, environmentId?: string): Promise<T[]> {
    const resolvedProject = this.resolveProject(projectId);
    const endpoint = this.getEndpoint();
    const client = this.getApiClient(environmentId);

    this.logger.debug(`Fetching ${this.getServiceName()}`, {
      projectId: resolvedProject,
    });

    const response = await client.get<TResponse>(endpoint);

    // Safety check: if backend returns failure but we have local data
    const currentItems = this.cachedByProject.get(resolvedProject) || [];

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
      projectId: resolvedProject,
    });

    this.cachedByProject.set(resolvedProject, items);

    // Persist to local storage
    await this.persistCache(resolvedProject);

    return items;
  }

  /**
   * Get the storage key for a project
   */
  protected getStorageKey(projectId?: string): string {
    const resolved = projectId || this.defaultProjectId;
    return `${this.getServiceName()}_project_${resolved}_data`;
  }

  /**
   * Get cached items for a specific project
   */
  getCached(projectId?: string): T[] {
    const resolved = this.resolveProject(projectId);
    return this.cachedByProject.get(resolved) || [];
  }

  /**
   * Get all cached items across all projects (flat array)
   */
  getAllCachedFlat(): T[] {
    return Array.from(this.cachedByProject.values()).flat();
  }

  /**
   * Get all cached items organized by project
   */
  getAllCached(): Map<string, T[]> {
    return this.cachedByProject;
  }

  /**
   * Get list of cached project IDs
   */
  getProjectIds(): string[] {
    return Array.from(this.cachedByProject.keys());
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedByProject.clear();
    this.logger.debug(`${this.getServiceName()} cache cleared`);
  }

  /**
   * Clear cached data for a specific project
   */
  clearCacheForProject(projectId?: string): void {
    const resolved = projectId || this.defaultProjectId;
    this.cachedByProject.delete(resolved);
    this.logger.debug(`${this.getServiceName()} cache cleared for project`, {
      projectId: resolved,
    });
  }

  /**
   * Refresh cached items for a project
   * @param environmentId Used in multi-tenant mode to select the correct API client
   */
  async refreshByProject(
    suppressWarnings?: boolean,
    projectId?: string,
    environmentId?: string
  ): Promise<T[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshByProject() called but feature is disabled`
      );
    }
    this.logger.info(`Refreshing ${this.getServiceName()} cache`, {
      projectId: this.resolveProject(projectId),
    });
    return await this.listByProject(projectId, environmentId);
  }

  /**
   * Update cache with new data
   */
  updateCache(items: T[], projectId?: string): void {
    const resolved = this.resolveProject(projectId);
    this.cachedByProject.set(resolved, items);
    this.persistCache(resolved).catch(() => {});
    this.logger.debug(`${this.getServiceName()} cache updated`, {
      count: items.length,
    });
  }

  /**
   * Update a single item in cache (immutable)
   */
  protected updateItemInCache(item: T, projectId?: string): void {
    const resolved = this.resolveProject(projectId);
    const currentItems = this.cachedByProject.get(resolved) || [];
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

    this.cachedByProject.set(resolved, newItems);
    this.persistCache(resolved).catch(() => {});

    this.logger.debug(
      `Single ${this.getServiceName()} ${existsInCache ? 'updated' : 'added'} in cache`,
      { id: itemId }
    );
  }

  /**
   * Remove an item from cache by ID (immutable)
   */
  removeFromCache(id: TId, projectId?: string): void {
    const resolved = this.resolveProject(projectId);
    const currentItems = this.cachedByProject.get(resolved) || [];
    const newItems = currentItems.filter(
      (item) => this.getItemId(item) !== id
    );
    this.cachedByProject.set(resolved, newItems);
    this.persistCache(resolved).catch(() => {});

    this.logger.debug(`${this.getServiceName()} removed from cache`, { id });
  }

  /**
   * Persist current cache for a project to local storage
   */
  protected async persistCache(projectId?: string): Promise<void> {
    if (!this.storage) return;
    const resolved = projectId || this.defaultProjectId;

    try {
      const items = this.cachedByProject.get(resolved) || [];
      const storageKey = this.getStorageKey(resolved);
      await this.storage.save(storageKey, JSON.stringify(items));
    } catch (error: any) {
      this.logger.error(
        `Failed to persist ${this.getServiceName()} to local storage`,
        {
          error: error.message,
        }
      );
    }
  }
}
