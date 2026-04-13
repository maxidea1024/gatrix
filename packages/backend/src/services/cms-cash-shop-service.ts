import { createLogger } from '../config/logger';

const logger = createLogger('CmsCashShopService');
import { PlanningDataService } from './planning-data-service';

// Supported language codes
export type SupportedLanguage = 'ko' | 'en' | 'zh';

/**
 * Multi-language text interface
 * Provides access to text in different languages via language keys
 */
export interface MultiLangText {
  ko: string;
  en: string;
  zh: string;
}

/**
 * CMS CashShop product interface (unified multi-language structure)
 * Matches the structure from cashshop-lookup.json planning data
 */
export interface CmsCashShopProduct {
  id: string;
  name: MultiLangText; // Multi-language product name
  description: MultiLangText; // Multi-language product description
  productCode: string; // SDO product code
  price: number; // China price (CNY)
  productCategory: number;
  productType: number;
  saleType: number;
  saleStartAt: string | null;
  saleEndAt: string | null;
}

/**
 * CMS CashShop Service
 * Reads CashShop products from planning data (cashshop-lookup.json unified file)
 */
export class CmsCashShopService {
  /**
   * Get all valid CMS CashShop products for an environment
   * @param environment Environment name
   */
  static async getProducts(
    environmentId: string
  ): Promise<CmsCashShopProduct[]> {
    try {
      const data = await PlanningDataService.getCashShopLookup(environmentId);
      const products: CmsCashShopProduct[] = data.items || [];
      logger.info(
        `Loaded ${products.length} CMS CashShop products for environmentId ${environmentId}`
      );
      return products;
    } catch (error) {
      logger.error('Failed to load CMS CashShop products', {
        error,
        environmentId,
      });
      throw error;
    }
  }

  /**
   * Get localized name for a product
   * @param product CMS product
   * @param lang Language code (defaults to 'zh')
   */
  static getLocalizedName(
    product: CmsCashShopProduct,
    lang: SupportedLanguage = 'zh'
  ): string {
    return product.name[lang] || product.name.zh || product.name.ko || '';
  }

  /**
   * Get localized description for a product
   * @param product CMS product
   * @param lang Language code (defaults to 'zh')
   */
  static getLocalizedDescription(
    product: CmsCashShopProduct,
    lang: SupportedLanguage = 'zh'
  ): string {
    return (
      product.description[lang] ||
      product.description.zh ||
      product.description.ko ||
      ''
    );
  }
}
