import api from './api';
import { Tag } from './tagService';
import { MutationResult, parseChangeRequestResponse } from './changeRequestUtils';

export interface StoreProduct {
  id: string;
  environment: string;
  isActive: boolean;
  productId: string;
  cmsProductId: number | null;
  productName: string;
  // Multi-language name fields
  nameKo: string | null;
  nameEn: string | null;
  nameZh: string | null;
  store: string;
  price: number;
  currency: string;
  saleStartAt: string | null;
  saleEndAt: string | null;
  description: string | null;
  // Multi-language description fields
  descriptionKo: string | null;
  descriptionEn: string | null;
  descriptionZh: string | null;
  metadata: Record<string, any> | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export interface CreateStoreProductInput {
  productId: string;
  productName: string;
  // Multi-language name fields
  nameKo?: string;
  nameEn?: string;
  nameZh?: string;
  store: string;
  price: number;
  currency?: string;
  isActive?: boolean;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  description?: string;
  // Multi-language description fields
  descriptionKo?: string;
  descriptionEn?: string;
  descriptionZh?: string;
  metadata?: Record<string, any>;
  tagIds?: number[];
}

export interface UpdateStoreProductInput {
  productId?: string;
  productName?: string;
  // Multi-language name fields
  nameKo?: string;
  nameEn?: string;
  nameZh?: string;
  store?: string;
  price?: number;
  currency?: string;
  isActive?: boolean;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  description?: string;
  // Multi-language description fields
  descriptionKo?: string;
  descriptionEn?: string;
  descriptionZh?: string;
  metadata?: Record<string, any>;
  tagIds?: number[];
}

export interface GetStoreProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  store?: string;
  isActive?: boolean;
}

export interface GetStoreProductsResponse {
  products: StoreProduct[];
  total: number;
  page: number;
  limit: number;
}

/**
 * CMS CashShop product from cashshop-lookup-*.json (planning data)
 */
export interface CmsCashShopProduct {
  id: number;
  name: string;           // Formatted and localized name (e.g., "레드젬 600")
  productCode: string;    // SDO product code
  price: number;          // China price (CNY)
  productCategory: number;
  productType: number;
  saleType: number;
  productDesc?: string;   // Product description (localized)
}

export interface GetCmsCashShopResponse {
  products: CmsCashShopProduct[];
  total: number;
}

export interface StoreProductStats {
  total: number;
  active: number;
  inactive: number;
}

class StoreProductService {
  /**
   * Get all store products with pagination
   * api.get() returns { success, data, message } - already unwrapped from axios response
   */
  async getStoreProducts(params?: GetStoreProductsParams): Promise<GetStoreProductsResponse> {
    const response = await api.get('/admin/store-products', { params });
    // response = { success, data: { products, total, page, limit }, message }
    return response.data;
  }

  /**
   * Get store product statistics
   */
  async getStats(): Promise<StoreProductStats> {
    const response = await api.get('/admin/store-products/stats');
    return response.data;
  }

  /**
   * Get store product by ID
   */
  async getStoreProductById(id: string): Promise<StoreProduct> {
    const response = await api.get(`/admin/store-products/${id}`);
    return response.data.product;
  }

  /**
   * Create a new store product
   */
  async createStoreProduct(input: CreateStoreProductInput): Promise<MutationResult<StoreProduct>> {
    const response = await api.post('/admin/store-products', input);
    return parseChangeRequestResponse<StoreProduct>(response, (r) => r?.product);
  }

  /**
   * Update a store product
   */
  async updateStoreProduct(id: string, input: UpdateStoreProductInput): Promise<MutationResult<StoreProduct>> {
    const response = await api.put(`/admin/store-products/${id}`, input);
    return parseChangeRequestResponse<StoreProduct>(response, (r) => r?.product);
  }

