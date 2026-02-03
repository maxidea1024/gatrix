import { Response } from 'express';
import StoreProductService, { StoreProduct } from '../services/StoreProductService';
import { TagService } from '../services/TagService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import { EnvironmentRequest } from '../middleware/environmentResolver';

// Supported language codes for SDK API
type SdkLanguage = 'ko' | 'en' | 'zh';
const DEFAULT_LANGUAGE: SdkLanguage = 'zh';

/**
 * Get localized name for a product based on language
 * Falls back to zh -> ko -> productName if requested language is not available
 */
function getLocalizedName(product: StoreProduct, lang: SdkLanguage): string {
  const langMap: Record<SdkLanguage, string | null> = {
    ko: product.nameKo,
    en: product.nameEn,
    zh: product.nameZh,
  };
  return langMap[lang] || product.nameZh || product.nameKo || product.productName || '';
}

/**
 * Get localized description for a product based on language
 * Falls back to zh -> ko -> description if requested language is not available
 */
function getLocalizedDescription(product: StoreProduct, lang: SdkLanguage): string | null {
  const langMap: Record<SdkLanguage, string | null> = {
    ko: product.descriptionKo,
    en: product.descriptionEn,
    zh: product.descriptionZh,
  };
  return (
    langMap[lang] || product.descriptionZh || product.descriptionKo || product.description || null
  );
}

/**
 * Strip internal fields from store product for SDK response
 * Removes: id, isActive, metadata, createdBy, updatedBy, createdAt, updatedAt, environment
 * Also removes multi-language fields and replaces with localized name/description
 */
function stripInternalFields(product: StoreProduct, tags: any[], lang: SdkLanguage) {
  const {
    // Keep id for SDK event matching
    isActive: _isActive,
    metadata: _metadata,
    createdBy: _createdBy,
    updatedBy: _updatedBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    environment: _env,
    // Remove multi-language fields
    nameKo: _nameKo,
    nameEn: _nameEn,
    nameZh: _nameZh,
    descriptionKo: _descKo,
    descriptionEn: _descEn,
    descriptionZh: _descZh,
    productName: _productName,
    description: _description,
    ...cleanProduct
  } = product;

  // Suppress unused variable warnings
  void _isActive;
  void _metadata;
  void _createdBy;
  void _updatedBy;
  void _createdAt;
  void _updatedAt;
  void _env;
  void _nameKo;
  void _nameEn;
  void _nameZh;
  void _descKo;
  void _descEn;
  void _descZh;
  void _productName;
  void _description;

  return {
    ...cleanProduct,
    // Return localized name and description based on requested language
    productName: getLocalizedName(product, lang),
    description: getLocalizedDescription(product, lang),
    // Return only tag names for SDK
    tags: (tags || []).map((t: any) => t.name),
  };
}

/**
 * Parse and validate language parameter from request
 * Returns default language (zh) if not provided or invalid
 */
function parseLanguage(langParam: unknown): SdkLanguage {
  if (typeof langParam === 'string') {
    const lang = langParam.toLowerCase();
    if (lang === 'ko' || lang === 'en' || lang === 'zh') {
      return lang;
    }
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Server SDK Store Product Controller
 * Handles store product list retrieval for server-side SDK
 */
export class ServerStoreProductController {
  /**
   * Get store products for a specific environment
   * GET /api/v1/server/:env/store-products?language=zh
   * Returns all active store products with tags for the specified environment
   * @param language - Language code (ko, en, zh). Defaults to zh (Chinese)
   */
  static async getStoreProducts(req: EnvironmentRequest, res: Response) {
    try {
      const environment = req.environment;
      const lang = parseLanguage(req.query.language);

      if (!environment) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ENVIRONMENT',
            message: 'Environment is required',
          },
        });
      }

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.STORE_PRODUCTS}:${environment}`,
        ttlMs: DEFAULT_CONFIG.STORE_PRODUCT_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const result = await StoreProductService.getStoreProducts({
            environment: environment,
            limit: 1000,
            page: 1,
            isActive: true,
          });

          // Fetch tags for each product and strip internal fields with localization
          const productsWithTags = await Promise.all(
            result.products.map(async (product) => {
              const tags = await TagService.listTagsForEntity('store_product', product.id);
              return stripInternalFields(product, tags, lang);
            })
          );

          logger.info(
            `Server SDK: Retrieved ${productsWithTags.length} store products for environment ${environment} (lang: ${lang})`
          );

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
   * GET /api/v1/server/:env/store-products/:id?language=zh
   * @param language - Language code (ko, en, zh). Defaults to zh (Chinese)
   */
  static async getStoreProductById(req: EnvironmentRequest, res: Response) {
    try {
      const { id } = req.params;
      const environment = req.environment;
      const lang = parseLanguage(req.query.language);

      if (!environment) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ENVIRONMENT',
            message: 'Environment is required',
          },
        });
      }

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

      // Fetch tags for the product and strip internal fields with localization
      const tags = await TagService.listTagsForEntity('store_product', product.id);
      const cleanProduct = stripInternalFields(product, tags, lang);

      logger.info(
        `Server SDK: Retrieved store product ${id} (lang: ${lang}) for environment ${environment}`
      );

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
