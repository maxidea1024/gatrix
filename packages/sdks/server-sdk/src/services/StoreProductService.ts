/**
 * Store Product Service
 * Handles store product list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/store-products
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { StoreProduct, StoreProductListResponse } from '../types/api';

export class StoreProductService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), StoreProduct[]>
  private cachedProductsByEnv: Map<string, StoreProduct[]> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Get store products for a specific environment
   * GET /api/v1/server/:env/store-products -> { products: [...] }
   */
  async listByEnvironment(environment: string): Promise<StoreProduct[]> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/store-products`;

    this.logger.debug('Fetching store products', { environment });

    const response = await this.apiClient.get<StoreProductListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch store products');
    }

    const products = response.data.products;
    this.cachedProductsByEnv.set(environment, products);

    this.logger.info('Store products fetched', {
      count: products.length,
      environment,
    });

    return products;
  }

  /**
   * Get store products for multiple environments
   * Fetches each environment separately and caches results
   */
  async listByEnvironments(environments: string[]): Promise<StoreProduct[]> {
    this.logger.debug('Fetching store products for multiple environments', { environments });

    const results: StoreProduct[] = [];

    for (const env of environments) {
      try {
        const products = await this.listByEnvironment(env);
        results.push(...products);
      } catch (error) {
        this.logger.error(`Failed to fetch store products for environment ${env}`, { error });
      }
    }

    this.logger.info('Store products fetched for all environments', {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Get all store products (uses default environment for single-env mode)
   * For backward compatibility
   */
  async list(): Promise<StoreProduct[]> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached store products
   * @param environment Environment name. If omitted, returns all products as flat array.
   */
  getCached(environment?: string): StoreProduct[] {
    if (environment) {
      return this.cachedProductsByEnv.get(environment) || [];
    }
    // No environment specified: return all products as flat array
    return Array.from(this.cachedProductsByEnv.values()).flat();
  }

  /**
   * Get all cached store products (all environments)
   */
  getAllCached(): Map<string, StoreProduct[]> {
    return this.cachedProductsByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedProductsByEnv.clear();
    this.logger.debug('Store products cache cleared');
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environment: string): void {
    this.cachedProductsByEnv.delete(environment);
    this.logger.debug('Store products cache cleared for environment', { environment });
  }

  /**
   * Refresh cached store products for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<StoreProduct[]> {
    this.logger.info('Refreshing store products cache', { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(`/api/v1/server/${encodeURIComponent(environment)}/store-products`);
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached store products (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<StoreProduct[]> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Update cache with new data
   */
  updateCache(products: StoreProduct[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.cachedProductsByEnv.set(envKey, products);
    this.logger.debug('Store products cache updated', { environment: envKey, count: products.length });
  }

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
        this.removeProduct(id, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the updated product from backend
      const updatedProduct = await this.getById(id, environment);

      // Get current products for this environment
      const currentProducts = this.cachedProductsByEnv.get(envKey) || [];

      // Check if product already exists in cache
      const existsInCache = currentProducts.some(p => p.id === id);

      if (existsInCache) {
        // Immutable update: update existing product
        const newProducts = currentProducts.map(p => p.id === id ? updatedProduct : p);
        this.cachedProductsByEnv.set(envKey, newProducts);
        this.logger.debug('Single store product updated in cache', { id, environment: envKey });
      } else {
        // Product not in cache but found in backend (e.g., isActive changed from false to true)
        // Add it to cache
        const newProducts = [...currentProducts, updatedProduct];
        this.cachedProductsByEnv.set(envKey, newProducts);
        this.logger.debug('Single store product added to cache', { id, environment: envKey });
      }
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
   */
  removeProduct(id: string, environment?: string): void {
    this.logger.debug('Removing store product from cache', { id, environment });

    const envKey = environment || this.defaultEnvironment;
    const currentProducts = this.cachedProductsByEnv.get(envKey) || [];

    // Immutable update: create new array without the deleted product
    const newProducts = currentProducts.filter(p => p.id !== id);
    this.cachedProductsByEnv.set(envKey, newProducts);

    this.logger.debug('Store product removed from cache', { id, environment: envKey });
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

