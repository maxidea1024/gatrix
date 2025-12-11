import { Response } from 'express';
import StoreProductService from '../services/StoreProductService';
import { TagService } from '../services/TagService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import { EnvironmentRequest } from '../middleware/environmentResolver';

/**
 * Strip internal fields from store product for SDK response
 * Removes: id, isActive, metadata, createdBy, updatedBy, createdAt, updatedAt, environmentId
 */
function stripInternalFields(product: any, tags: any[]) {
  const {
    id: _id,
    isActive: _isActive,
    metadata: _metadata,
    createdBy: _createdBy,
    updatedBy: _updatedBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    environmentId: _envId,
    ...cleanProduct
  } = product;

  // Suppress unused variable warnings
  void _id;
  void _isActive;
  void _metadata;
  void _createdBy;
  void _updatedBy;
  void _createdAt;
  void _updatedAt;
  void _envId;

  return {
    ...cleanProduct,
    tags: tags || [],
  };
}

/**
 * Server SDK Store Product Controller
 * Handles store product list retrieval for server-side SDK
 */
export class ServerStoreProductController {
  /**
   * Get store products for a specific environment
   * GET /api/v1/server/:env/store-products
   * Returns all active store products with tags for the specified environment
   */
  static async getStoreProducts(req: EnvironmentRequest, res: Response) {
    try {
      const environment = req.environment!;

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environment.id}`,
        ttlMs: DEFAULT_CONFIG.STORE_PRODUCT_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const result = await StoreProductService.getStoreProducts({
            environmentId: environment.id,
            limit: 1000,
            page: 1,
            isActive: true,
          });

          // Fetch tags for each product and strip internal fields
          const productsWithTags = await Promise.all(
            result.products.map(async (product: any) => {
              const tags = await TagService.listTagsForEntity('store_product', product.id);
              return stripInternalFields(product, tags);
            }),
          );

          logger.info(`Server SDK: Retrieved ${productsWithTags.length} store products for environment ${environment.environmentName}`);

          return {
            success: true,
            data: {
              products: productsWithTags,
              total: productsWithTags.length,
            },
          };
        },
      });
    } catch (error) {
      logger.error('Error in ServerStoreProductController.getStoreProducts:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve store products',
        },
      });
    }
  }

  /**
   * Get specific store product by ID
   * GET /api/v1/server/:env/store-products/:id
   */
  static async getStoreProductById(req: EnvironmentRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid product ID',
            details: { reason: 'Product ID is required' },
          },
        });
      }

      const product = await StoreProductService.getStoreProductByIdAcrossEnvironments(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Store product not found',
          },
        });
      }

      // Only return active products for server SDK
      if (!product.isActive) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Store product not found',
          },
        });
      }

      // Fetch tags for the product and strip internal fields
      const tags = await TagService.listTagsForEntity('store_product', product.id);
      const cleanProduct = stripInternalFields(product, tags);

      logger.info(`Server SDK: Retrieved store product ${id}`);

      res.json({
        success: true,
        data: {
          product: cleanProduct,
        },
      });
    } catch (error) {
      logger.error('Error in ServerStoreProductController.getStoreProductById:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve store product',
        },
      });
    }
  }
}

export default ServerStoreProductController;

