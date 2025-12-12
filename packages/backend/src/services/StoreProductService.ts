import { ulid } from 'ulid';
import database from '../config/database';
import { GatrixError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { TagService } from './TagService';
import { getCurrentEnvironmentId } from '../utils/environmentContext';
import { PlanningDataService } from './PlanningDataService';
import { CmsCashShopProduct } from './CmsCashShopService';
import { pubSubService } from './PubSubService';
import { Environment } from '../models/Environment';
import { SERVER_SDK_ETAG } from '../constants/cacheKeys';

export interface StoreProduct {
  id: string;
  environmentId: string;
  isActive: boolean;
  productId: string;
  cmsProductId: number | null;
  productName: string;
  store: string;
  price: number;
  currency: string;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  description: string | null;
  metadata: Record<string, any> | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: any[];
}

export interface CreateStoreProductInput {
  productId: string;
  productName: string;
  store: string;
  price: number;
  currency?: string;
  isActive?: boolean;
  saleStartAt?: Date | null;
  saleEndAt?: Date | null;
  description?: string;
  metadata?: Record<string, any>;
  createdBy?: number;
}

export interface UpdateStoreProductInput {
  productId?: string;
  productName?: string;
  store?: string;
  price?: number;
  currency?: string;
  isActive?: boolean;
  saleStartAt?: Date | null;
  saleEndAt?: Date | null;
  description?: string;
  metadata?: Record<string, any>;
  updatedBy?: number;
}

export interface GetStoreProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  store?: string;
  isActive?: boolean;
  environmentId?: string;
}

export interface GetStoreProductsResponse {
  products: StoreProduct[];
  total: number;
  page: number;
  limit: number;
}

