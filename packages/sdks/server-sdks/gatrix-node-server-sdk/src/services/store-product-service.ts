/**
 * Store Product Service
 * Handles store product list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/store-products
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import { StoreProduct, StoreProductListResponse } from '../types/api';
import { BaseEnvironmentService } from './base-environment-service';

export class StoreProductService extends BaseEnvironmentService<
  StoreProduct,
  StoreProductListResponse,
  string
> {
  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    super(apiClient, logger, defaultEnvironmentId, storage);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(): string {
    return `/api/v1/server/store-products`;
  }

  protected extractItems(response: StoreProductListResponse): StoreProduct[] {
    return response.products;
  }

  protected getServiceName(): string {
    return 'store products';
  }

  protected getItemId(item: StoreProduct): string {
    return String(item.cmsProductId);
  }

  // ==================== Override for ETag Invalidation ====================

  /**
   * Refresh cached store products for a specific environment
   */
  async refreshByEnvironment(
    suppressWarnings?: boolean,
    environmentId?: string
  ): Promise<StoreProduct[]> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'StoreProductService.refreshByEnvironment() called but feature is disabled',
        { environmentId: resolvedEnv }
      );
    }
    this.logger.info('Refreshing store products cache', {
      environmentId: resolvedEnv,
    });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(this.getEndpoint());
    return await this.listByEnvironment(resolvedEnv);
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Get a single store product by ID from API
   * Used for updating cache with fresh data
   * @param id Store product ID
   * @param environmentId environment ID
   */
  async getById(id: string, _environmentId?: string): Promise<StoreProduct> {
    const response = await this.apiClient.get<{ product: StoreProduct }>(
      `/api/v1/server/store-products/${id}`
    );
    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch store product'
      );
    }
    return response.data.product;
  }

  /**
   * Update a single store product in cache (immutable)
   * If isActive is false, removes the product from cache (no API call needed)
   * If isActive is true but not in cache, fetches and adds it to cache
   * If isActive is true and in cache, fetches and updates it
   * @param id Store product ID (ULID from event)
   * @param isActive Optional active status
   * @param environmentId environment ID
   */
  async updateSingleProduct(
    id: string,
    isActive?: boolean | number,
    environmentId?: string
  ): Promise<void> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    try {
      this.logger.debug('Updating single store product in cache', {
        id,
        environmentId: resolvedEnv,
        isActive,
      });

      // If isActive is explicitly false (0 or false), just remove from cache by ULID
      if (isActive === false || isActive === 0) {
        this.logger.info('Store product isActive=false, removing from cache', {
          id,
          environmentId: resolvedEnv,
        });
        this.removeByUlidFromCache(id, resolvedEnv);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Invalidate ETag cache before fetching to ensure fresh data
      this.apiClient.invalidateEtagCache(`/store-products/${id}`);

      // Fetch the updated product from backend
      const updatedProduct = await this.getById(id, resolvedEnv);
      this.updateItemByUlidInCache(updatedProduct, resolvedEnv);
    } catch (error: any) {
      this.logger.error('Failed to update single store product in cache', {
        id,
        environmentId: resolvedEnv,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refreshByEnvironment(undefined, resolvedEnv);
    }
  }

  /**
   * Remove an item from cache by ULID (event uses ULID, not cmsProductId)
   */
  private removeByUlidFromCache(ulid: string, environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const currentItems = this.cachedByEnv.get(resolvedEnv) || [];
    const newItems = currentItems.filter((item) => item.id !== ulid);
    this.cachedByEnv.set(resolvedEnv, newItems);
    this.logger.debug('Store product removed from cache by ULID', {
      ulid,
      environmentId,
    });
  }

  /**
   * Update or add an item in cache by ULID (event uses ULID, not cmsProductId)
   */
  private updateItemByUlidInCache(
    item: StoreProduct,
    environmentId: string
  ): void {
    const currentItems = this.cachedByEnv.get(environmentId) || [];
    const existsInCache = currentItems.some((i) => i.id === item.id);

    if (existsInCache) {
      const newItems = currentItems.map((i) => (i.id === item.id ? item : i));
      this.cachedByEnv.set(environmentId, newItems);
      this.logger.debug('Store product updated in cache by ULID', {
        id: item.id,
        environmentId,
      });
    } else {
      const newItems = [...currentItems, item];
      this.cachedByEnv.set(environmentId, newItems);
      this.logger.debug('Store product added to cache by ULID', {
        id: item.id,
        environmentId,
      });
    }
  }

  /**
   * Get store product by productId from cache
   * @param productId Product ID
   * @param environmentId environment ID
   */
  getByProductId(
    productId: string,
    environmentId: string
  ): StoreProduct | null {
    const products = this.getCached(environmentId);
    return products.find((p) => p.productId === productId) || null;
  }

  /**
   * Get store products by store type (google, apple, onestore, etc.)
   * @param store Store type
   * @param environmentId environment ID
   */
  getByStore(store: string, environmentId?: string): StoreProduct[] {
    const products = this.getCached(environmentId);
    return products.filter((p) => p.store === store);
  }

  /**
   * Get active store products only
   * Note: All cached products are already active (filtered by backend)
   * This method only filters by sale period
   * @param environmentId environment ID
   */
  getActive(environmentId?: string): StoreProduct[] {
    const products = this.getCached(environmentId);
    const now = new Date();

    return products.filter((p) => {
      // All cached products are already isActive=true from backend
      // Only check sale period

      if (p.saleStartAt) {
        const startDate = new Date(p.saleStartAt);
        if (!Number.isNaN(startDate.getTime()) && now < startDate) {
          return false;
        }
      }

      if (p.saleEndAt) {
        const endDate = new Date(p.saleEndAt);
        if (!Number.isNaN(endDate.getTime()) && now > endDate) {
          return false;
        }
      }

      return true;
    });
  }
}
