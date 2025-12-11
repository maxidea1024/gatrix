/**
 * Store Product Service
 * Handles store product list and retrieval
 * Supports both single-environment (default) and multi-environment modes
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { StoreProduct, StoreProductListResponse, StoreProductByEnvResponse } from '../types/api';

export class StoreProductService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Target environments ('*' = all environments, string[] = specific, empty = single mode)
  // Note: environments are identified by environmentName
  private environments: string[] | '*';
  // Multi-environment cache: Map<environment (environmentName), StoreProduct[]>
  private cachedProductsByEnv: Map<string, StoreProduct[]> = new Map();
  // Default environment key (for single-environment mode)
  private defaultEnvKey: string = 'default';

  constructor(apiClient: ApiClient, logger: Logger, environments: string[] | '*' = []) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.environments = environments;
  }

  private isMultiEnvironment(): boolean {
    return this.environments === '*' || (Array.isArray(this.environments) && this.environments.length > 0);
  }

  private isAllEnvironments(): boolean {
    return this.environments === '*';
  }

  /**
   * Get all store products
   * Single-env mode: GET /api/v1/server/store-products -> { products: [...] }
   * Multi-env mode: GET /api/v1/server/store-products?environments=... -> { byEnvironment: { [env]: [...] } }
   * All-env mode: GET /api/v1/server/store-products?environments=* -> { byEnvironment: { [env]: [...] } }
   */
  async list(): Promise<StoreProduct[]> {
    let endpoint = `/api/v1/server/store-products`;
    if (this.isAllEnvironments()) {
      endpoint += `?environments=*`;
    } else if (this.isMultiEnvironment()) {
      endpoint += `?environments=${(this.environments as string[]).join(',')}`;
    }

    this.logger.debug('Fetching store products', { environments: this.environments });

    // Clear cache before fetching
    this.cachedProductsByEnv.clear();

    if (this.isMultiEnvironment()) {
      // Multi-environment mode: backend returns { byEnvironment: { [env]: data[] } }
      const response = await this.apiClient.get<StoreProductByEnvResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch store products');
      }

      const byEnvironment = response.data.byEnvironment;
      let totalCount = 0;

      // Store directly by environment key (already separated by backend)
      for (const [envName, products] of Object.entries(byEnvironment)) {
        this.cachedProductsByEnv.set(envName, products);
        totalCount += products.length;
      }

      this.logger.info('Store products fetched', {
        count: totalCount,
        environmentCount: this.cachedProductsByEnv.size,
        environments: this.environments,
      });

      // Return all products as flat array for backward compatibility
      return Array.from(this.cachedProductsByEnv.values()).flat();
    } else {
      // Single-environment mode: backend returns { products: [...] }
      const response = await this.apiClient.get<StoreProductListResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch store products');
      }

      const products = response.data.products;
      this.cachedProductsByEnv.set(this.defaultEnvKey, products);

      this.logger.info('Store products fetched', {
        count: products.length,
        environments: 'single',
      });

      return products;
    }
  }

  /**
   * Get cached store products
   * @param environment Environment name. Only used in multi-environment mode.
   *                    If omitted in multi-environment mode, returns all products as flat array.
   */
  getCached(environment?: string): StoreProduct[] {
    if (!this.isMultiEnvironment()) {
      // Single-environment mode: return default key
      return this.cachedProductsByEnv.get(this.defaultEnvKey) || [];
    }

    // Multi-environment mode
    if (environment) {
      // Specific environment requested
      return this.cachedProductsByEnv.get(environment) || [];
    }

    // No environment specified: return all products as flat array
    return Array.from(this.cachedProductsByEnv.values()).flat();
  }

  /**
   * Get all cached store products (all environments)
   * Only meaningful in multi-environment mode
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
   * Refresh cached store products
   * Invalidates ETag cache first to ensure fresh data is fetched
   */
  async refresh(): Promise<StoreProduct[]> {
    this.logger.info('Refreshing store products cache');
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache('/api/v1/server/store-products');
    return await this.list();
  }

  /**
   * Update cache with new data
   * @param environment Environment name. Only used in multi-environment mode.
   */
  updateCache(products: StoreProduct[], environment?: string): void {
    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
    this.cachedProductsByEnv.set(envKey, products);
    this.logger.debug('Store products cache updated', { environment: envKey, count: products.length });
  }

  /**
   * Get a single store product by ID from API
   * Used for updating cache with fresh data
   */
  async getById(id: string): Promise<StoreProduct> {
    const response = await this.apiClient.get<{ product: StoreProduct }>(`/api/v1/server/store-products/${id}`);
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

      const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;

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
      const updatedProduct = await this.getById(id);

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

    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
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