class StoreProductService {
  /**
   * Get all store products with pagination
   */
  static async getStoreProducts(params?: GetStoreProductsParams): Promise<GetStoreProductsResponse> {
    const pool = database.getPool();
    // Ensure page and limit are numbers (query params come as strings)
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 10;
    const search = params?.search || '';
    const sortBy = params?.sortBy || 'createdAt';
    const sortOrder = (params?.sortOrder || 'desc').toUpperCase();
    const envId = params?.environmentId ?? getCurrentEnvironmentId();

    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['environmentId = ?'];
    const queryParams: any[] = [envId];

    if (search) {
      // Check if search is a number (for CMS ID search)
      const searchNumber = Number(search);
      if (!isNaN(searchNumber) && String(searchNumber) === search.trim()) {
        // Search by CMS ID if input is a pure number
        conditions.push('(productId LIKE ? OR productName LIKE ? OR description LIKE ? OR cmsProductId = ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchNumber);
      } else {
        conditions.push('(productId LIKE ? OR productName LIKE ? OR description LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }
    }

    if (params?.store) {
      conditions.push('store = ?');
      queryParams.push(params.store);
    }

    if (params?.isActive !== undefined) {
      conditions.push('isActive = ?');
      queryParams.push(params.isActive ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const allowedSortColumns = ['cmsProductId', 'productId', 'productName', 'store', 'price', 'isActive', 'saleStartAt', 'saleEndAt', 'createdAt', 'updatedAt'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    try {
      // Get total count
      const [countResult] = await pool.execute<any[]>(
        `SELECT COUNT(*) as total FROM g_store_products ${whereClause}`,
        queryParams
      );
      const total = countResult[0].total;

      // Get products (use template literal for LIMIT/OFFSET as they are already validated numbers)
      const [products] = await pool.execute<any[]>(
        `SELECT * FROM g_store_products ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ${limit} OFFSET ${offset}`,
        queryParams
      );

      // Load tags for each product
      const productsWithTags = await Promise.all(
        products.map(async (product) => {
          const tags = await TagService.listTagsForEntity('store_product', product.id);
          return {
            ...product,
            isActive: Boolean(product.isActive),
            metadata: typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata,
            tags,
          };
        })
      );

      return {
        products: productsWithTags,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to get store products', { error, params });
      throw new GatrixError('Failed to get store products', 500);
    }
  }

  /**
   * Get store product statistics
   */
  static async getStats(environmentId?: string): Promise<{ total: number; active: number; inactive: number }> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    try {
      const [result] = await pool.execute<any[]>(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactive
        FROM g_store_products WHERE environmentId = ?`,
        [envId]
      );

      return {
        total: result[0].total || 0,
        active: result[0].active || 0,
        inactive: result[0].inactive || 0,
      };
    } catch (error) {
      logger.error('Failed to get store product stats', { error });
      throw new GatrixError('Failed to get store product stats', 500);
    }
  }

  /**
   * Get store product by ID
   */
  static async getStoreProductById(id: string, environmentId?: string): Promise<StoreProduct> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    try {
      const [products] = await pool.execute<any[]>(
        'SELECT * FROM g_store_products WHERE id = ? AND environmentId = ?',
        [id, envId]
      );

      if (products.length === 0) {
        throw new GatrixError('Store product not found', 404);
      }

      const product = products[0];
      const tags = await TagService.listTagsForEntity('store_product', id);

      return {
        ...product,
        isActive: Boolean(product.isActive),
        metadata: typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata,
        tags,
      };
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to get store product by ID', { error, id });
      throw new GatrixError('Failed to get store product', 500);
    }
  }

  /**
   * Get store product by ID across all environments (for Server SDK)
   * This is used when the SDK receives an event and needs to fetch a specific product
   */
  static async getStoreProductByIdAcrossEnvironments(id: string): Promise<StoreProduct | null> {
    const pool = database.getPool();

    try {
      const [products] = await pool.execute<any[]>(
        'SELECT * FROM g_store_products WHERE id = ?',
        [id]
      );

      if (products.length === 0) {
        return null;
      }

      const product = products[0];
      const tags = await TagService.listTagsForEntity('store_product', id);

      return {
        ...product,
        isActive: Boolean(product.isActive),
        metadata: typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata,
        tags,
      };
    } catch (error) {
      logger.error('Failed to get store product by ID across environments', { error, id });
      return null;
    }
  }

  /**
   * Create a new store product
   */
  static async createStoreProduct(input: CreateStoreProductInput, environmentId?: string): Promise<StoreProduct> {
    const pool = database.getPool();
    const id = ulid();
    const envId = environmentId ?? getCurrentEnvironmentId();

    try {
      await pool.execute(
        `INSERT INTO g_store_products
         (id, environmentId, isActive, productId, productName, store, price, currency,
          saleStartAt, saleEndAt, description, metadata, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          envId,
          input.isActive !== undefined ? (input.isActive ? 1 : 0) : 1,
          input.productId,
          input.productName,
          input.store,
          input.price,
          input.currency || 'USD',
          input.saleStartAt || null,
          input.saleEndAt || null,
          input.description || null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          input.createdBy || null,
        ]
      );

      const product = await this.getStoreProductById(id, envId);

      // Invalidate ETag cache and publish SDK event
      try {
        const env = await Environment.query().findById(envId);

        // Invalidate ETag cache so SDK fetches fresh data
        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.STORE_PRODUCTS}:${envId}`);

        await pubSubService.publishSDKEvent({
          type: 'store_product.created',
          data: {
            id,
            environment: env?.environmentName,
            isActive: product?.isActive ? 1 : 0,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish store product SDK event', { eventError, id });
      }

      return product;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new GatrixError('A product with this ID and store already exists', 409);
      }
      logger.error('Failed to create store product', { error, input });
      throw new GatrixError('Failed to create store product', 500);
    }
  }

  /**
   * Update an existing store product
   */
  static async updateStoreProduct(id: string, input: UpdateStoreProductInput, environmentId?: string): Promise<StoreProduct> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];

    if (input.productId !== undefined) {
      updates.push('productId = ?');
      values.push(input.productId);
    }
    if (input.productName !== undefined) {
      updates.push('productName = ?');
      values.push(input.productName);
    }
    if (input.store !== undefined) {
      updates.push('store = ?');
      values.push(input.store);
    }
    if (input.price !== undefined) {
      updates.push('price = ?');
      values.push(input.price);
    }
    if (input.currency !== undefined) {
      updates.push('currency = ?');
      values.push(input.currency);
    }
    if (input.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(input.isActive ? 1 : 0);
    }
    if (input.saleStartAt !== undefined) {
      updates.push('saleStartAt = ?');
      values.push(input.saleStartAt);
    }
    if (input.saleEndAt !== undefined) {
      updates.push('saleEndAt = ?');
      values.push(input.saleEndAt);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(input.metadata));
    }
    if (input.updatedBy !== undefined) {
      updates.push('updatedBy = ?');
      values.push(input.updatedBy);
    }

    if (updates.length === 0) {
      return this.getStoreProductById(id, envId);
    }

    updates.push('updatedAt = NOW()');
    values.push(id, envId);

    try {
      const [result] = await pool.execute<any>(
        `UPDATE g_store_products SET ${updates.join(', ')} WHERE id = ? AND environmentId = ?`,
        values
      );

      if (result.affectedRows === 0) {
        throw new GatrixError('Store product not found', 404);
      }

      const product = await this.getStoreProductById(id, envId);

      // Invalidate ETag cache and publish SDK event
      try {
        const env = await Environment.query().findById(envId);

        // Invalidate ETag cache so SDK fetches fresh data
        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.STORE_PRODUCTS}:${envId}`);

        await pubSubService.publishSDKEvent({
          type: 'store_product.updated',
          data: {
            id,
            environment: env?.environmentName,
            isActive: product?.isActive ? 1 : 0,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish store product SDK event', { eventError, id });
      }

      return product;
    } catch (error: any) {
      if (error instanceof GatrixError) throw error;
      if (error.code === 'ER_DUP_ENTRY') {
        throw new GatrixError('A product with this ID and store already exists', 409);
      }
      logger.error('Failed to update store product', { error, id, input });
      throw new GatrixError('Failed to update store product', 500);
    }
  }

  /**
   * Delete a store product
   */
  static async deleteStoreProduct(id: string, environmentId?: string): Promise<void> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    try {
      // Delete associated tags first (set to empty array)
      await TagService.setTagsForEntity('store_product', id, []);

      const [result] = await pool.execute<any>(
        'DELETE FROM g_store_products WHERE id = ? AND environmentId = ?',
        [id, envId]
      );

      if (result.affectedRows === 0) {
        throw new GatrixError('Store product not found', 404);
      }

      // Invalidate ETag cache and publish SDK event
      try {
        const env = await Environment.query().findById(envId);

        // Invalidate ETag cache so SDK fetches fresh data
        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.STORE_PRODUCTS}:${envId}`);

        await pubSubService.publishSDKEvent({
          type: 'store_product.deleted',
          data: {
            id,
            environment: env?.environmentName,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish store product SDK event', { eventError, id });
      }
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to delete store product', { error, id });
      throw new GatrixError('Failed to delete store product', 500);
    }
  }

  /**
   * Delete multiple store products
   */
  static async deleteStoreProducts(ids: string[], environmentId?: string): Promise<number> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    if (ids.length === 0) return 0;

    try {
      // Delete associated tags first (set to empty array)
      for (const id of ids) {
        await TagService.setTagsForEntity('store_product', id, []);
      }

      const placeholders = ids.map(() => '?').join(',');
      const [result] = await pool.execute<any>(
        `DELETE FROM g_store_products WHERE id IN (${placeholders}) AND environmentId = ?`,
        [...ids, envId]
      );

      // Invalidate ETag cache and publish SDK events for each deleted product
      if (result.affectedRows > 0) {
        try {
          const env = await Environment.query().findById(envId);

          // Invalidate ETag cache so SDK fetches fresh data
          await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.STORE_PRODUCTS}:${envId}`);

          for (const id of ids) {
            await pubSubService.publishSDKEvent({
              type: 'store_product.deleted',
              data: {
                id,
                environment: env?.environmentName,
                timestamp: Date.now()
              }
            });
          }
        } catch (eventError) {
          logger.warn('Failed to publish store product SDK event', { eventError, ids });
        }
      }

      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to delete store products', { error, ids });
      throw new GatrixError('Failed to delete store products', 500);
    }
  }

  /**
   * Toggle store product active status
   */
  static async toggleActive(id: string, isActive: boolean, updatedBy?: number, environmentId?: string): Promise<StoreProduct> {
    return this.updateStoreProduct(id, { isActive, updatedBy }, environmentId);
  }

  /**
   * Bulk update active status for multiple products
   */
  static async bulkUpdateActiveStatus(ids: string[], isActive: boolean, updatedBy?: number, environmentId?: string): Promise<number> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    if (ids.length === 0) return 0;

    try {
      const placeholders = ids.map(() => '?').join(',');
      const [result] = await pool.execute<any>(
        `UPDATE g_store_products SET isActive = ?, updatedBy = ?, updatedAt = NOW() WHERE id IN (${placeholders}) AND environmentId = ?`,
        [isActive ? 1 : 0, updatedBy || null, ...ids, envId]
      );

      // Invalidate ETag cache and publish SDK events for each updated product
      if (result.affectedRows > 0) {
        try {
          const env = await Environment.query().findById(envId);

          // Invalidate ETag cache so SDK fetches fresh data
          await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.STORE_PRODUCTS}:${envId}`);

          for (const id of ids) {
            await pubSubService.publishSDKEvent({
              type: 'store_product.updated',
              data: {
                id,
                environment: env?.environmentName,
                isActive: isActive ? 1 : 0,
                timestamp: Date.now()
              }
            });
          }
        } catch (eventError) {
          logger.warn('Failed to publish store product SDK event', { eventError, ids });
        }
      }

      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to bulk update active status', { error, ids, isActive });
      throw new GatrixError('Failed to bulk update active status', 500);
    }
  }

  /**
   * Preview sync with planning data
   * Returns what changes would be made without applying them
   */
  static async previewSync(environmentId?: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<SyncPreviewResult> {
    const envId = environmentId || getCurrentEnvironmentId();
    if (!envId) {
      throw new GatrixError('Environment ID is required', 400);
    }

    try {
      // Get planning data products
      const planningData = await PlanningDataService.getCashShopLookup(envId, lang);
      const planningProducts: CmsCashShopProduct[] = planningData.items || [];

      // Get current DB products
      const pool = await database.getPool();
      const [rows] = await pool.execute(
        'SELECT * FROM g_store_products WHERE environmentId = ?',
        [envId]
      );
      const dbProducts = rows as StoreProduct[];

      // Create maps for comparison - use id as key (productCode can be duplicated)
      const planningMap = new Map<number, CmsCashShopProduct>();
      for (const p of planningProducts) {
        planningMap.set(p.id, p);
      }

      const dbMap = new Map<number, StoreProduct>();
      for (const p of dbProducts) {
        if (p.cmsProductId !== null) {
          dbMap.set(p.cmsProductId, p);
        }
      }

      const toAdd: SyncAddItem[] = [];
      const toUpdate: SyncUpdateItem[] = [];
      const toDelete: SyncDeleteItem[] = [];

      // Check for products to add or update
      for (const [cmsProductId, planningProduct] of planningMap) {
        const dbProduct = dbMap.get(cmsProductId);

        if (!dbProduct) {
          // New product to add
          toAdd.push({
            productCode: planningProduct.productCode,
            name: planningProduct.name,
            price: planningProduct.price,
            description: planningProduct.productDesc || null,
            cmsProductId: planningProduct.id,
          });
        } else {
          // Check for changes
          const changes: SyncChange[] = [];

          if (dbProduct.productName !== planningProduct.name) {
            changes.push({
              field: 'productName',
              oldValue: dbProduct.productName,
              newValue: planningProduct.name,
            });
          }

          if (Number(dbProduct.price) !== planningProduct.price) {
            changes.push({
              field: 'price',
              oldValue: dbProduct.price,
              newValue: planningProduct.price,
            });
          }

          const dbDesc = dbProduct.description || '';
          const planningDesc = planningProduct.productDesc || '';
          if (dbDesc !== planningDesc) {
            changes.push({
              field: 'description',
              oldValue: dbDesc,
              newValue: planningDesc,
            });
          }

          if (changes.length > 0) {
            toUpdate.push({
              id: dbProduct.id,
              cmsProductId: planningProduct.id,
              productCode: planningProduct.productCode,
              name: planningProduct.name,
              changes,
            });
          }
        }
      }

      // Check for products to delete
      for (const [cmsProductId, dbProduct] of dbMap) {
        if (!planningMap.has(cmsProductId)) {
          toDelete.push({
            id: dbProduct.id,
            cmsProductId: dbProduct.cmsProductId,
            productCode: dbProduct.productId,
            name: dbProduct.productName,
          });
        }
      }

      return {
        toAdd,
        toUpdate,
        toDelete,
        summary: {
          addCount: toAdd.length,
          updateCount: toUpdate.length,
          deleteCount: toDelete.length,
          totalChanges: toAdd.length + toUpdate.length + toDelete.length,
        },
      };
    } catch (error) {
      logger.error('Failed to preview sync', { error, environmentId: envId });
      throw new GatrixError('Failed to preview sync with planning data', 500);
    }
  }

  /**
   * Apply sync with planning data (selective)
   */
  static async applySync(
    environmentId?: string,
    lang: 'kr' | 'en' | 'zh' = 'kr',
    userId?: number,
    selected?: SelectedSyncItems
  ): Promise<SyncApplyResult> {
    const envId = environmentId || getCurrentEnvironmentId();
    if (!envId) {
      throw new GatrixError('Environment ID is required', 400);
    }

    const pool = await database.getPool();
    const preview = await this.previewSync(envId, lang);

    // Filter items based on selection if provided
    const toAddFiltered = selected?.toAdd
      ? preview.toAdd.filter(item => selected.toAdd.includes(item.cmsProductId))
      : preview.toAdd;
    const toUpdateFiltered = selected?.toUpdate
      ? preview.toUpdate.filter(item => selected.toUpdate.includes(item.cmsProductId))
      : preview.toUpdate;
    const toDeleteFiltered = selected?.toDelete
      ? preview.toDelete.filter(item => selected.toDelete.includes(item.id))
      : preview.toDelete;

    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    try {
      // Add new products
      for (const item of toAddFiltered) {
        const id = ulid();
        await pool.execute(
          `INSERT INTO g_store_products
           (id, environmentId, isActive, productId, cmsProductId, productName, store, price, currency,
            saleStartAt, saleEndAt, description, metadata, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            id,
            envId,
            0, // isActive = false for new products
            item.productCode,
            item.cmsProductId,
            item.name,
            'sdo', // Default store
            item.price,
            'CNY', // Default currency
            null, // saleStartAt
            null, // saleEndAt
            item.description,
            null, // metadata
            userId || null,
          ]
        );
        addedCount++;
      }

      // Update existing products
      for (const item of toUpdateFiltered) {
        const updates: string[] = [];
        const values: any[] = [];

        for (const change of item.changes) {
          if (change.field === 'productName') {
            updates.push('productName = ?');
            values.push(change.newValue);
          } else if (change.field === 'price') {
            updates.push('price = ?');
            values.push(change.newValue);
          } else if (change.field === 'description') {
            updates.push('description = ?');
            values.push(change.newValue || null);
          }
        }

        if (updates.length > 0) {
          updates.push('updatedBy = ?');
          values.push(userId || null);
          updates.push('updatedAt = NOW()');
          values.push(item.id);

          await pool.execute(
            `UPDATE g_store_products SET ${updates.join(', ')} WHERE id = ?`,
            values
          );
          updatedCount++;
        }
      }

      // Delete removed products
      for (const item of toDeleteFiltered) {
        // First delete associated tags by setting empty array
        await TagService.setTagsForEntity('store_product', item.id, []);
        // Then delete the product
        await pool.execute(
          'DELETE FROM g_store_products WHERE id = ?',
          [item.id]
        );
        deletedCount++;
      }

      logger.info('Sync applied successfully', {
        environmentId: envId,
        addedCount,
        updatedCount,
        deletedCount,
      });

      return {
        success: true,
        addedCount,
        updatedCount,
        deletedCount,
      };
    } catch (error) {
      logger.error('Failed to apply sync', { error, environmentId: envId });
      throw new GatrixError('Failed to apply sync with planning data', 500);
    }
  }
}

// Sync related interfaces
export interface SyncChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface SyncAddItem {
  productCode: string;
  name: string;
  price: number;
  description: string | null;
  cmsProductId: number;
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

export interface SelectedSyncItems {
  toAdd: number[];      // cmsProductId array
  toUpdate: number[];   // cmsProductId array
  toDelete: string[];   // id array
}

export default StoreProductService;

