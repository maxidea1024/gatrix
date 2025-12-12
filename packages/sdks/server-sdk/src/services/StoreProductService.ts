/**
 * Store Product Service
 * Handles store product list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/store-products
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { StoreProduct, StoreProductListResponse } from '../types/api';
import { BaseEnvironmentService } from './BaseEnvironmentService';

export class StoreProductService extends BaseEnvironmentService<StoreProduct, StoreProductListResponse, string> {
  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    super(apiClient, logger, defaultEnvironment);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(environment: string): string {
    return `/api/v1/server/${encodeURIComponent(environment)}/store-products`;
  }

  protected extractItems(response: StoreProductListResponse): StoreProduct[] {
    return response.products;
  }

  protected getServiceName(): string {
    return 'store products';
  }

  protected getItemId(item: StoreProduct): string {
    return item.id;
  }

  // ==================== Override for ETag Invalidation ====================

  /**
   * Refresh cached store products for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<StoreProduct[]> {
    this.logger.info('Refreshing store products cache', { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(this.getEndpoint(environment));
    return await this.listByEnvironment(environment);
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Get a single store product by ID from API
   * Used for updating cache with fresh data
   */
  async getById(id: string, environment?: string): Promise<StoreProduct> {
    const env = environment || this.defaultEnvironment;
    const response = await this.apiClient.get<{ product: StoreProduct }>(`/api/v1/server/${encodeURIComponent(env)}/store-products/${id}`);
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch store product');
    }
    return response.data.product;
  }

  /**
   * Update a single store product in cache (immutable)
   * If isActive is false, removes the product from cache (no API call needed)
   * If isActive is true but not in cache, fetches and adds it to cache
   * If isActive is true and in cache, fetches and updates it
   */
  async updateSingleProduct(id: string, environment?: string, isActive?: boolean | number): Promise<void> {
    try {
      this.logger.debug('Updating single store product in cache', { id, environment, isActive });

      const envKey = environment || this.defaultEnvironment;

      // If isActive is explicitly false (0 or false), just remove from cache
      if (isActive === false || isActive === 0) {
        this.logger.info('Store product isActive=false, removing from cache', { id, environment: envKey });
        this.removeFromCache(id, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Invalidate ETag cache before fetching to ensure fresh data
      this.apiClient.invalidateEtagCache(`/store-products/${id}`);

      // Fetch the updated product from backend
      const updatedProduct = await this.getById(id, environment);
      this.updateItemInCache(updatedProduct, environment);
    } catch (error: any) {
      this.logger.error('Failed to update single store product in cache', {
        id,
        environment,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
    }
  }

  /**
   * Remove a store product from cache (immutable)
   * @deprecated Use removeFromCache instead
   */
  removeProduct(id: string, environment?: string): void {
    this.removeFromCache(id, environment);
  }

  /**
   * Get store product by productId from cache
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getByProductId(productId: string, environment?: string): StoreProduct | null {
    const products = this.getCached(environment);
    return products.find((p) => p.productId === productId) || null;
  }

  /**
   * Get store products by store type (google, apple, onestore, etc.)
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getByStore(store: string, environment?: string): StoreProduct[] {
    const products = this.getCached(environment);
    return products.filter((p) => p.store === store);
  }

  /**
   * Get active store products only
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getActive(environment?: string): StoreProduct[] {
    const products = this.getCached(environment);
    const now = new Date();
    
    return products.filter((p) => {
      if (!p.isActive) return false;
      
      // Check sale period
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

