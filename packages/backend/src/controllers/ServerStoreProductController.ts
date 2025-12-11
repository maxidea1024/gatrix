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
      const environmentsParam = req.query.environments as string | undefined;
      const environments = environmentsParam
        ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      await respondWithEtagCache(res, {
        cacheKey: SERVER_SDK_ETAG.STORE_PRODUCTS,
        ttlMs: DEFAULT_CONFIG.STORE_PRODUCT_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          if (environments.length > 0) {
            // Multi-environment mode: return data grouped by environment
            const byEnvironment: Record<string, any[]> = {};
            let totalCount = 0;

            for (const envParam of environments) {
              // Try to find environment by ID or Name
              let env = await Environment.query().findById(envParam);
              if (!env) {
                env = await Environment.getByName(envParam);
              }

              if (env) {
                const result = await StoreProductService.getStoreProducts({
                  environmentId: env.id,
                  limit: 1000,
                  page: 1,
                  isActive: true,
                });

                // Fetch tags for each product
                const productsWithTags = await Promise.all(
                  result.products.map(async (product: any) => {
                    const tags = await TagService.listTagsForEntity('store_product', product.id);
                    // Remove environmentId from response (external API uses environment name as key)
                    const { environmentId, ...productWithoutEnvId } = product;
                    return {
                      ...productWithoutEnvId,
                      tags: tags || [],
                    };
                  }),
                );

                // Store by environmentName (the standard external identifier)
                byEnvironment[env.environmentName] = productsWithTags;
                totalCount += productsWithTags.length;
              } else {
                logger.warn(`Server SDK: Environment not found for param '${envParam}'`);
              }
            }

            logger.info(
              `Server SDK: Retrieved ${totalCount} store products across ${Object.keys(byEnvironment).length} environments`,
              { environments }
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
            const result = await StoreProductService.getStoreProducts({
              limit: 1000,
              page: 1,
              isActive: true,
            });

            // Fetch tags for each product
            const productsWithTags = await Promise.all(
              result.products.map(async (product: any) => {
                const tags = await TagService.listTagsForEntity('store_product', product.id);
                // Remove environmentId from response
                const { environmentId, ...productWithoutEnvId } = product;
                return {
                  ...productWithoutEnvId,
                  tags: tags || [],
                };
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
}

export default ServerStoreProductController;

