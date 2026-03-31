/**
 * Base Org Service
 * Generic base class for services that handle per-organization data caching.
 *
 * DESIGN PRINCIPLES:
 * - Cache key = orgId
 * - Uses the default ApiClient for API calls
 * - Currently no services use this base class — reserved for future expansion
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';

/**
 * Abstract base class for org-scoped services
 * @template T - The item type
 * @template TResponse - The API response type
 * @template TId - The ID type for items (string or number)
 */
export abstract class BaseOrgService<T, TResponse, TId = string | number> {
  protected apiClient: ApiClient;
  protected logger: Logger;
  protected storage?: CacheStorageProvider;
  protected cachedByOrg: Map<string, T[]> = new Map();
  protected featureEnabled: boolean = true;

  /**
   * Default org ID — set after /ready endpoint responds.
   */
  protected defaultOrgId: string;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultOrgId: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultOrgId = defaultOrgId;
    this.storage = storage;
  }

  setFeatureEnabled(enabled: boolean): void {
    this.featureEnabled = enabled;
  }

  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  /**
   * Update the default org ID.
   * Called after /ready endpoint resolves the real orgId.
   */
  setDefaultOrgId(orgId: string): void {
    this.defaultOrgId = orgId;
  }

  protected resolveOrg(orgId?: string): string {
    return orgId || this.defaultOrgId;
  }

  // ==================== Abstract Methods ====================

  protected abstract getEndpoint(): string;
  protected abstract extractItems(response: TResponse): T[];
  protected abstract getServiceName(): string;
  protected abstract getItemId(item: T): TId;

  // ==================== Common Implementation ====================

  async initializeAsync(orgId?: string): Promise<void> {
    if (!this.storage) return;

    const resolved = this.resolveOrg(orgId);
    const storageKey = this.getStorageKey(resolved);

    try {
      const cachedJson = await this.storage.get(storageKey);
      if (cachedJson) {
        const items = JSON.parse(cachedJson) as T[];
        if (Array.isArray(items)) {
          this.cachedByOrg.set(resolved, items);
          this.logger.debug(
            `Loaded ${items.length} ${this.getServiceName()} items from local storage`
          );
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to load ${this.getServiceName()} from local storage`,
        { error: error.message }
      );
    }
  }

  async listByOrg(orgId?: string): Promise<T[]> {
    const resolved = this.resolveOrg(orgId);
    const endpoint = this.getEndpoint();

    this.logger.debug(`Fetching ${this.getServiceName()}`, {
      orgId: resolved,
    });

    const response = await this.apiClient.get<TResponse>(endpoint);
    const currentItems = this.cachedByOrg.get(resolved) || [];

    if (!response.success || !response.data) {
      if (currentItems.length > 0) {
        this.logger.warn(
          `Failed to fetch ${this.getServiceName()} from backend, keeping local data.`,
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
        `${this.getServiceName()} received empty list, keeping local data.`,
        { localCount: currentItems.length }
      );
      return currentItems;
    }

    this.cachedByOrg.set(resolved, items);
    await this.persistCache(resolved);

    return items;
  }

  protected getStorageKey(orgId?: string): string {
    const resolved = orgId || this.defaultOrgId;
    return `${this.getServiceName()}_org_${resolved}_data`;
  }

  getCached(orgId?: string): T[] {
    const resolved = this.resolveOrg(orgId);
    return this.cachedByOrg.get(resolved) || [];
  }

  getAllCachedFlat(): T[] {
    return Array.from(this.cachedByOrg.values()).flat();
  }

  clearCache(): void {
    this.cachedByOrg.clear();
    this.logger.debug(`${this.getServiceName()} cache cleared`);
  }

  clearCacheForOrg(orgId?: string): void {
    const resolved = orgId || this.defaultOrgId;
    this.cachedByOrg.delete(resolved);
  }

  async refreshByOrg(suppressWarnings?: boolean, orgId?: string): Promise<T[]> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        `${this.getServiceName()}.refreshByOrg() called but feature is disabled`
      );
    }
    return await this.listByOrg(orgId);
  }

  updateCache(items: T[], orgId?: string): void {
    const resolved = this.resolveOrg(orgId);
    this.cachedByOrg.set(resolved, items);
    this.persistCache(resolved).catch(() => {});
  }

  protected updateItemInCache(item: T, orgId?: string): void {
    const resolved = this.resolveOrg(orgId);
    const currentItems = this.cachedByOrg.get(resolved) || [];
    const itemId = this.getItemId(item);
    const existsInCache = currentItems.some(
      (i) => this.getItemId(i) === itemId
    );

    const newItems = existsInCache
      ? currentItems.map((i) => (this.getItemId(i) === itemId ? item : i))
      : [...currentItems, item];

    this.cachedByOrg.set(resolved, newItems);
    this.persistCache(resolved).catch(() => {});
  }

  removeFromCache(id: TId, orgId?: string): void {
    const resolved = this.resolveOrg(orgId);
    const currentItems = this.cachedByOrg.get(resolved) || [];
    const newItems = currentItems.filter((item) => this.getItemId(item) !== id);
    this.cachedByOrg.set(resolved, newItems);
    this.persistCache(resolved).catch(() => {});
  }

  protected async persistCache(orgId?: string): Promise<void> {
    if (!this.storage) return;
    const resolved = orgId || this.defaultOrgId;

    try {
      const items = this.cachedByOrg.get(resolved) || [];
      const storageKey = this.getStorageKey(resolved);
      await this.storage.save(storageKey, JSON.stringify(items));
    } catch (error: any) {
      this.logger.error(
        `Failed to persist ${this.getServiceName()} to local storage`,
        { error: error.message }
      );
    }
  }

  getOrgIds(): string[] {
    return Array.from(this.cachedByOrg.keys());
  }
}
