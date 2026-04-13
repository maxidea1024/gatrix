import { ulid } from 'ulid';
import database from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { GatrixError } from '../middleware/error-handler';
import { createLogger } from '../config/logger';

const logger = createLogger('StoreProductService');
import { TagService } from './tag-service';
import { PlanningDataService } from './planning-data-service';
import { CmsCashShopProduct } from './cms-cash-shop-service';
import { pubSubService } from './pub-sub-service';
import { SERVER_SDK_ETAG } from '../constants/cache-keys';
import { convertFromMySQLDateTime } from '../utils/date-utils';

export interface StoreProduct {
  id: string;
  environmentId: string;
  isActive: boolean;
  productId: string;
  cmsProductId: string | null;
  productName: string;
  // Multi-language name fields
  nameKo: string | null;
  nameEn: string | null;
  nameZh: string | null;
  store: string;
  price: number;
  currency: string;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  description: string | null;
  // Multi-language description fields
  descriptionKo: string | null;
  descriptionEn: string | null;
  descriptionZh: string | null;
  metadata: Record<string, any> | null;
  overriddenFields: string[] | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: any[];
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
  saleStartAt?: Date | null;
  saleEndAt?: Date | null;
  description?: string;
  // Multi-language description fields
  descriptionKo?: string;
  descriptionEn?: string;
  descriptionZh?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  environmentId: string;
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
  saleStartAt?: Date | null;
  saleEndAt?: Date | null;
  description?: string;
  // Multi-language description fields
  descriptionKo?: string;
  descriptionEn?: string;
  descriptionZh?: string;
  metadata?: Record<string, any>;
  updatedBy?: string;
  overrideResets?: string[]; // Fields to reset to planning data values
}

export interface GetStoreProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  store?: string;
  isActive?: boolean;
  hasOverrides?: boolean;
  environmentId: string;
}

export interface GetStoreProductsResponse {
  products: StoreProduct[];
  total: number;
  overriddenTotal: number;
  page: number;
  limit: number;
}

