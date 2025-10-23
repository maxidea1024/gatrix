import fs from 'fs/promises';
import path from 'path';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';

export interface RewardTypeInfo {
  value: number;
  name: string;
  nameKey: string;
  hasTable: boolean;
  tableFile: string | null;
  itemCount: number;
  descriptionKey: string | null;
}

export interface RewardItem {
  id: number;
  name: string;
  nameKr?: string;  // Korean name (original)
  nameEn?: string;  // English name (from localization)
  nameCn?: string;  // Chinese name (from loctab)
}

export interface RewardLookupData {
  [rewardType: string]: {
    rewardType: number;
    rewardTypeName: string;
    tableFile: string | null;
    hasTable: boolean;
    description: string | null;
    idFieldName?: string;
    requiresAmount?: boolean;
    items: RewardItem[];
    itemCount: number;
  };
}

export class PlanningDataService {
  private static cmsPath = path.join(__dirname, '../contents/cms');
  private static rewardLookupPath = path.join(PlanningDataService.cmsPath, 'reward-lookup.json');
  private static rewardTypeListPath = path.join(PlanningDataService.cmsPath, 'reward-type-list.json');
  private static localizationKrPath = path.join(PlanningDataService.cmsPath, 'reward-localization-kr.json');
  private static localizationUsPath = path.join(PlanningDataService.cmsPath, 'reward-localization-us.json');
  private static localizationCnPath = path.join(PlanningDataService.cmsPath, 'reward-localization-cn.json');
  private static uiListDataPath = path.join(PlanningDataService.cmsPath, 'ui-list-data.json');
  private static loctabPath = path.join(PlanningDataService.cmsPath, 'loctab.json');
  private static initialized = false;

