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

              // Fetch tags for each product
              const productsWithTags = await Promise.all(
                result.products.map(async (product: any) => {
                  const tags = await TagService.listTagsForEntity('store_product', product.id);
                  // Remove environmentId from response (external API uses environment name as key)
                  const { environmentId: _envId, ...productWithoutEnvId } = product;
                  void _envId; // Suppress unused variable warning
                  return {
                    ...productWithoutEnvId,
                    tags: tags || [],
                  };
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

            // Fetch tags for each product
            const productsWithTags = await Promise.all(
              result.products.map(async (product: any) => {
                const tags = await TagService.listTagsForEntity('store_product', product.id);
                // Remove environmentId from response
                const { environmentId: _envId, ...productWithoutEnvId } = product;
                void _envId; // Suppress unused variable warning
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

