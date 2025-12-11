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
  // Target environments (empty = single environment mode)
  // Note: environments are identified by environmentName
  private environments: string[];
  // Multi-environment cache: Map<environment (environmentName), StoreProduct[]>
  private cachedProductsByEnv: Map<string, StoreProduct[]> = new Map();
  // Default environment key (for single-environment mode)
  private defaultEnvKey: string = 'default';

  constructor(apiClient: ApiClient, logger: Logger, environments: string[] = []) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.environments = environments;
  }

  private isMultiEnvironment(): boolean {
    return this.environments.length > 0;
  }

  /**
   * Get all store products
   * Single-env mode: GET /api/v1/server/store-products -> { products: [...] }
   * Multi-env mode: GET /api/v1/server/store-products?environments=... -> { byEnvironment: { [env]: [...] } }
   */
  async list(): Promise<StoreProduct[]> {
    let endpoint = `/api/v1/server/store-products`;
    if (this.isMultiEnvironment()) {
      endpoint += `?environments=${this.environments.join(',')}`;
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
   */
  getCached(environment?: string): StoreProduct[] {
    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
    return this.cachedProductsByEnv.get(envKey) || [];
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
   */
  async refresh(): Promise<StoreProduct[]> {
    this.logger.info('Refreshing store products cache');
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
   * Get store product by productId
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