  /**
   * Initialize planning data on server startup
   * Builds reward lookup if files don't exist
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check if reward lookup files exist
      const lookupExists = await fs.access(this.rewardLookupPath).then(() => true).catch(() => false);
      const typeListExists = await fs.access(this.rewardTypeListPath).then(() => true).catch(() => false);

      if (!lookupExists || !typeListExists) {
        logger.info('Planning data files not found. Building initial data...');
        await this.rebuildRewardLookup();
        logger.info('Planning data initialized successfully');
      } else {
        logger.info('Planning data files found. Skipping initial build.');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize planning data', { error });
      // Don't throw error - allow server to start even if planning data fails
    }
  }

  /**
   * Get reward lookup data (cached in memory)
   */
  static async getRewardLookup(): Promise<RewardLookupData> {
    try {
      const data = await fs.readFile(PlanningDataService.rewardLookupPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read reward lookup data', { error });
      throw new CustomError('Failed to load reward lookup data', 500);
    }
  }

  /**
   * Get reward type list
   */
  static async getRewardTypeList(): Promise<RewardTypeInfo[]> {
    try {
      const data = await fs.readFile(PlanningDataService.rewardTypeListPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read reward type list', { error });
      throw new CustomError('Failed to load reward type list', 500);
    }
  }

  /**
   * Get items for a specific reward type with localized names
   * @param rewardType - Reward type number
   * @param language - Language code (kr, en, cn)
   */
  static async getRewardTypeItems(rewardType: number, language: 'kr' | 'en' | 'cn' = 'kr'): Promise<RewardItem[]> {
    try {
      const lookupData = await PlanningDataService.getRewardLookup();
      const typeData = lookupData[rewardType.toString()];

      if (!typeData) {
        throw new CustomError(`Reward type ${rewardType} not found`, 404);
      }

      const items = typeData.items || [];

      // Return items with localized names based on language
      return items.map(item => {
        let localizedName = item.name;

        if (language === 'cn' && item.nameCn) {
          localizedName = item.nameCn;
        } else if (language === 'en' && item.nameEn) {
          localizedName = item.nameEn;
        } else if (item.nameKr) {
          localizedName = item.nameKr;
        }

        return {
          ...item,
          name: localizedName, // Override name with localized version
        };
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Failed to get reward type items', { error, rewardType, language });
      throw new CustomError('Failed to load reward type items', 500);
    }
  }

  /**
   * Get localization table (loctab.json)
   * Maps Korean text to Chinese text
   */
  static async getLoctab(): Promise<Record<string, string>> {
    try {
      const data = await fs.readFile(PlanningDataService.loctabPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to load loctab', { error });
      // Return empty object if file doesn't exist
      return {};
    }
  }

  /**
   * Rebuild all planning data from CMS files using adminToolDataBuilder.js
   * This should be called when CMS files are updated
   */
  static async rebuildRewardLookup(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      logger.info('Starting planning data rebuild using adminToolDataBuilder.js...');

      // Check if adminToolDataBuilder.js exists
      const builderPath = path.join(PlanningDataService.cmsPath, 'adminToolDataBuilder.js');

      try {
        await fs.access(builderPath);
      } catch {
        throw new CustomError('Admin tool data builder not found', 500);
      }

      // Get the actual CMS directory path (where Point.json, Item.json, etc. are located)
      // The CMS files are in packages/backend/cmd directory
      const actualCmsDir = path.join(__dirname, '../../cmd');

      // Execute the builder with the correct CMS directory
      // This will generate all 7 files: reward-lookup.json, reward-type-list.json,
      // reward-localization-kr/us/cn.json, ui-list-data.json, loctab.json
      const { execSync } = require('child_process');
      const output = execSync(`node "${builderPath}" --all --cms-dir "${actualCmsDir}" --output-dir "${PlanningDataService.cmsPath}"`, {
        cwd: PlanningDataService.cmsPath,
        encoding: 'utf-8',
      });

      logger.info('Planning data rebuild completed', { output });

      // Verify the core files were created
      try {
        await fs.access(PlanningDataService.rewardLookupPath);
        await fs.access(PlanningDataService.rewardTypeListPath);
      } catch {
        throw new CustomError('Planning data files were not created', 500);
      }

      // Get stats
      const lookupData = await PlanningDataService.getRewardLookup();
      const typeList = await PlanningDataService.getRewardTypeList();
      const uiListData = await PlanningDataService.getUIListData();

      const stats = {
        totalRewardTypes: typeList.length,
        rewardTypesWithTable: typeList.filter(t => t.hasTable).length,
        totalItems: Object.values(lookupData).reduce((sum, type) => sum + type.itemCount, 0),
        uiListCounts: {
          nations: uiListData.nations?.length || 0,
          towns: uiListData.towns?.length || 0,
          villages: uiListData.villages?.length || 0,
        },
      };

      return {
        success: true,
        message: 'All planning data rebuilt successfully (7 files generated)',
        stats,
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Failed to rebuild planning data', { error });
      throw new CustomError('Failed to rebuild planning data', 500);
    }
  }

  /**
   * Get localization data for a specific language
   */
  static async getLocalization(language: 'kr' | 'us' | 'cn'): Promise<Record<string, string>> {
    try {
      const pathMap = {
        kr: this.localizationKrPath,
        us: this.localizationUsPath,
        cn: this.localizationCnPath,
      };

      const filePath = pathMap[language];
      const exists = await fs.access(filePath).then(() => true).catch(() => false);

      if (!exists) {
        return {};
      }

      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read localization data', { error, language });
      throw new CustomError(`Failed to load localization data for ${language}`, 500);
    }
  }

  /**
   * Get UI list data (nations, towns, villages)
   */
  static async getUIListData(): Promise<any> {
    try {
      const exists = await fs.access(this.uiListDataPath).then(() => true).catch(() => false);

      if (!exists) {
        return { nations: [], towns: [], villages: [] };
      }

      const data = await fs.readFile(this.uiListDataPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read UI list data', { error });
      throw new CustomError('Failed to load UI list data', 500);
    }
  }

  /**
   * Get UI list items for a specific category with language support
   */
  static async getUIListItems(category: string, language: string = 'kr'): Promise<any[]> {
    try {
      const uiListData = await PlanningDataService.getUIListData();

      if (!uiListData[category]) {
        throw new CustomError(`Category '${category}' not found`, 404);
      }

      const items = uiListData[category];

      // Map items to use the appropriate language field as 'name'
      return items.map((item: any) => {
        const nameField = language === 'cn' ? 'nameCn' : language === 'en' ? 'nameEn' : 'nameKr';
        return {
          ...item,
          name: item[nameField] || item.name || item.nameKr,
        };
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Failed to get UI list items', { error, category, language });
      throw new CustomError('Failed to load UI list items', 500);
    }
  }

  /**
   * Get planning data statistics
   */
  static async getStats(): Promise<any> {
    try {
      const lookupData = await PlanningDataService.getRewardLookup();
      const typeList = await PlanningDataService.getRewardTypeList();
      const uiListData = await PlanningDataService.getUIListData();

      // Check which files exist
      const filesExist = {
        rewardLookup: await fs.access(this.rewardLookupPath).then(() => true).catch(() => false),
        rewardTypeList: await fs.access(this.rewardTypeListPath).then(() => true).catch(() => false),
        localizationKr: await fs.access(this.localizationKrPath).then(() => true).catch(() => false),
        localizationUs: await fs.access(this.localizationUsPath).then(() => true).catch(() => false),
        localizationCn: await fs.access(this.localizationCnPath).then(() => true).catch(() => false),
        uiListData: await fs.access(this.uiListDataPath).then(() => true).catch(() => false),
      };

      // Calculate UI list counts
      const uiListCounts: Record<string, number> = {};
      for (const [key, value] of Object.entries(uiListData)) {
        if (Array.isArray(value)) {
          uiListCounts[key] = value.length;
        }
      }

      return {
        totalRewardTypes: typeList.length,
        rewardTypesWithTable: typeList.filter(t => t.hasTable).length,
        rewardTypesWithoutTable: typeList.filter(t => !t.hasTable).length,
        totalItems: Object.values(lookupData).reduce((sum, type) => sum + type.itemCount, 0),
        filesExist,
        uiListCounts,
        rewardTypes: typeList.map(t => ({
          value: t.value,
          name: t.name,
          nameKey: t.nameKey,
          hasTable: t.hasTable,
          itemCount: t.itemCount,
        })),
      };
    } catch (error) {
      logger.error('Failed to get planning data stats', { error });
      throw new CustomError('Failed to load planning data statistics', 500);
    }
  }
}