  /**
   * Delete a store product
   */
  async deleteStoreProduct(id: string): Promise<MutationResult<void>> {
    const response = await api.delete(`/admin/store-products/${id}`);
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Delete multiple store products
   */
  async deleteStoreProducts(ids: string[]): Promise<number> {
    const response = await api.delete('/admin/store-products', { data: { ids } });
    return response.data.deletedCount;
  }

  /**
   * Toggle store product active status
   */
  async toggleActive(id: string, isActive: boolean): Promise<MutationResult<StoreProduct>> {
    const response = await api.patch(`/admin/store-products/${id}/toggle-active`, { isActive });
    return parseChangeRequestResponse<StoreProduct>(response, (r) => r?.product);
  }

  /**
   * Bulk update active status for multiple products
   */
  async bulkUpdateActiveStatus(ids: string[], isActive: boolean): Promise<MutationResult<number>> {
    const response = await api.patch('/admin/store-products/bulk-active', { ids, isActive });
    return parseChangeRequestResponse<number>(response, (r) => r?.affectedCount);
  }

  /**
   * Bulk update active status by filter (for batch processing)
   */
  async bulkUpdateActiveStatusByFilter(params: {
    search?: string;
    currentIsActive?: boolean;
    targetIsActive: boolean;
  }): Promise<{ affectedCount: number; affectedIds: string[] }> {
    const response = await api.patch('/admin/store-products/bulk-active-by-filter', params);
    return response.data;
  }

  /**
   * Get count of products matching filter criteria (for batch processing preview)
   */
  async getCountByFilter(params: {
    search?: string;
    isActive?: boolean;
  }): Promise<number> {
    const response = await api.get('/admin/store-products/count-by-filter', { params });
    return response.data.count;
  }

  /**
   * Get CMS CashShop products from CashShop_BCCN.json
   * Returns only valid products (with chinaPrice and productCodeSdo)
   */
  async getCmsCashShopProducts(): Promise<GetCmsCashShopResponse> {
    const response = await api.get('/admin/cms/cash-shop');
    return response.data;
  }

  /**
   * Refresh CMS CashShop cache and get products
   */
  async refreshCmsCashShopProducts(): Promise<GetCmsCashShopResponse> {
    const response = await api.post('/admin/cms/cash-shop/refresh');
    return response.data;
  }

  /**
   * Preview sync with planning data
   */
  async previewSync(): Promise<SyncPreviewResult> {
    const response = await api.get('/admin/store-products/sync/preview');
    return response.data;
  }

  /**
   * Apply sync with planning data (selective)
   */
  async applySync(selected?: SelectedSyncItems): Promise<SyncApplyResult> {
    const response = await api.post('/admin/store-products/sync/apply', selected);
    return response.data;
  }
}

// Selected items for selective sync
export interface SelectedSyncItems {
  toAdd: number[];      // cmsProductId array
  toUpdate: number[];   // cmsProductId array
  toDelete: string[];   // id array
}

// Sync related interfaces
export interface SyncChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface SyncAddItem {
  cmsProductId: number;
  productCode: string;
  name: string;  // Display name (default language)
  nameKo: string;
  nameEn: string;
  nameZh: string;
  price: number;
  description: string | null;  // Display description (default language)
  descriptionKo: string | null;
  descriptionEn: string | null;
  descriptionZh: string | null;
}

export interface SyncUpdateItem {
  id: string;
  cmsProductId: number;
  productCode: string;
  name: string;
  changes: SyncChange[];
}

export interface SyncDeleteItem {
  id: string;
  cmsProductId: number | null;
  productCode: string;
  name: string;
}

export interface SyncPreviewResult {
  toAdd: SyncAddItem[];
  toUpdate: SyncUpdateItem[];
  toDelete: SyncDeleteItem[];
  summary: {
    addCount: number;
    updateCount: number;
    deleteCount: number;
    totalChanges: number;
  };
}

export interface SyncApplyResult {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
}

const storeProductService = new StoreProductService();
export default storeProductService;