class StoreProductService {
  /**
   * Get all store products with pagination
   */
  static async getStoreProducts(
    params: GetStoreProductsParams
  ): Promise<GetStoreProductsResponse> {
    const pool = database.getPool();
    // Ensure page and limit are numbers (query params come as strings)
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const search = params.search || '';
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = (params.sortOrder || 'desc').toUpperCase();
    const environmentId = params.environmentId;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['environmentId = ?'];
    const queryParams: (string | number | boolean | null)[] = [environmentId];

    if (search) {
      // Check if search is a number (for CMS ID search)
      const searchNumber = parseInt(search, 10);
      if (!isNaN(searchNumber)) {
        // Include cmsProductId exact match
        conditions.push(
          '(productId LIKE ? OR productName LIKE ? OR nameKo LIKE ? OR nameEn LIKE ? OR nameZh LIKE ? OR description LIKE ? OR cmsProductId = ?)'
        );
        const searchPattern = `%${search}%`;
        queryParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchNumber
        );
      } else {
        // Search by all name fields including localized names
        conditions.push(
          '(productId LIKE ? OR productName LIKE ? OR nameKo LIKE ? OR nameEn LIKE ? OR nameZh LIKE ? OR description LIKE ?)'
        );
        const searchPattern = `%${search}%`;
        queryParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
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

    if (params?.hasOverrides !== undefined) {
      // Stringified JSON empty array is '[]'
      if (params.hasOverrides) {
        conditions.push("overriddenFields IS NOT NULL AND overriddenFields != '[]'");
      } else {
        conditions.push("(overriddenFields IS NULL OR overriddenFields = '[]')");
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const allowedSortColumns = [
      'cmsProductId',
      'productId',
      'productName',
      'store',
      'price',
      'isActive',
      'saleStartAt',
      'saleEndAt',
      'createdAt',
      'updatedAt',
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    try {
      // Get total count and overridden count
      const [countResult] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total, SUM(CASE WHEN overriddenFields IS NOT NULL AND overriddenFields != '[]' THEN 1 ELSE 0 END) as overriddenTotal FROM g_store_products ${whereClause}`,
        queryParams
      );
      const total = Number(countResult[0].total) || 0;
      const overriddenTotal = Number(countResult[0].overriddenTotal) || 0;

      // Get products (use template literal for LIMIT/OFFSET as they are already validated numbers)
      const [products] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM g_store_products ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ${limit} OFFSET ${offset}`,
        queryParams
      );

      // Load tags for each product
      const productsWithTags = await Promise.all(
        products.map(async (product) => {
          const tags = await TagService.listTagsForEntity(
            'store_product',
            product.id
          );
          return {
            ...product,
            isActive: Boolean(product.isActive),
            metadata:
              typeof product.metadata === 'string'
                ? JSON.parse(product.metadata)
                : product.metadata,
            overriddenFields:
              typeof product.overriddenFields === 'string'
                ? JSON.parse(product.overriddenFields)
                : product.overriddenFields || null,
            tags,
          };
        })
      );

      return {
        products: productsWithTags as StoreProduct[],
        total,
        overriddenTotal,
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
  static async getStats(
    environmentId: string
  ): Promise<{ total: number; active: number; inactive: number; overridden: number }> {
    const pool = database.getPool();

    try {
      const [result] = await pool.execute<RowDataPacket[]>(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN overriddenFields IS NOT NULL AND overriddenFields != '[]' THEN 1 ELSE 0 END) as overridden
         FROM g_store_products
         WHERE environmentId = ?`,
        [environmentId]
      );

      const row = result[0];
      return {
        total: Number(row.total) || 0,
        active: Number(row.active) || 0,
        inactive: Number(row.inactive) || 0,
        overridden: Number(row.overridden) || 0,
      };
    } catch (error) {
      logger.error('Failed to get store product stats', { error });
      throw new GatrixError('Failed to get store product stats', 500);
    }
  }

  /**
   * Get store product by ID
   */
  static async getStoreProductById(
    id: string,
    environmentId: string
  ): Promise<StoreProduct> {
    const pool = database.getPool();

    try {
      const [products] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM g_store_products WHERE id = ? AND environmentId = ?',
        [id, environmentId]
      );

      if (products.length === 0) {
        throw new GatrixError('Store product not found', 404);
      }

      const product = products[0];
      const tags = await TagService.listTagsForEntity('store_product', id);

      return {
        ...product,
        isActive: Boolean(product.isActive),
        metadata:
          typeof product.metadata === 'string'
            ? JSON.parse(product.metadata)
            : product.metadata,
        overriddenFields:
          typeof product.overriddenFields === 'string'
            ? JSON.parse(product.overriddenFields)
            : product.overriddenFields || null,
        tags,
      } as StoreProduct;
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
  static async getStoreProductByIdAcrossEnvironments(
    id: string
  ): Promise<StoreProduct | null> {
    const pool = database.getPool();

    try {
      const [products] = await pool.execute<RowDataPacket[]>(
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
        metadata:
          typeof product.metadata === 'string'
            ? JSON.parse(product.metadata)
            : product.metadata,
        tags,
      } as StoreProduct;
    } catch (error) {
      logger.error('Failed to get store product by ID across environments', {
        error,
        id,
      });
      return null;
    }
  }

  /**
   * Create a new store product
   */
  static async createStoreProduct(
    input: CreateStoreProductInput
  ): Promise<StoreProduct> {
    const pool = database.getPool();
    const id = ulid();
    const environmentId = input.environmentId;

    try {
      await pool.execute(
        `INSERT INTO g_store_products
         (id, environmentId, isActive, productId, productName, nameKo, nameEn, nameZh,
          store, price, currency, saleStartAt, saleEndAt, description,
          descriptionKo, descriptionEn, descriptionZh, metadata, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          id,
          environmentId,
          input.isActive !== undefined ? (input.isActive ? 1 : 0) : 1,
          input.productId,
          input.productName,
          input.nameKo || null,
          input.nameEn || null,
          input.nameZh || null,
          input.store,
          input.price,
          input.currency || 'USD',
          input.saleStartAt ? new Date(input.saleStartAt) : null,
          input.saleEndAt ? new Date(input.saleEndAt) : null,
          input.description || null,
          input.descriptionKo || null,
          input.descriptionEn || null,
          input.descriptionZh || null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          input.createdBy || null,
        ]
      );

      const product = await this.getStoreProductById(id, environmentId);

      // Invalidate ETag cache and publish SDK event
      try {
        // Invalidate ETag cache so SDK fetches fresh data
        await pubSubService.invalidateKey(
          `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
        );

        await pubSubService.publishSDKEvent(
          {
            type: 'store_product.created',
            data: {
              id,
              environmentId: environmentId,
              isActive: product?.isActive ? 1 : 0,
            },
          },
          { environmentId: environmentId }
        );
      } catch (eventError) {
        logger.warn('Failed to publish store product SDK event', {
          eventError,
          id,
        });
      }

      return product;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new GatrixError(
          'A product with this ID and store already exists',
          409
        );
      }
      logger.error('Failed to create store product', { error, input });
      throw new GatrixError('Failed to create store product', 500);
    }
  }

  /**
   * Update an existing store product
   */
  static async updateStoreProduct(
    id: string,
    input: UpdateStoreProductInput,
    environmentId: string
  ): Promise<StoreProduct> {
    const pool = database.getPool();

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | boolean | Date | null)[] = [];

    if (input.productId !== undefined) {
      updates.push('productId = ?');
      values.push(input.productId);
    }
    if (input.productName !== undefined) {
      updates.push('productName = ?');
      values.push(input.productName);
    }
    // Multi-language name fields
    if (input.nameKo !== undefined) {
      updates.push('nameKo = ?');
      values.push(input.nameKo);
    }
    if (input.nameEn !== undefined) {
      updates.push('nameEn = ?');
      values.push(input.nameEn);
    }
    if (input.nameZh !== undefined) {
      updates.push('nameZh = ?');
      values.push(input.nameZh);
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
      values.push(input.saleStartAt ? new Date(input.saleStartAt) : null);
    }
    if (input.saleEndAt !== undefined) {
      updates.push('saleEndAt = ?');
      values.push(input.saleEndAt ? new Date(input.saleEndAt) : null);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    // Multi-language description fields
    if (input.descriptionKo !== undefined) {
      updates.push('descriptionKo = ?');
      values.push(input.descriptionKo);
    }
    if (input.descriptionEn !== undefined) {
      updates.push('descriptionEn = ?');
      values.push(input.descriptionEn);
    }
    if (input.descriptionZh !== undefined) {
      updates.push('descriptionZh = ?');
      values.push(input.descriptionZh);
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
      return this.getStoreProductById(id, environmentId);
    }

    // Track overridden fields: compare with planning data to detect real overrides
    const OVERRIDABLE_FIELDS = [
      'productId',
      'productName',
      'nameKo',
      'nameEn',
      'nameZh',
      'store',
      'price',
      'currency',
      'saleStartAt',
      'saleEndAt',
      'description',
      'descriptionKo',
      'descriptionEn',
      'descriptionZh',
    ];
    try {
      const [existingRows] = await pool.execute(
        'SELECT * FROM g_store_products WHERE id = ? AND environmentId = ?',
        [id, environmentId]
      );
      const existing = (existingRows as any[])[0];
      if (existing) {
        let currentOverrides: string[] = [];
        if (existing.overriddenFields) {
          currentOverrides =
            typeof existing.overriddenFields === 'string'
              ? JSON.parse(existing.overriddenFields)
              : existing.overriddenFields;
        }

        // Fetch planning data to compare final values against source of truth
        let planningValues: Record<string, any> = {};
        if (existing.cmsProductId) {
          try {
            const planningData =
              await PlanningDataService.getCashShopLookup(environmentId);
            const planningProducts = planningData?.items || [];
            const planningProduct = planningProducts.find(
              (p: any) => p.id === existing.cmsProductId
            );
            if (planningProduct) {
              planningValues = {
                productId: planningProduct.productCode,
                productName:
                  planningProduct.name?.zh || planningProduct.name?.ko || '',
                nameKo: planningProduct.name?.ko || null,
                nameEn: planningProduct.name?.en || null,
                nameZh: planningProduct.name?.zh || null,
                store: 'sdo',
                price: planningProduct.price,
                currency: 'CNY',
                description:
                  planningProduct.description?.zh ||
                  planningProduct.description?.ko ||
                  null,
                descriptionKo: planningProduct.description?.ko || null,
                descriptionEn: planningProduct.description?.en || null,
                descriptionZh: planningProduct.description?.zh || null,
              };
            }
          } catch (err) {
            logger.debug(
              'Could not fetch planning data for override comparison',
              { err }
            );
          }
        }

        // Determine which fields should be overridden based on final saved value vs planning data
        const newOverrides: string[] = [];
        for (const field of OVERRIDABLE_FIELDS) {
          const inputVal = input[field as keyof UpdateStoreProductInput];
          // Use input value if provided, otherwise current DB value
          const finalVal = inputVal !== undefined ? inputVal : existing[field];

          // If no planning data for this field, compare against DB value
          if (!(field in planningValues)) {
            if (inputVal !== undefined) {
              // Check if input differs from DB value
              const dbVal = existing[field];
              let normInput: any = inputVal;
              let normDb: any = dbVal;
              if (field === 'price') {
                normInput = Number(inputVal ?? 0);
                normDb = Number(dbVal ?? 0);
              } else {
                normInput =
                  inputVal === '' || inputVal == null ? null : String(inputVal);
                normDb = dbVal === '' || dbVal == null ? null : String(dbVal);
              }
              if (normInput !== normDb) {
                newOverrides.push(field);
              } else if (currentOverrides.includes(field)) {
                newOverrides.push(field);
              }
            } else if (currentOverrides.includes(field)) {
              newOverrides.push(field);
            }
            continue;
          }

          const planningVal = planningValues[field];

          // Normalize for comparison
          let normalizedFinal: any = finalVal;
          let normalizedPlanning: any = planningVal;

          if (field === 'price') {
            normalizedFinal = Number(finalVal ?? 0);
            normalizedPlanning = Number(planningVal ?? 0);
          } else if (field === 'saleStartAt' || field === 'saleEndAt') {
            // finalVal could be a raw mysql2 Date. We MUST use convertFromMySQLDateTime
            // to properly recover the correct UTC string representation.
            const isoFinal = convertFromMySQLDateTime(finalVal as Date | string | null);
            const isoPlanning = planningVal
              ? new Date(planningVal).toISOString()
              : null;
            normalizedFinal = isoFinal ? new Date(isoFinal).getTime() : null;
            normalizedPlanning = isoPlanning ? new Date(isoPlanning).getTime() : null;
          } else {
            normalizedFinal =
              finalVal === '' || finalVal == null ? null : String(finalVal);
            normalizedPlanning =
              planningVal === '' || planningVal == null
                ? null
                : String(planningVal);
          }

          if (normalizedFinal !== normalizedPlanning) {
            // Value differs from planning data → override
            newOverrides.push(field);
          }
          // else: value matches planning data → no override (auto-cleared)
        }

        const uniqueOverrides = [...new Set(newOverrides)];
        if (
          JSON.stringify(uniqueOverrides.sort()) !==
          JSON.stringify(currentOverrides.sort())
        ) {
          updates.push('overriddenFields = ?');
          values.push(
            uniqueOverrides.length > 0 ? JSON.stringify(uniqueOverrides) : null
          );
        }
      }
    } catch (err) {
      // Column might not exist yet (pre-migration), skip
      logger.debug('Could not update overriddenFields', { err });
    }

    // Handle overrideResets: restore specified fields to planning data values
    if (input.overrideResets && input.overrideResets.length > 0) {
      try {
        // Get current product to find cmsProductId
        const [currentRows] = await pool.execute(
          'SELECT cmsProductId, overriddenFields FROM g_store_products WHERE id = ? AND environmentId = ?',
          [id, environmentId]
        );
        const current = (currentRows as any[])[0];
        if (current?.cmsProductId) {
          const planningData =
            await PlanningDataService.getCashShopLookup(environmentId);
          const planningProducts: CmsCashShopProduct[] =
            planningData.items || [];
          const planningProduct = planningProducts.find(
            (p: CmsCashShopProduct) => p.id === current.cmsProductId
          );

          if (planningProduct) {
            const fieldValueMap: Record<string, any> = {
              productId: planningProduct.productCode,
              productName:
                planningProduct.name?.zh || planningProduct.name?.ko || '',
              nameKo: planningProduct.name?.ko || '',
              nameEn: planningProduct.name?.en || '',
              nameZh: planningProduct.name?.zh || '',
              store: 'sdo',
              price: planningProduct.price,
              currency: 'CNY',
              description:
                planningProduct.description?.zh ||
                planningProduct.description?.ko ||
                null,
              descriptionKo: planningProduct.description?.ko || null,
              descriptionEn: planningProduct.description?.en || null,
              descriptionZh: planningProduct.description?.zh || null,
            };

            for (const resetField of input.overrideResets) {
              if (resetField in fieldValueMap) {
                // Check if this field isn't already being explicitly set by the user in this same update
                const isAlsoBeingUpdated = updates.some((u) =>
                  u.startsWith(`${resetField} = ?`)
                );
                if (!isAlsoBeingUpdated) {
                  updates.push(`${resetField} = ?`);
                  values.push(fieldValueMap[resetField]);
                }
              }
            }

            // Remove reset fields from overriddenFields
            let currentOverrides: string[] = current.overriddenFields
              ? typeof current.overriddenFields === 'string'
                ? JSON.parse(current.overriddenFields)
                : current.overriddenFields
              : [];
            currentOverrides = currentOverrides.filter(
              (f) => !input.overrideResets!.includes(f)
            );

            // Update overriddenFields (might already have been pushed by the tracking logic above)
            const existingOverrideIdx = updates.findIndex(
              (u) => u === 'overriddenFields = ?'
            );
            if (existingOverrideIdx >= 0) {
              // Merge: the tracking logic added new overrides; now also remove the reset ones
              const trackedValue = JSON.parse(
                values[existingOverrideIdx] as string
              );
              const merged = trackedValue.filter(
                (f: string) => !input.overrideResets!.includes(f)
              );
              values[existingOverrideIdx] =
                merged.length > 0 ? JSON.stringify(merged) : null;
            } else {
              updates.push('overriddenFields = ?');
              values.push(
                currentOverrides.length > 0
                  ? JSON.stringify(currentOverrides)
                  : null
              );
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to process overrideResets', {
          err,
          overrideResets: input.overrideResets,
        });
      }
    }

    updates.push('updatedAt = UTC_TIMESTAMP()');
    values.push(id, environmentId);

    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE g_store_products SET ${updates.join(', ')} WHERE id = ? AND environmentId = ?`,
        values
      );

      if (result.affectedRows === 0) {
        throw new GatrixError('Store product not found', 404);
      }

      const product = await this.getStoreProductById(id, environmentId);

      // Invalidate ETag cache and publish SDK event
      try {
        // Invalidate ETag cache so SDK fetches fresh data
        await pubSubService.invalidateKey(
          `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
        );

        await pubSubService.publishSDKEvent(
          {
            type: 'store_product.updated',
            data: {
              id,
              environmentId: environmentId,
              isActive: product?.isActive ? 1 : 0,
            },
          },
          { environmentId: environmentId }
        );
      } catch (eventError) {
        logger.warn('Failed to publish store product SDK event', {
          eventError,
          id,
        });
      }

      return product;
    } catch (error: any) {
      if (error instanceof GatrixError) throw error;
      if (error.code === 'ER_DUP_ENTRY') {
        throw new GatrixError(
          'A product with this ID and store already exists',
          409
        );
      }
      logger.error('Failed to update store product', { error, id, input });
      throw new GatrixError('Failed to update store product', 500);
    }
  }

  /**
   * Delete a store product
   */
  static async deleteStoreProduct(
    id: string,
    environmentId: string
  ): Promise<void> {
    const pool = database.getPool();

    try {
      // Delete associated tags first (set to empty array)
      await TagService.setTagsForEntity('store_product', id, []);

      const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM g_store_products WHERE id = ? AND environmentId = ?',
        [id, environmentId]
      );

      if (result.affectedRows === 0) {
        throw new GatrixError('Store product not found', 404);
      }

      // Invalidate ETag cache and publish SDK event
      try {
        // Invalidate ETag cache so SDK fetches fresh data
        await pubSubService.invalidateKey(
          `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
        );

        await pubSubService.publishSDKEvent(
          {
            type: 'store_product.deleted',
            data: {
              id,
              environmentId: environmentId,
            },
          },
          { environmentId: environmentId }
        );
      } catch (eventError) {
        logger.warn('Failed to publish store product SDK event', {
          eventError,
          id,
        });
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
  static async deleteStoreProducts(
    ids: string[],
    environmentId: string
  ): Promise<number> {
    const pool = database.getPool();

    if (ids.length === 0) return 0;

    try {
      // Delete associated tags first (set to empty array)
      for (const id of ids) {
        await TagService.setTagsForEntity('store_product', id, []);
      }

      const placeholders = ids.map(() => '?').join(',');
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM g_store_products WHERE id IN (${placeholders}) AND environmentId = ?`,
        [...ids, environmentId]
      );

      // Invalidate ETag cache and publish SDK events for each deleted product
      if (result.affectedRows > 0) {
        try {
          // Invalidate ETag cache so SDK fetches fresh data
          await pubSubService.invalidateKey(
            `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
          );

          for (const id of ids) {
            await pubSubService.publishSDKEvent(
              {
                type: 'store_product.deleted',
                data: {
                  id,
                  environmentId: environmentId,
                },
              },
              { environmentId: environmentId }
            );
          }
        } catch (eventError) {
          logger.warn('Failed to publish store product SDK event', {
            eventError,
            ids,
          });
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
  static async toggleActive(
    id: string,
    isActive: boolean,
    updatedBy: string,
    environmentId: string
  ): Promise<StoreProduct> {
    return this.updateStoreProduct(id, { isActive, updatedBy }, environmentId);
  }

  /**
   * Bulk update active status for multiple products
   */
  static async bulkUpdateActiveStatus(
    ids: string[],
    isActive: boolean,
    updatedBy: string,
    environmentId: string
  ): Promise<number> {
    const pool = database.getPool();

    if (ids.length === 0) return 0;

    try {
      const placeholders = ids.map(() => '?').join(',');
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE g_store_products SET isActive = ?, updatedBy = ?, updatedAt = UTC_TIMESTAMP() WHERE id IN (${placeholders}) AND environmentId = ?`,
        [isActive ? 1 : 0, updatedBy || null, ...ids, environmentId]
      );

      // Invalidate ETag cache and publish SDK events for each updated product
      if (result.affectedRows > 0) {
        try {
          // Invalidate ETag cache so SDK fetches fresh data
          await pubSubService.invalidateKey(
            `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
          );

          for (const id of ids) {
            await pubSubService.publishSDKEvent(
              {
                type: 'store_product.updated',
                data: {
                  id,
                  environmentId: environmentId,
                  isActive: isActive ? 1 : 0,
                },
              },
              { environmentId: environmentId }
            );
          }
        } catch (eventError) {
          logger.warn('Failed to publish store product SDK event', {
            eventError,
            ids,
          });
        }
      }

      return result.affectedRows;
    } catch (error) {
      logger.error('Failed to bulk update active status', {
        error,
        ids,
        isActive,
      });
      throw new GatrixError('Failed to bulk update active status', 500);
    }
  }

  /**
   * Bulk update active status by filter (search term and/or current isActive status)
   * Returns the count of affected products
   */
  static async bulkUpdateActiveStatusByFilter(
    params: {
      search?: string;
      currentIsActive?: boolean;
      targetIsActive: boolean;
      environmentId: string;
    },
    updatedBy?: string
  ): Promise<{ affectedCount: number; affectedIds: string[] }> {
    const pool = database.getPool();
    const environmentId = params.environmentId;

    try {
      // Build WHERE clause
      const conditions: string[] = ['environmentId = ?'];
      const queryParams: (string | number | boolean | null)[] = [environmentId];

      if (params.search) {
        conditions.push(
          '(productId LIKE ? OR productName LIKE ? OR nameKo LIKE ? OR nameEn LIKE ? OR nameZh LIKE ?)'
        );
        const searchPattern = `%${params.search}%`;
        queryParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
      }

      if (params.currentIsActive !== undefined) {
        conditions.push('isActive = ?');
        queryParams.push(params.currentIsActive ? 1 : 0);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // First, get the IDs that will be affected
      const [affectedRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM g_store_products ${whereClause}`,
        queryParams
      );
      const affectedIds = affectedRows.map((row: RowDataPacket) => row.id);

      if (affectedIds.length === 0) {
        return { affectedCount: 0, affectedIds: [] };
      }

      // Perform the update
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE g_store_products SET isActive = ?, updatedBy = ?, updatedAt = UTC_TIMESTAMP() ${whereClause}`,
        [params.targetIsActive ? 1 : 0, updatedBy || null, ...queryParams]
      );

      // Invalidate ETag cache and publish SDK events
      if (result.affectedRows > 0) {
        try {
          // Invalidate ETag cache so SDK fetches fresh data
          await pubSubService.invalidateKey(
            `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
          );

          // Publish a batch event instead of individual events for performance
          await pubSubService.publishSDKEvent(
            {
              type: 'store_product.bulk_updated',
              data: {
                count: result.affectedRows,
                environmentId: environmentId,
                isActive: params.targetIsActive ? 1 : 0,
              },
            },
            { environmentId: environmentId }
          );

          logger.info('Published store product bulk update SDK event', {
            count: result.affectedRows,
            environmentId: environmentId,
            isActive: params.targetIsActive,
          });
        } catch (eventError) {
          logger.warn('Failed to publish store product SDK event', {
            eventError,
          });
        }
      }

      return { affectedCount: result.affectedRows, affectedIds };
    } catch (error) {
      logger.error('Failed to bulk update active status by filter', {
        error,
        params,
      });
      throw new GatrixError(
        'Failed to bulk update active status by filter',
        500
      );
    }
  }

  /**
   * Get count of products matching filter criteria
   */
  static async getCountByFilter(params: {
    search?: string;
    isActive?: boolean;
    environmentId: string;
  }): Promise<number> {
    const pool = database.getPool();
    const environmentId = params.environmentId;

    try {
      // Build WHERE clause
      const conditions: string[] = ['environmentId = ?'];
      const queryParams: (string | number | boolean | null)[] = [environmentId];

      if (params.search) {
        conditions.push(
          '(productId LIKE ? OR productName LIKE ? OR nameKo LIKE ? OR nameEn LIKE ? OR nameZh LIKE ?)'
        );
        const searchPattern = `%${params.search}%`;
        queryParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
      }

      if (params.isActive !== undefined) {
        conditions.push('isActive = ?');
        queryParams.push(params.isActive ? 1 : 0);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM g_store_products ${whereClause}`,
        queryParams
      );

      return rows[0].total;
    } catch (error) {
      logger.error('Failed to get count by filter', { error, params });
      throw new GatrixError('Failed to get count by filter', 500);
    }
  }

  /**
   * Preview sync with planning data
   * Returns what changes would be made without applying them
   */
  static async previewSync(environmentId: string): Promise<SyncPreviewResult> {
    try {
      // Get planning data products (unified multi-language file)
      const planningData =
        await PlanningDataService.getCashShopLookup(environmentId);
      const planningProducts: CmsCashShopProduct[] = planningData.items || [];

      // Get current DB products
      const pool = database.getPool();
      const [rows] = await pool.execute(
        'SELECT * FROM g_store_products WHERE environmentId = ?',
        [environmentId]
      );
      const dbProducts = rows as StoreProduct[];

      // Create maps for comparison - use id as key (productCode can be duplicated)
      const planningMap = new Map<string, CmsCashShopProduct>();
      for (const p of planningProducts) {
        planningMap.set(p.id, p);
      }

      const dbMap = new Map<string, StoreProduct>();
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
        // Find DB product by CMS ID only (productCode can be duplicated)
        const dbProduct = dbMap.get(cmsProductId);

        // Get multi-language values from planning data
        const nameKo = planningProduct.name?.ko || '';
        const nameEn = planningProduct.name?.en || '';
        const nameZh = planningProduct.name?.zh || '';
        const descKo = planningProduct.description?.ko || null;
        const descEn = planningProduct.description?.en || null;
        const descZh = planningProduct.description?.zh || null;

        if (!dbProduct) {
          // New product to add
          toAdd.push({
            productCode: planningProduct.productCode,
            name: nameZh || nameKo, // Default display name (zh preferred)
            nameKo,
            nameEn,
            nameZh,
            price: planningProduct.price,
            description: descZh || descKo, // Default display description (zh preferred)
            descriptionKo: descKo,
            descriptionEn: descEn,
            descriptionZh: descZh,
            saleStartAt: planningProduct.saleStartAt || null,
            saleEndAt: planningProduct.saleEndAt || null,
            cmsProductId: planningProduct.id,
          });
        } else {
          // Check for changes
          const changes: SyncChange[] = [];

          // Check multi-language name changes
          if (dbProduct.nameKo !== nameKo) {
            changes.push({
              field: 'nameKo',
              oldValue: dbProduct.nameKo,
              newValue: nameKo,
            });
          }
          if (dbProduct.nameEn !== nameEn) {
            changes.push({
              field: 'nameEn',
              oldValue: dbProduct.nameEn,
              newValue: nameEn,
            });
          }
          if (dbProduct.nameZh !== nameZh) {
            changes.push({
              field: 'nameZh',
              oldValue: dbProduct.nameZh,
              newValue: nameZh,
            });
          }

          // Check productCode (productId) change
          if (dbProduct.productId !== planningProduct.productCode) {
            changes.push({
              field: 'productId',
              oldValue: dbProduct.productId,
              newValue: planningProduct.productCode,
            });
          }

          if (Number(dbProduct.price) !== planningProduct.price) {
            changes.push({
              field: 'price',
              oldValue: dbProduct.price,
              newValue: planningProduct.price,
            });
          }

          // Check multi-language description changes
          if ((dbProduct.descriptionKo || '') !== (descKo || '')) {
            changes.push({
              field: 'descriptionKo',
              oldValue: dbProduct.descriptionKo,
              newValue: descKo,
            });
          }
          if ((dbProduct.descriptionEn || '') !== (descEn || '')) {
            changes.push({
              field: 'descriptionEn',
              oldValue: dbProduct.descriptionEn,
              newValue: descEn,
            });
          }
          if ((dbProduct.descriptionZh || '') !== (descZh || '')) {
            changes.push({
              field: 'descriptionZh',
              oldValue: dbProduct.descriptionZh,
              newValue: descZh,
            });
          }

          // Check date changes
          const checkDateChange = (field: string, dbVal: Date | string | null | undefined, planVal: string | null | undefined) => {
            const getIso = (val: Date | string | null | undefined) => {
              if (!val) return null;
              const d = typeof val === 'string' ? new Date(val) : val;
              if (isNaN(d.getTime())) return null;
              return d.toISOString();
            };
            const isoDb = getIso(dbVal);
            const isoPl = getIso(planVal);
            if (isoDb !== isoPl) {
              changes.push({
                field,
                oldValue: isoDb,
                newValue: isoPl,
              });
            }
          };

          checkDateChange(
            'saleStartAt',
            dbProduct.saleStartAt,
            planningProduct.saleStartAt
          );
          checkDateChange(
            'saleEndAt',
            dbProduct.saleEndAt,
            planningProduct.saleEndAt
          );

          // Skip changes for fields that are overridden by user
          const overrides: string[] = dbProduct.overriddenFields
            ? typeof dbProduct.overriddenFields === 'string'
              ? JSON.parse(dbProduct.overriddenFields as any)
              : dbProduct.overriddenFields
            : [];

          if (changes.length > 0) {
            // Separate changes into applicable and skipped (overridden)
            const applicableChanges = changes.filter(
              (c) => !overrides.includes(c.field)
            );
            const skippedChanges = changes.filter((c) =>
              overrides.includes(c.field)
            );

            if (applicableChanges.length > 0) {
              toUpdate.push({
                id: dbProduct.id,
                cmsProductId: planningProduct.id,
                productCode: planningProduct.productCode,
                name: nameZh || nameKo, // Default display name
                changes: applicableChanges,
                skippedChanges,
                hasOverrides: overrides.length > 0,
              });
            }
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
      logger.error('Failed to preview sync', { error, environmentId });
      throw new GatrixError('Failed to preview sync with planning data', 500);
    }
  }

  /**
   * Apply sync with planning data (selective)
   */
  static async applySync(
    environmentId: string,
    userId?: string,
    selected?: SelectedSyncItems
  ): Promise<SyncApplyResult> {
    const pool = database.getPool();
    const preview = await this.previewSync(environmentId);

    // Filter items based on selection if provided
    const toAddFiltered = selected?.toAdd
      ? preview.toAdd.filter((item) =>
        selected.toAdd.includes(item.cmsProductId)
      )
      : preview.toAdd;
    const toUpdateFiltered = selected?.toUpdate
      ? preview.toUpdate.filter((item) =>
        selected.toUpdate.includes(item.cmsProductId)
      )
      : preview.toUpdate;
    const toDeleteFiltered = selected?.toDelete
      ? preview.toDelete.filter((item) => selected.toDelete.includes(item.id))
      : preview.toDelete;

    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    try {
      // Add new products with multi-language columns
      for (const item of toAddFiltered) {
        const id = ulid();
        await pool.execute(
          `INSERT INTO g_store_products
           (id, environmentId, isActive, productId, cmsProductId, productName,
            nameKo, nameEn, nameZh, store, price, currency,
            saleStartAt, saleEndAt, description, descriptionKo, descriptionEn, descriptionZh,
            metadata, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
          [
            id,
            environmentId,
            0, // isActive = false for new products
            item.productCode,
            item.cmsProductId,
            item.name, // productName (default display name)
            item.nameKo,
            item.nameEn,
            item.nameZh,
            'sdo', // Default store
            item.price,
            'CNY', // Default currency
            item.saleStartAt ? new Date(item.saleStartAt) : null, // saleStartAt
            item.saleEndAt ? new Date(item.saleEndAt) : null, // saleEndAt
            item.description, // description (default display description)
            item.descriptionKo,
            item.descriptionEn,
            item.descriptionZh,
            null, // metadata
            userId || null,
          ]
        );
        addedCount++;
      }

      // Update existing products with multi-language columns
      for (const item of toUpdateFiltered) {
        const updates: string[] = [];
        const values: any[] = [];

        // Only apply non-overridden changes (item.changes already filtered by previewSync)
        for (const change of item.changes) {
          const field = change.field;
          // Handle multi-language fields and productId
          if (
            [
              'nameKo',
              'nameEn',
              'nameZh',
              'descriptionKo',
              'descriptionEn',
              'descriptionZh',
              'price',
              'productId',
              'saleStartAt',
              'saleEndAt',
            ].includes(field)
          ) {
            updates.push(`${field} = ?`);
            if (field === 'saleStartAt' || field === 'saleEndAt') {
              values.push(change.newValue ? new Date(change.newValue) : null);
            } else {
              values.push(change.newValue ?? null);
            }
          }
        }

        // Also update productName and description with default language values
        // but only if those fields are not overridden
        const nameZhChange = item.changes.find((c) => c.field === 'nameZh');
        const nameKoChange = item.changes.find((c) => c.field === 'nameKo');
        if (nameZhChange || nameKoChange) {
          // Check if productName is overridden
          const isProductNameOverridden =
            (item as any).hasOverrides &&
            (item as any).skippedChanges?.some(
              (c: any) => c.field === 'productName'
            );
          if (!isProductNameOverridden) {
            updates.push('productName = ?');
            values.push(nameZhChange?.newValue || nameKoChange?.newValue || '');
          }
        }

        const descZhChange = item.changes.find(
          (c) => c.field === 'descriptionZh'
        );
        const descKoChange = item.changes.find(
          (c) => c.field === 'descriptionKo'
        );
        if (descZhChange || descKoChange) {
          // Check if description is overridden
          const isDescOverridden =
            (item as any).hasOverrides &&
            (item as any).skippedChanges?.some(
              (c: any) => c.field === 'description'
            );
          if (!isDescOverridden) {
            updates.push('description = ?');
            values.push(
              descZhChange?.newValue || descKoChange?.newValue || null
            );
          }
        }

        if (updates.length > 0) {
          updates.push('updatedBy = ?');
          values.push(userId || null);
          updates.push('updatedAt = UTC_TIMESTAMP()');
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
        await pool.execute('DELETE FROM g_store_products WHERE id = ?', [
          item.id,
        ]);
        deletedCount++;
      }

      logger.info('Sync applied successfully', {
        environmentId,
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
      logger.error('Failed to apply sync', { error, environmentId });
      throw new GatrixError('Failed to apply sync with planning data', 500);
    }
  }

  /**
   * Get planning data values for a specific product.
   * Used by frontend to preview what values fields will revert to.
   */
  static async getPlanningValues(
    id: string,
    environmentId: string
  ): Promise<Record<string, any> | null> {
    const product = await this.getStoreProductById(id, environmentId);
    if (!product || !product.cmsProductId) {
      return null;
    }

    const planningData =
      await PlanningDataService.getCashShopLookup(environmentId);
    const planningProducts: CmsCashShopProduct[] = planningData.items || [];
    const planningProduct = planningProducts.find(
      (p) => p.id === product.cmsProductId
    );

    if (!planningProduct) {
      return null;
    }

    return {
      productId: planningProduct.productCode,
      productName: planningProduct.name?.zh || planningProduct.name?.ko || '',
      nameKo: planningProduct.name?.ko || null,
      nameEn: planningProduct.name?.en || null,
      nameZh: planningProduct.name?.zh || null,
      store: 'sdo',
      price: planningProduct.price,
      currency: 'CNY',
      description:
        planningProduct.description?.zh ||
        planningProduct.description?.ko ||
        null,
      descriptionKo: planningProduct.description?.ko || null,
      descriptionEn: planningProduct.description?.en || null,
      descriptionZh: planningProduct.description?.zh || null,
      saleStartAt: planningProduct.saleStartAt || null,
      saleEndAt: planningProduct.saleEndAt || null,
    };
  }

  /**
   * Reset all overrides for a store product, reverting to planning data values.
   * Clears overriddenFields and restores all fields from the planning data source.
   */
  static async resetOverrides(
    id: string,
    environmentId: string,
    userId?: string
  ): Promise<StoreProduct> {
    const pool = database.getPool();

    // Get current product
    const product = await this.getStoreProductById(id, environmentId);
    if (!product) {
      throw new GatrixError('Store product not found', 404);
    }

    if (!product.cmsProductId) {
      // No CMS product ID — just clear the overrides flag
      await pool.execute(
        'UPDATE g_store_products SET overriddenFields = NULL, updatedBy = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ? AND environmentId = ?',
        [userId || null, id, environmentId]
      );
      return this.getStoreProductById(id, environmentId);
    }

    // Get planning data to restore values
    const planningData =
      await PlanningDataService.getCashShopLookup(environmentId);
    const planningProducts: CmsCashShopProduct[] = planningData.items || [];
    const planningProduct = planningProducts.find(
      (p) => p.id === product.cmsProductId
    );

    if (!planningProduct) {
      // Planning data not found — just clear the overrides flag
      await pool.execute(
        'UPDATE g_store_products SET overriddenFields = NULL, updatedBy = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ? AND environmentId = ?',
        [userId || null, id, environmentId]
      );
      return this.getStoreProductById(id, environmentId);
    }

    // Restore all fields from planning data
    const nameKo = planningProduct.name?.ko || '';
    const nameEn = planningProduct.name?.en || '';
    const nameZh = planningProduct.name?.zh || '';
    const descKo = planningProduct.description?.ko || null;
    const descEn = planningProduct.description?.en || null;
    const descZh = planningProduct.description?.zh || null;

    await pool.execute(
      `UPDATE g_store_products SET
        productId = ?, productName = ?, nameKo = ?, nameEn = ?, nameZh = ?,
        price = ?, description = ?, descriptionKo = ?, descriptionEn = ?, descriptionZh = ?,
        saleStartAt = ?, saleEndAt = ?,
        overriddenFields = NULL, updatedBy = ?, updatedAt = UTC_TIMESTAMP()
       WHERE id = ? AND environmentId = ?`,
      [
        planningProduct.productCode,
        nameZh || nameKo,
        nameKo,
        nameEn,
        nameZh,
        planningProduct.price,
        descZh || descKo,
        descKo,
        descEn,
        descZh,
        planningProduct.saleStartAt || null,
        planningProduct.saleEndAt || null,
        userId || null,
        id,
        environmentId,
      ]
    );

    // Invalidate cache
    try {
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
      );
    } catch (err) {
      logger.warn('Failed to invalidate cache after override reset', { err });
    }

    return this.getStoreProductById(id, environmentId);
  }

  /**
   * Reset a single field override, reverting that field to its planning data value.
   */
  static async resetFieldOverride(
    id: string,
    environmentId: string,
    field: string,
    userId?: string
  ): Promise<StoreProduct> {
    const pool = database.getPool();

    // Get current product
    const product = await this.getStoreProductById(id, environmentId);
    if (!product) {
      throw new GatrixError('Store product not found', 404);
    }

    // Get planning data
    if (!product.cmsProductId) {
      throw new GatrixError(
        'Product has no CMS reference — cannot restore field from planning data',
        400
      );
    }

    const planningData =
      await PlanningDataService.getCashShopLookup(environmentId);
    const planningProducts: CmsCashShopProduct[] = planningData.items || [];
    const planningProduct = planningProducts.find(
      (p) => p.id === product.cmsProductId
    );

    if (!planningProduct) {
      throw new GatrixError('Planning data for this product not found', 404);
    }

    // Map field name to planning data value
    const fieldValueMap: Record<string, any> = {
      productId: planningProduct.productCode,
      productName: planningProduct.name?.zh || planningProduct.name?.ko || '',
      nameKo: planningProduct.name?.ko || '',
      nameEn: planningProduct.name?.en || '',
      nameZh: planningProduct.name?.zh || '',
      store: 'sdo', // Default store from planning data
      price: planningProduct.price,
      currency: 'CNY', // Default currency from planning data
      description:
        planningProduct.description?.zh ||
        planningProduct.description?.ko ||
        null,
      descriptionKo: planningProduct.description?.ko || null,
      descriptionEn: planningProduct.description?.en || null,
      descriptionZh: planningProduct.description?.zh || null,
      saleStartAt: planningProduct.saleStartAt || null,
      saleEndAt: planningProduct.saleEndAt || null,
    };

    if (!(field in fieldValueMap)) {
      throw new GatrixError(
        `Field '${field}' cannot be restored from planning data`,
        400
      );
    }

    // Update the field value
    let value = fieldValueMap[field];
    if (field === 'saleStartAt' || field === 'saleEndAt') {
      value = value ? new Date(value) : null;
    }

    await pool.execute(
      `UPDATE g_store_products SET \`${field}\` = ?, updatedBy = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ? AND environmentId = ?`,
      [value, userId || null, id, environmentId]
    );

    // Remove field from overriddenFields
    let currentOverrides: string[] = product.overriddenFields || [];
    currentOverrides = currentOverrides.filter((f) => f !== field);
    await pool.execute(
      'UPDATE g_store_products SET overriddenFields = ? WHERE id = ? AND environmentId = ?',
      [
        currentOverrides.length > 0 ? JSON.stringify(currentOverrides) : null,
        id,
        environmentId,
      ]
    );

    // Invalidate cache
    try {
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environmentId}`
      );
    } catch (err) {
      logger.warn('Failed to invalidate cache after field override reset', {
        err,
      });
    }

    return this.getStoreProductById(id, environmentId);
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
  name: string; // Display name (default language)
  nameKo: string;
  nameEn: string;
  nameZh: string;
  price: number;
  description: string | null; // Display description (default language)
  descriptionKo: string | null;
  descriptionEn: string | null;
  descriptionZh: string | null;
  saleStartAt: string | null;
  saleEndAt: string | null;
  cmsProductId: string;
}

export interface SyncUpdateItem {
  id: string;
  cmsProductId: string;
  productCode: string;
  name: string;
  changes: SyncChange[];
  skippedChanges?: SyncChange[];
  hasOverrides?: boolean;
}

export interface SyncDeleteItem {
  id: string;
  cmsProductId: string | null;
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
  toAdd: string[]; // cmsProductId array
  toUpdate: string[]; // cmsProductId array
  toDelete: string[]; // id array
}

export default StoreProductService;
