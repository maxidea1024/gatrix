import logger from '../config/logger';
import { PlanningDataService } from './PlanningDataService';

/**
 * CMS CashShop product interface
 * Matches the structure from cashshop-lookup-*.json planning data
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

/**
 * CMS CashShop Service
 * Reads CashShop products from planning data (cashshop-lookup-*.json)
 */
export class CmsCashShopService {
  /**
   * Get all valid CMS CashShop products for an environment
   * @param environmentId Environment ULID
   * @param lang Language code (defaults to 'kr')
   */
  static async getProducts(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<CmsCashShopProduct[]> {
    try {
      const data = await PlanningDataService.getCashShopLookup(environmentId, lang);
      const products: CmsCashShopProduct[] = data.items || [];
      logger.info(`Loaded ${products.length} CMS CashShop products for environment ${environmentId}`);
      return products;
    } catch (error) {
      logger.error('Failed to load CMS CashShop products', { error, environmentId });
      throw error;
    }
  }
}

