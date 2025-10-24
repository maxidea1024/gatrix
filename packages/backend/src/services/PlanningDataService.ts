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
  private static hotTimeBuffPath = path.join(PlanningDataService.cmsPath, 'hottimebuff-lookup.json');
  private static eventPagePath = path.join(PlanningDataService.cmsPath, 'eventpage-lookup.json');
  private static liveEventPath = path.join(PlanningDataService.cmsPath, 'liveevent-lookup.json');
  private static mateRecruitingGroupPath = path.join(PlanningDataService.cmsPath, 'materecruiting-lookup.json');
  private static oceanNpcAreaSpawnerPath = path.join(PlanningDataService.cmsPath, 'oceannpcarea-lookup.json');
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

      // Calculate UI list counts (keys are already in SNAKE_CASE_UPPER from build)
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

  /**
   * Get HotTimeBuff lookup data
   */
  static async getHotTimeBuffLookup(): Promise<Record<string, any>> {
    try {
      const exists = await fs.access(this.hotTimeBuffPath).then(() => true).catch(() => false);

      if (!exists) {
        return {};
      }

      const data = await fs.readFile(this.hotTimeBuffPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read HotTimeBuff lookup data', { error });
      throw new CustomError('Failed to load HotTimeBuff lookup data', 500);
    }
  }

  /**
   * Build HotTimeBuff lookup data from CMS file
   */
  static async buildHotTimeBuffLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    try {
      logger.info('Building HotTimeBuff lookup data...');

      // Read HotTimeBuff.json from cmd directory
      const cmdDir = path.join(__dirname, '../../cmd');
      const hotTimeBuffSourcePath = path.join(cmdDir, 'HotTimeBuff.json');
      const worldBuffSourcePath = path.join(cmdDir, 'WorldBuff.json');

      try {
        await fs.access(hotTimeBuffSourcePath);
      } catch {
        throw new CustomError('HotTimeBuff.json not found in cmd directory', 500);
      }

      // Load WorldBuff data for name mapping
      const worldBuffMap: Record<number, string> = {};
      try {
        const worldBuffData = await fs.readFile(worldBuffSourcePath, 'utf-8');
        const worldBuffParsed = JSON.parse(worldBuffData);
        const worldBuffs = worldBuffParsed.WorldBuff || {};

        // Create a map of WorldBuff ID to name
        Object.values(worldBuffs).forEach((buff: any) => {
          if (buff.id && buff.name) {
            worldBuffMap[buff.id] = buff.name;
          }
        });
      } catch (error) {
        logger.warn('Could not load WorldBuff data for name mapping', { error });
      }

      const sourceData = await fs.readFile(hotTimeBuffSourcePath, 'utf-8');
      const parsedData = JSON.parse(sourceData);

      // Extract HotTimeBuff data (skip metadata)
      const hotTimeBuffData = parsedData.HotTimeBuff || {};

      // Convert to array format for easier processing
      const items = Object.values(hotTimeBuffData).map((item: any) => {
        // Convert UTC dates to ISO8601 format
        const startDateISO = item.startDate ? new Date(item.startDate).toISOString() : null;
        const endDateISO = item.endDate ? new Date(item.endDate).toISOString() : null;

        // Get world buff names
        const worldBuffNames = (item.worldBuffId || []).map((id: number) => worldBuffMap[id] || `Unknown (${id})`);

        // Build name from world buff names
        const name = worldBuffNames.length > 0 ? worldBuffNames.join(', ') : `HotTimeBuff ${item.id}`;

        return {
          id: item.id,
          name, // Display name based on world buffs
          // icon field removed - not needed
          startDate: startDateISO,
          endDate: endDateISO,
          localBitflag: item.localBitflag,
          startHour: item.startHour, // UTC hour (0-23)
          endHour: item.endHour, // UTC hour (0-23)
          minLv: item.minLv,
          maxLv: item.maxLv,
          bitFlagDayOfWeek: item.bitFlagDayOfWeek,
          worldBuffId: item.worldBuffId || [],
          // Add world buff names for display
          worldBuffNames,
        };
      });

      // Save to lookup file
      const lookupData = {
        totalCount: items.length,
        items,
      };

      await fs.writeFile(this.hotTimeBuffPath, JSON.stringify(lookupData, null, 2), 'utf-8');

      logger.info('HotTimeBuff lookup data built successfully', { itemCount: items.length });

      return {
        success: true,
        message: 'HotTimeBuff lookup data built successfully',
        itemCount: items.length,
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Failed to build HotTimeBuff lookup data', { error });
      throw new CustomError('Failed to build HotTimeBuff lookup data', 500);
    }
  }

  /**
   * Get EventPage lookup data
   */
  static async getEventPageLookup(): Promise<Record<string, any>> {
    try {
      const exists = await fs.access(this.eventPagePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };
      const data = await fs.readFile(this.eventPagePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read EventPage lookup data', { error });
      throw new CustomError('Failed to load EventPage lookup data', 500);
    }
  }

  /**
   * Build EventPage lookup data from CMS file
   */
  static async buildEventPageLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    try {
      logger.info('Building EventPage lookup data...');
      const cmdDir = path.join(__dirname, '../../cmd');
      const sourceFilePath = path.join(cmdDir, 'EventPage.json');
      try {
        await fs.access(sourceFilePath);
      } catch {
        throw new CustomError('EventPage.json not found in cmd directory', 500);
      }

      // PageGroup and Type name mappings
      const pageGroupNames: Record<number, string> = {
        0: 'Normal',
        1: 'Attendance',
        2: 'Mission',
        3: 'Ranking',
        4: 'Special',
      };

      const typeNames: Record<number, string> = {
        1: 'Daily',
        2: 'Weekly',
        3: 'Monthly',
        4: 'Seasonal',
        5: 'Limited',
        6: 'Special',
        7: 'Ranking',
        8: 'Attendance',
        9: 'Mission',
        10: 'Challenge',
        11: 'Event',
        12: 'Promotion',
        13: 'Maintenance',
        14: 'Update',
        15: 'Patch',
        16: 'Hotfix',
        17: 'Emergency',
      };

      const sourceData = await fs.readFile(sourceFilePath, 'utf-8');
      const parsedData = JSON.parse(sourceData);
      const eventPageData = parsedData.EventPage || {};
      const items = Object.values(eventPageData).map((item: any) => ({
        ...item,
        pageGroupName: pageGroupNames[item.pageGroup] || `Unknown (${item.pageGroup})`,
        typeName: typeNames[item.type] || `Unknown (${item.type})`,
      }));
      const lookupData = { totalCount: items.length, items };
      await fs.writeFile(this.eventPagePath, JSON.stringify(lookupData, null, 2), 'utf-8');
      logger.info('EventPage lookup data built successfully', { itemCount: items.length });
      return { success: true, message: 'EventPage lookup data built successfully', itemCount: items.length };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build EventPage lookup data', { error });
      throw new CustomError('Failed to build EventPage lookup data', 500);
    }
  }

  /**
   * Get LiveEvent lookup data
   */
  static async getLiveEventLookup(): Promise<Record<string, any>> {
    try {
      const exists = await fs.access(this.liveEventPath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };
      const data = await fs.readFile(this.liveEventPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read LiveEvent lookup data', { error });
      throw new CustomError('Failed to load LiveEvent lookup data', 500);
    }
  }

  /**
   * Build LiveEvent lookup data from CMS file
   */
  static async buildLiveEventLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    try {
      logger.info('Building LiveEvent lookup data...');
      const cmdDir = path.join(__dirname, '../../cmd');
      const sourceFilePath = path.join(cmdDir, 'LiveEvent.json');
      try {
        await fs.access(sourceFilePath);
      } catch {
        throw new CustomError('LiveEvent.json not found in cmd directory', 500);
      }
      const sourceData = await fs.readFile(sourceFilePath, 'utf-8');
      const parsedData = JSON.parse(sourceData);
      const liveEventData = parsedData.LiveEvent || {};

      // Use name from source data directly (client table data includes name field)
      // Remove loginBgmTag field - not needed
      // Convert dates to ISO8601 format
      const items = Object.values(liveEventData).map((item: any) => {
        const { loginBgmTag, ...rest } = item;

        // Convert startDate and endDate to ISO8601 format if they exist
        const startDateISO = item.startDate ? new Date(item.startDate).toISOString() : null;
        const endDateISO = item.endDate ? new Date(item.endDate).toISOString() : null;

        return {
          ...rest,
          name: item.name || `LiveEvent ${item.id}`, // Fallback to ID if name is missing
          startDate: startDateISO,
          endDate: endDateISO,
        };
      });

      const lookupData = { totalCount: items.length, items };
      await fs.writeFile(this.liveEventPath, JSON.stringify(lookupData, null, 2), 'utf-8');
      logger.info('LiveEvent lookup data built successfully', { itemCount: items.length });
      return { success: true, message: 'LiveEvent lookup data built successfully', itemCount: items.length };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build LiveEvent lookup data', { error });
      throw new CustomError('Failed to build LiveEvent lookup data', 500);
    }
  }

  /**
   * Get MateRecruitingGroup lookup data
   */
  static async getMateRecruitingGroupLookup(): Promise<Record<string, any>> {
    try {
      const exists = await fs.access(this.mateRecruitingGroupPath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };
      const data = await fs.readFile(this.mateRecruitingGroupPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read MateRecruitingGroup lookup data', { error });
      throw new CustomError('Failed to load MateRecruitingGroup lookup data', 500);
    }
  }

  /**
   * Build MateRecruitingGroup lookup data from CMS file
   */
  static async buildMateRecruitingGroupLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    try {
      logger.info('Building MateRecruitingGroup lookup data...');
      const cmdDir = path.join(__dirname, '../../cmd');
      const sourceFilePath = path.join(cmdDir, 'MateRecruitingGroup.json');
      const mateTemplateFilePath = path.join(cmdDir, 'MateTemplate.json');
      const townFilePath = path.join(cmdDir, 'Town.json');

      try {
        await fs.access(sourceFilePath);
        await fs.access(mateTemplateFilePath);
        await fs.access(townFilePath);
      } catch {
        throw new CustomError('Required JSON files not found in cmd directory', 500);
      }

      const sourceData = await fs.readFile(sourceFilePath, 'utf-8');
      const mateTemplateData = await fs.readFile(mateTemplateFilePath, 'utf-8');
      const townData = await fs.readFile(townFilePath, 'utf-8');
      const parsedData = JSON.parse(sourceData);
      const parsedMateTemplate = JSON.parse(mateTemplateData);
      const parsedTown = JSON.parse(townData);

      // Load localization table
      const loctabData = await fs.readFile(this.loctabPath, 'utf-8');
      const loctab = JSON.parse(loctabData);

      // Create a map of mateId to mate names (all languages)
      const mateNameMap: Record<number, { nameKr: string; nameEn: string; nameCn: string }> = {};
      const mateTemplates = parsedMateTemplate.MateTemplate || {};
      Object.values(mateTemplates).forEach((mate: any) => {
        if (mate.mateId && mate.name) {
          mateNameMap[mate.mateId] = {
            nameKr: mate.name,
            nameEn: loctab[mate.name] || mate.name,
            nameCn: loctab[mate.name] || mate.name,
          };
        }
      });

      // Create a map of mateRecruitingGroup to town info (all languages with IDs)
      const groupToTownsMap: Record<number, Array<{ id: number; nameKr: string; nameEn: string; nameCn: string }>> = {};
      const towns = parsedTown.Town || {};
      Object.values(towns).forEach((town: any) => {
        if (town.mateRecruitingGroup && town.name) {
          if (!groupToTownsMap[town.mateRecruitingGroup]) {
            groupToTownsMap[town.mateRecruitingGroup] = [];
          }
          groupToTownsMap[town.mateRecruitingGroup].push({
            id: town.id,
            nameKr: town.name,
            nameEn: loctab[town.name] || town.name,
            nameCn: loctab[town.name] || town.name,
          });
        }
      });

      const mateRecruitingGroupData = parsedData.MateRecruitingGroup || {};
      const items = Object.values(mateRecruitingGroupData).map((item: any) => {
        // Check if mate exists in template
        const mateExists = !!mateNameMap[item.mateId];
        const mateNames = mateNameMap[item.mateId] || {
          nameKr: `MISSING MATE ${item.mateId}`,
          nameEn: `MISSING MATE ${item.mateId}`,
          nameCn: `MISSING MATE ${item.mateId}`,
        };

        // Get town info for this group (all languages with IDs)
        const townsList = groupToTownsMap[item.group] || [];
        const townNamesKr = townsList.map(t => t.nameKr).join(', ');
        const townNamesEn = townsList.map(t => t.nameEn).join(', ');
        const townNamesCn = townsList.map(t => t.nameCn).join(', ');

        // Build name for each language
        const buildName = (mateName: string, townNames: string) => {
          const nameParts: string[] = [];
          nameParts.push(mateName);
          if (townNames) {
            nameParts.push(`- ${townNames}`);
          }

          const tags: string[] = [];
          if (item.isMustAppear) {
            tags.push('필수등장'); // TODO: localize
          }
          if (item.isReRecruit) {
            tags.push('재고용전용'); // TODO: localize
          }
          if (item.Ratio && item.Ratio < 10000 && !item.isMustAppear) {
            tags.push(`확률:${(item.Ratio / 100).toFixed(0)}%`); // TODO: localize
          }

          let name = nameParts.join(' ');
          if (tags.length > 0) {
            name = `${name} (${tags.join(', ')})`;
          }
          return name;
        };

        // Calculate probability percentage
        const probability = item.Ratio && item.Ratio < 10000 && !item.isMustAppear
          ? (item.Ratio / 100).toFixed(0)
          : null;

        return {
          ...item,
          name: buildName(mateNames.nameKr, townNamesKr), // Default to Korean
          nameKr: buildName(mateNames.nameKr, townNamesKr),
          nameEn: buildName(mateNames.nameEn, townNamesEn),
          nameCn: buildName(mateNames.nameCn, townNamesCn),
          mateName: mateNames.nameKr,
          mateNameKr: mateNames.nameKr,
          mateNameEn: mateNames.nameEn,
          mateNameCn: mateNames.nameCn,
          townNames: townNamesKr,
          townNamesKr: townNamesKr,
          townNamesEn: townNamesEn,
          townNamesCn: townNamesCn,
          towns: townsList, // Array of { id, nameKr, nameEn, nameCn }
          probability, // Probability percentage (e.g., "50" for 50%)
          mateExists,
        };
      });

      const lookupData = { totalCount: items.length, items };
      await fs.writeFile(this.mateRecruitingGroupPath, JSON.stringify(lookupData, null, 2), 'utf-8');
      logger.info('MateRecruitingGroup lookup data built successfully', { itemCount: items.length });
      return { success: true, message: 'MateRecruitingGroup lookup data built successfully', itemCount: items.length };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build MateRecruitingGroup lookup data', { error });
      throw new CustomError('Failed to build MateRecruitingGroup lookup data', 500);
    }
  }

  /**
   * Get OceanNpcAreaSpawner lookup data
   */
  static async getOceanNpcAreaSpawnerLookup(): Promise<Record<string, any>> {
    try {
      const exists = await fs.access(this.oceanNpcAreaSpawnerPath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };
      const data = await fs.readFile(this.oceanNpcAreaSpawnerPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read OceanNpcAreaSpawner lookup data', { error });
      throw new CustomError('Failed to load OceanNpcAreaSpawner lookup data', 500);
    }
  }

  /**
   * Build OceanNpcAreaSpawner lookup data from CMS file
   */
  static async buildOceanNpcAreaSpawnerLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    try {
      logger.info('Building OceanNpcAreaSpawner lookup data...');
      const cmdDir = path.join(__dirname, '../../cmd');
      const sourceFilePath = path.join(cmdDir, 'OceanNpcAreaSpawner.json');
      const oceanNpcFilePath = path.join(cmdDir, 'OceanNpc.json');

      try {
        await fs.access(sourceFilePath);
        await fs.access(oceanNpcFilePath);
      } catch {
        throw new CustomError('OceanNpcAreaSpawner.json or OceanNpc.json not found in cmd directory', 500);
      }

      const sourceData = await fs.readFile(sourceFilePath, 'utf-8');
      const oceanNpcData = await fs.readFile(oceanNpcFilePath, 'utf-8');
      const parsedData = JSON.parse(sourceData);
      const parsedOceanNpc = JSON.parse(oceanNpcData);

      // Load localization table
      const loctabData = await fs.readFile(this.loctabPath, 'utf-8');
      const loctab = JSON.parse(loctabData);

      // Create a map of oceanNpcId to ocean npc names (all languages)
      const oceanNpcNameMap: Record<number, { nameKr: string; nameEn: string; nameCn: string }> = {};
      const oceanNpcs = parsedOceanNpc.OceanNpc || {};
      Object.values(oceanNpcs).forEach((npc: any) => {
        if (npc.id && npc.name) {
          oceanNpcNameMap[npc.id] = {
            nameKr: npc.name,
            nameEn: loctab[npc.name] || npc.name,
            nameCn: loctab[npc.name] || npc.name,
          };
        }
      });

      const oceanNpcAreaSpawnerData = parsedData.OceanNpcAreaSpawner || {};
      const items = Object.values(oceanNpcAreaSpawnerData).map((item: any) => {
        const npcExists = !!oceanNpcNameMap[item.oceanNpcId];
        const npcNames = oceanNpcNameMap[item.oceanNpcId] || {
          nameKr: `MISSING NPC ${item.oceanNpcId}`,
          nameEn: `MISSING NPC ${item.oceanNpcId}`,
          nameCn: `MISSING NPC ${item.oceanNpcId}`,
        };

        // Build name for each language: Spawner - {npcName}
        const nameKr = `Spawner - ${npcNames.nameKr}`;
        const nameEn = `Spawner - ${npcNames.nameEn}`;
        const nameCn = `Spawner - ${npcNames.nameCn}`;

        // Convert startDate and endDate to ISO8601 format if they exist
        const startDateISO = item.startDate ? new Date(item.startDate).toISOString() : null;
        const endDateISO = item.endDate ? new Date(item.endDate).toISOString() : null;

        return {
          ...item,
          name: nameKr, // Default to Korean
          nameKr,
          nameEn,
          nameCn,
          npcName: npcNames.nameKr,
          npcNameKr: npcNames.nameKr,
          npcNameEn: npcNames.nameEn,
          npcNameCn: npcNames.nameCn,
          npcExists,
          startDate: startDateISO,
          endDate: endDateISO,
        };
      });

      const lookupData = { totalCount: items.length, items };
      await fs.writeFile(this.oceanNpcAreaSpawnerPath, JSON.stringify(lookupData, null, 2), 'utf-8');
      logger.info('OceanNpcAreaSpawner lookup data built successfully', { itemCount: items.length });
      return { success: true, message: 'OceanNpcAreaSpawner lookup data built successfully', itemCount: items.length };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build OceanNpcAreaSpawner lookup data', { error });
      throw new CustomError('Failed to build OceanNpcAreaSpawner lookup data', 500);
    }
  }
}

