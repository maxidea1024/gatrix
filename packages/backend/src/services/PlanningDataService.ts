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
   * Get items for a specific reward type
   */
  static async getRewardTypeItems(rewardType: number): Promise<RewardItem[]> {
    try {
      const lookupData = await PlanningDataService.getRewardLookup();
      const typeData = lookupData[rewardType.toString()];
      
      if (!typeData) {
        throw new CustomError(`Reward type ${rewardType} not found`, 404);
      }

      return typeData.items || [];
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Failed to get reward type items', { error, rewardType });
      throw new CustomError('Failed to load reward type items', 500);
    }
  }

  /**
   * Rebuild reward lookup data from CMS files
   * This should be called when CMS files are updated
   */
  static async rebuildRewardLookup(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      logger.info('Starting reward lookup rebuild...');

      // Check if rewardLookupBuilder.js exists
      const builderPath = path.join(PlanningDataService.cmsPath, 'rewardLookupBuilder.js');

      try {
        await fs.access(builderPath);
      } catch {
        throw new CustomError('Reward lookup builder not found', 500);
      }

      // Get the actual CMS directory path (where Point.json, Item.json, etc. are located)
      // The CMS files are in packages/backend/cmd directory
      const actualCmsDir = path.join(__dirname, '../../cmd');

      // Execute the builder with the correct CMS directory
      const { execSync } = require('child_process');
      const output = execSync(`node "${builderPath}" --cms-dir "${actualCmsDir}"`, {
        cwd: PlanningDataService.cmsPath,
        encoding: 'utf-8',
      });

      logger.info('Reward lookup rebuild completed', { output });

      // Verify the files were created
      try {
        await fs.access(PlanningDataService.rewardLookupPath);
        await fs.access(PlanningDataService.rewardTypeListPath);
      } catch {
        throw new CustomError('Reward lookup files were not created', 500);
      }

      // Get stats
      const lookupData = await PlanningDataService.getRewardLookup();
      const typeList = await PlanningDataService.getRewardTypeList();

      const stats = {
        totalRewardTypes: typeList.length,
        rewardTypesWithTable: typeList.filter(t => t.hasTable).length,
        totalItems: Object.values(lookupData).reduce((sum, type) => sum + type.itemCount, 0),
      };

      return {
        success: true,
        message: 'Reward lookup data rebuilt successfully',
        stats,
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Failed to rebuild reward lookup', { error });
      throw new CustomError('Failed to rebuild reward lookup data', 500);
    }
  }

  /**
   * Get planning data statistics
   */
  static async getStats(): Promise<any> {
    try {
      const lookupData = await PlanningDataService.getRewardLookup();
      const typeList = await PlanningDataService.getRewardTypeList();

      return {
        totalRewardTypes: typeList.length,
        rewardTypesWithTable: typeList.filter(t => t.hasTable).length,
        rewardTypesWithoutTable: typeList.filter(t => !t.hasTable).length,
        totalItems: Object.values(lookupData).reduce((sum, type) => sum + type.itemCount, 0),
        rewardTypes: typeList.map(t => ({
          value: t.value,
          name: t.name,
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

