import { Request, Response } from 'express';
import StoreProductService from '../services/StoreProductService';
import { Environment } from '../models/Environment';
import { TagService } from '../services/TagService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';

export interface SDKRequest extends Request {
  apiToken?: any;
}

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
   * Get store products list
   * GET /api/v1/server/store-products
   * GET /api/v1/server/store-products?environments=env1,env2,env3
   * Returns all active store products with tags
   */
  static async getStoreProducts(req: SDKRequest, res: Response) {
    try {
      // Parse environments query parameter
      // '*' means all environments
      const environmentsParam = req.query.environments as string | undefined;
      const isAllEnvironments = environmentsParam === '*';
      const environments = environmentsParam && !isAllEnvironments
        ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      await respondWithEtagCache(res, {
        cacheKey: SERVER_SDK_ETAG.STORE_PRODUCTS,
        ttlMs: DEFAULT_CONFIG.STORE_PRODUCT_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          // All environments mode or specific environments mode
          if (isAllEnvironments || environments.length > 0) {
            const byEnvironment: Record<string, any[]> = {};
            let totalCount = 0;

            // Get target environments
            let targetEnvs: any[];
            if (isAllEnvironments) {
              targetEnvs = await Environment.query().where('isActive', true);
            } else {
              targetEnvs = [];
              for (const envParam of environments) {
                let env = await Environment.query().findById(envParam);
                if (!env) {
                  env = await Environment.getByName(envParam);
                }
                if (env) {
                  targetEnvs.push(env);
                } else {
                  logger.warn(`Server SDK: Environment not found for param '${envParam}'`);
                }
              }
            }

            for (const env of targetEnvs) {
              const result = await StoreProductService.getStoreProducts({
                environmentId: env.id,
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

              byEnvironment[env.environmentName] = productsWithTags;
              totalCount += productsWithTags.length;
            }

            logger.info(
              `Server SDK: Retrieved ${totalCount} store products across ${Object.keys(byEnvironment).length} environments`,
              { mode: isAllEnvironments ? 'all' : 'specific', environments: Object.keys(byEnvironment) }
            );

            return {
              success: true,
              data: {
                byEnvironment,
                total: totalCount,
              },
            };
          } else {
            // Single-environment mode: return flat array
            // Use X-Environment header to determine environment (required for Server SDK)
            const envHeader = req.headers['x-environment'] as string | undefined;
            if (!envHeader) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'MISSING_ENVIRONMENT',
                  message: 'X-Environment header is required for single-environment mode',
                },
              });
            }

            // Resolve environment by name or ID
            let targetEnv = await Environment.query().findById(envHeader);
            if (!targetEnv) {
              targetEnv = await Environment.getByName(envHeader);
            }
            if (!targetEnv) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_ENVIRONMENT',
                  message: `Environment '${envHeader}' not found`,
                },
              });
            }

            const result = await StoreProductService.getStoreProducts({
              environmentId: targetEnv.id,
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

            logger.info(`Server SDK: Retrieved ${productsWithTags.length} store products`);

            return {
              success: true,
              data: {
                products: productsWithTags,
                total: productsWithTags.length,
              },
            };
          }
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
   * GET /api/v1/server/store-products/:id
   */
  static async getStoreProductById(req: SDKRequest, res: Response) {
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

