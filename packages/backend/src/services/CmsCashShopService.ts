import logger from '../config/logger';
import { PlanningDataService } from './PlanningDataService';

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
  id: number;
  name: MultiLangText;        // Multi-language product name
  description: MultiLangText; // Multi-language product description
  productCode: string;        // SDO product code
  price: number;              // China price (CNY)
  productCategory: number;
  productType: number;
  saleType: number;
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
  static async getProducts(environment: string): Promise<CmsCashShopProduct[]> {
    try {
      const data = await PlanningDataService.getCashShopLookup(environment);
      const products: CmsCashShopProduct[] = data.items || [];
      logger.info(`Loaded ${products.length} CMS CashShop products for environment ${environment}`);
      return products;
    } catch (error) {
      logger.error('Failed to load CMS CashShop products', { error, environment });
      throw error;
    }
  }

  /**
   * Get localized name for a product
   * @param product CMS product
   * @param lang Language code (defaults to 'zh')
   */
  static getLocalizedName(product: CmsCashShopProduct, lang: SupportedLanguage = 'zh'): string {
    return product.name[lang] || product.name.zh || product.name.ko || '';
  }

  /**
   * Get localized description for a product
   * @param product CMS product
   * @param lang Language code (defaults to 'zh')
   */
  static getLocalizedDescription(product: CmsCashShopProduct, lang: SupportedLanguage = 'zh'): string {
    return product.description[lang] || product.description.zh || product.description.ko || '';
  }
}

