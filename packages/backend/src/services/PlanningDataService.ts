import fs from 'fs/promises';
import path from 'path';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { cacheService } from './CacheService';

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
  // Source CMS files (read-only, from src/contents/cms)
  private static sourceCmsPath = path.join(__dirname, '../contents/cms');

  // Runtime data path (read-write, for dynamically generated files)
  private static runtimeDataPath = path.join(__dirname, '../../data/planning');

  // Paths for dynamically generated files (stored in runtime data directory)
  // Language-specific reward lookup files
  private static rewardLookupKrPath = path.join(PlanningDataService.runtimeDataPath, 'reward-lookup-kr.json');
  private static rewardLookupEnPath = path.join(PlanningDataService.runtimeDataPath, 'reward-lookup-en.json');
  private static rewardLookupZhPath = path.join(PlanningDataService.runtimeDataPath, 'reward-lookup-zh.json');
  private static rewardTypeListPath = path.join(PlanningDataService.runtimeDataPath, 'reward-type-list.json');
  private static uiListDataKrPath = path.join(PlanningDataService.runtimeDataPath, 'ui-list-data-kr.json');
  private static uiListDataEnPath = path.join(PlanningDataService.runtimeDataPath, 'ui-list-data-en.json');
  private static uiListDataZhPath = path.join(PlanningDataService.runtimeDataPath, 'ui-list-data-zh.json');
  // Language-specific event lookup files
  private static hotTimeBuffKrPath = path.join(PlanningDataService.runtimeDataPath, 'hottimebuff-lookup-kr.json');
  private static hotTimeBuffEnPath = path.join(PlanningDataService.runtimeDataPath, 'hottimebuff-lookup-en.json');
  private static hotTimeBuffZhPath = path.join(PlanningDataService.runtimeDataPath, 'hottimebuff-lookup-zh.json');
  private static eventPageKrPath = path.join(PlanningDataService.runtimeDataPath, 'eventpage-lookup-kr.json');
  private static eventPageEnPath = path.join(PlanningDataService.runtimeDataPath, 'eventpage-lookup-en.json');
  private static eventPageZhPath = path.join(PlanningDataService.runtimeDataPath, 'eventpage-lookup-zh.json');
  private static liveEventKrPath = path.join(PlanningDataService.runtimeDataPath, 'liveevent-lookup-kr.json');
  private static liveEventEnPath = path.join(PlanningDataService.runtimeDataPath, 'liveevent-lookup-en.json');
  private static liveEventZhPath = path.join(PlanningDataService.runtimeDataPath, 'liveevent-lookup-zh.json');
  private static mateRecruitingGroupKrPath = path.join(PlanningDataService.runtimeDataPath, 'materecruiting-lookup-kr.json');
  private static mateRecruitingGroupEnPath = path.join(PlanningDataService.runtimeDataPath, 'materecruiting-lookup-en.json');
  private static mateRecruitingGroupZhPath = path.join(PlanningDataService.runtimeDataPath, 'materecruiting-lookup-zh.json');
  private static oceanNpcAreaSpawnerKrPath = path.join(PlanningDataService.runtimeDataPath, 'oceannpcarea-lookup-kr.json');
  private static oceanNpcAreaSpawnerEnPath = path.join(PlanningDataService.runtimeDataPath, 'oceannpcarea-lookup-en.json');
  private static oceanNpcAreaSpawnerZhPath = path.join(PlanningDataService.runtimeDataPath, 'oceannpcarea-lookup-zh.json');
  private static initialized = false;

  // Redis cache keys for multi-instance support
  private static readonly CACHE_KEYS = {
    REWARD_LOOKUP_KR: 'planning:reward-lookup-kr',
    REWARD_LOOKUP_EN: 'planning:reward-lookup-en',
    REWARD_LOOKUP_ZH: 'planning:reward-lookup-zh',
    REWARD_TYPE_LIST: 'planning:reward-type-list',
    UI_LIST_DATA: 'planning:ui-list-data',
    HOT_TIME_BUFF: 'planning:hottimebuff-lookup',
    EVENT_PAGE: 'planning:eventpage-lookup',
    LIVE_EVENT: 'planning:liveevent-lookup',
    MATE_RECRUITING: 'planning:materecruiting-lookup',
    OCEAN_NPC_AREA: 'planning:oceannpcarea-lookup',
  };

  // Cache TTL: 24 hours (in milliseconds)


  /**
   * Initialize planning data on server startup
   * Does NOT automatically build if files don't exist - users must manually upload via API
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure runtime data directory exists
      await fs.mkdir(this.runtimeDataPath, { recursive: true });
      logger.info('Runtime data directory ready', { path: this.runtimeDataPath });

      // Check if reward lookup files exist (all language versions)
      const lookupKrExists = await fs.access(this.rewardLookupKrPath).then(() => true).catch(() => false);
      const lookupEnExists = await fs.access(this.rewardLookupEnPath).then(() => true).catch(() => false);
      const lookupZhExists = await fs.access(this.rewardLookupZhPath).then(() => true).catch(() => false);
      const typeListExists = await fs.access(this.rewardTypeListPath).then(() => true).catch(() => false);

      if (!lookupKrExists || !lookupEnExists || !lookupZhExists || !typeListExists) {
        logger.warn('Planning data files not found. Please upload planning data via API endpoint: POST /api/v1/admin/planning-data/rebuild');
      } else {
        logger.info('Planning data files found. Ready to serve.');
      }

      // Ensure existing planning cache keys (if any) become persistent (no TTL)
      try {
        const keysToPersist = [
          this.CACHE_KEYS.REWARD_LOOKUP_KR,
          this.CACHE_KEYS.REWARD_LOOKUP_EN,
          this.CACHE_KEYS.REWARD_LOOKUP_ZH,
          this.CACHE_KEYS.REWARD_TYPE_LIST,
          `${this.CACHE_KEYS.UI_LIST_DATA}:kr`,
          `${this.CACHE_KEYS.UI_LIST_DATA}:en`,
          `${this.CACHE_KEYS.UI_LIST_DATA}:zh`,
          `${this.CACHE_KEYS.HOT_TIME_BUFF}:kr`,
          `${this.CACHE_KEYS.HOT_TIME_BUFF}:en`,
          `${this.CACHE_KEYS.HOT_TIME_BUFF}:zh`,
          `${this.CACHE_KEYS.EVENT_PAGE}:kr`,
          `${this.CACHE_KEYS.EVENT_PAGE}:en`,
          `${this.CACHE_KEYS.EVENT_PAGE}:zh`,
          `${this.CACHE_KEYS.LIVE_EVENT}:kr`,
          `${this.CACHE_KEYS.LIVE_EVENT}:en`,
          `${this.CACHE_KEYS.LIVE_EVENT}:zh`,
          `${this.CACHE_KEYS.MATE_RECRUITING}:kr`,
          `${this.CACHE_KEYS.MATE_RECRUITING}:en`,
          `${this.CACHE_KEYS.MATE_RECRUITING}:zh`,
          `${this.CACHE_KEYS.OCEAN_NPC_AREA}:kr`,
          `${this.CACHE_KEYS.OCEAN_NPC_AREA}:en`,
          `${this.CACHE_KEYS.OCEAN_NPC_AREA}:zh`,
        ];
        const persisted = await cacheService.persistKeys(keysToPersist);
        logger.info('Planning cache keys persisted (no TTL)', { persisted });
      } catch (persistErr) {
        logger.warn('Failed to persist planning cache keys (no TTL)', { error: persistErr });
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize planning data', { error });
      // Don't throw error - allow server to start even if planning data fails
    }
  }

  /**
   * Get reward lookup data (cached in Redis for multi-instance support)
   * Data is already localized at generation time, so just load the appropriate language file
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getRewardLookup(lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<RewardLookupData> {
    try {
      // Determine cache key and file path based on language
      let cacheKey: string;
      let filePath: string;

      if (lang === 'en') {
        cacheKey = this.CACHE_KEYS.REWARD_LOOKUP_EN;
        filePath = PlanningDataService.rewardLookupEnPath;
      } else if (lang === 'zh') {
        cacheKey = this.CACHE_KEYS.REWARD_LOOKUP_ZH;
        filePath = PlanningDataService.rewardLookupZhPath;
      } else {
        cacheKey = this.CACHE_KEYS.REWARD_LOOKUP_KR;
        filePath = PlanningDataService.rewardLookupKrPath;
      }

      // Try to get from Redis cache first
      const cached = await cacheService.get<RewardLookupData>(cacheKey);
      if (cached) {
        // Ensure no TTL remains on cached keys
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`Reward lookup data (${lang}) retrieved from cache`);
        return cached;
      }

      // If not in cache, read from file
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      logger.debug(`Reward lookup data (${lang}) loaded from file and cached`);
      return parsed;
    } catch (error) {
      logger.error('Failed to read reward lookup data', { error, lang });
      throw new CustomError('Failed to load reward lookup data', 500);
    }
  }

  /**
   * Get reward type list (cached in Redis for multi-instance support)
   */
  static async getRewardTypeList(): Promise<RewardTypeInfo[]> {
    try {
      // Try to get from Redis cache first
      const cached = await cacheService.get<RewardTypeInfo[]>(this.CACHE_KEYS.REWARD_TYPE_LIST);
      if (cached) {
        await cacheService.setWithoutTTL(this.CACHE_KEYS.REWARD_TYPE_LIST, cached);
        logger.debug('Reward type list retrieved from cache');
        return cached;
      }

      // If not in cache, read from file
      const data = await fs.readFile(PlanningDataService.rewardTypeListPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(this.CACHE_KEYS.REWARD_TYPE_LIST, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read reward type list', { error });
      throw new CustomError('Failed to load reward type list', 500);
    }
  }

  /**
   * Get items for a specific reward type with localized names
   * @param rewardType - Reward type number
   * @param language - Language code (kr, en, zh)
   */
  static async getRewardTypeItems(rewardType: number, language: 'kr' | 'en' | 'zh' = 'kr'): Promise<RewardItem[]> {
    try {
      // Load the language-specific reward lookup data
      const lookupData = await PlanningDataService.getRewardLookup(language);
      const typeData = lookupData[rewardType.toString()];

      if (!typeData) {
        throw new CustomError(`Reward type ${rewardType} not found`, 404);
      }

      // Data is already localized at generation time, so just return items as-is
      return typeData.items || [];
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Failed to get reward type items', { error, rewardType, language });
      throw new CustomError('Failed to load reward type items', 500);
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
      const builderPath = path.join(PlanningDataService.sourceCmsPath, 'adminToolDataBuilder.js');

      try {
        await fs.access(builderPath);
      } catch {
        throw new CustomError('Admin tool data builder not found', 500);
      }

      // Get the actual CMS directory path (where Point.json, Item.json, etc. are located)
      // The CMS files are in packages/backend/cms directory
      const actualCmsDir = path.join(__dirname, '../../cms');

      // Execute the builder with the correct CMS directory
      // This will generate all 7 files: reward-lookup.json, reward-type-list.json,
      // reward-localization-kr/us/cn.json, ui-list-data.json, loctab.json
      // Output to runtime data directory (not source directory)
      const { execSync } = require('child_process');
      const output = execSync(`node "${builderPath}" --all --cms-dir "${actualCmsDir}" --output-dir "${PlanningDataService.runtimeDataPath}"`, {
        cwd: PlanningDataService.sourceCmsPath,
        encoding: 'utf-8',
      });

      logger.info('Planning data rebuild completed', { output });

      // Verify the core files were created (all language versions)
      try {
        await fs.access(PlanningDataService.rewardLookupKrPath);
        await fs.access(PlanningDataService.rewardLookupEnPath);
        await fs.access(PlanningDataService.rewardLookupZhPath);
        await fs.access(PlanningDataService.rewardTypeListPath);
      } catch {
        throw new CustomError('Planning data files were not created', 500);
      }

      // Invalidate Redis cache for all instances
      logger.info('Invalidating Redis cache for planning data...');
      await Promise.all([
        cacheService.delete(this.CACHE_KEYS.REWARD_LOOKUP_KR),
        cacheService.delete(this.CACHE_KEYS.REWARD_LOOKUP_EN),
        cacheService.delete(this.CACHE_KEYS.REWARD_LOOKUP_ZH),
        cacheService.delete(this.CACHE_KEYS.REWARD_TYPE_LIST),
        // UI list per language
        cacheService.delete(`${this.CACHE_KEYS.UI_LIST_DATA}:kr`),
        cacheService.delete(`${this.CACHE_KEYS.UI_LIST_DATA}:en`),
        cacheService.delete(`${this.CACHE_KEYS.UI_LIST_DATA}:zh`),
        // Event lookups per language
        cacheService.delete(`${this.CACHE_KEYS.HOT_TIME_BUFF}:kr`),
        cacheService.delete(`${this.CACHE_KEYS.HOT_TIME_BUFF}:en`),
        cacheService.delete(`${this.CACHE_KEYS.HOT_TIME_BUFF}:zh`),
        cacheService.delete(`${this.CACHE_KEYS.EVENT_PAGE}:kr`),
        cacheService.delete(`${this.CACHE_KEYS.EVENT_PAGE}:en`),
        cacheService.delete(`${this.CACHE_KEYS.EVENT_PAGE}:zh`),
        cacheService.delete(`${this.CACHE_KEYS.LIVE_EVENT}:kr`),
        cacheService.delete(`${this.CACHE_KEYS.LIVE_EVENT}:en`),
        cacheService.delete(`${this.CACHE_KEYS.LIVE_EVENT}:zh`),
        cacheService.delete(`${this.CACHE_KEYS.MATE_RECRUITING}:kr`),
        cacheService.delete(`${this.CACHE_KEYS.MATE_RECRUITING}:en`),
        cacheService.delete(`${this.CACHE_KEYS.MATE_RECRUITING}:zh`),
        cacheService.delete(`${this.CACHE_KEYS.OCEAN_NPC_AREA}:kr`),
        cacheService.delete(`${this.CACHE_KEYS.OCEAN_NPC_AREA}:en`),
        cacheService.delete(`${this.CACHE_KEYS.OCEAN_NPC_AREA}:zh`),
      ]);
      logger.info('Redis cache invalidated successfully');

      // Get stats (this will reload from files and repopulate cache)
      const lookupData = await PlanningDataService.getRewardLookup('kr');
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
   * Get UI list data (nations, towns, villages) - cached in Redis for multi-instance support
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getUIListData(lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<any> {
    try {
      // Try to get from Redis cache first
      const cacheKey = `${this.CACHE_KEYS.UI_LIST_DATA}:${lang}`;
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`UI list data (${lang}) retrieved from cache`);
        return cached;
      }

      // Determine file path based on language
      let filePath: string;
      switch (lang) {
        case 'en':
          filePath = this.uiListDataEnPath;
          break;
        case 'zh':
          filePath = this.uiListDataZhPath;
          break;
        case 'kr':
        default:
          filePath = this.uiListDataKrPath;
          break;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);

      if (!exists) {
        return { nations: [], towns: [], villages: [] };
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read UI list data', { error });
      throw new CustomError('Failed to load UI list data', 500);
    }
  }

  /**
   * Get UI list items for a specific category with language support
   * @param category - Category name (nations, towns, villages, ships, mates, etc.)
   * @param language - Language code (kr, en, zh)
   */
  static async getUIListItems(category: string, language: 'kr' | 'en' | 'zh' = 'kr'): Promise<any[]> {
    try {
      const uiListData = await PlanningDataService.getUIListData(language);

      if (!uiListData[category]) {
        throw new CustomError(`Category '${category}' not found`, 404);
      }

      // Data is already localized at generation time, so just return items as-is
      return uiListData[category];
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
        rewardLookupKo: await fs.access(this.rewardLookupKrPath).then(() => true).catch(() => false),
        rewardLookupEn: await fs.access(this.rewardLookupEnPath).then(() => true).catch(() => false),
        rewardLookupZh: await fs.access(this.rewardLookupZhPath).then(() => true).catch(() => false),
        rewardTypeList: await fs.access(this.rewardTypeListPath).then(() => true).catch(() => false),
        uiListData: await fs.access(this.uiListDataKrPath).then(() => true).catch(() => false),
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
   * Get HotTimeBuff lookup data (cached in Redis for multi-instance support)
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getHotTimeBuffLookup(lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(`${this.CACHE_KEYS.HOT_TIME_BUFF}:${lang}`);
      if (cached) {
        await cacheService.setWithoutTTL(`${this.CACHE_KEYS.HOT_TIME_BUFF}:${lang}`, cached);
        logger.debug(`HotTimeBuff lookup data (${lang}) retrieved from cache`);
        return cached;
      }

      // Determine file path based on language
      let filePath: string;
      if (lang === 'en') {
        filePath = this.hotTimeBuffEnPath;
      } else if (lang === 'zh') {
        filePath = this.hotTimeBuffZhPath;
      } else {
        filePath = this.hotTimeBuffKrPath;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);

      if (!exists) {
        return {};
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(`${this.CACHE_KEYS.HOT_TIME_BUFF}:${lang}`, parsed);

      return parsed;
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

      // Read HotTimeBuff.json from cms directory
      const cmsDir = path.join(__dirname, '../../cms');
      const hotTimeBuffSourcePath = path.join(cmsDir, 'HotTimeBuff.json');
      const worldBuffSourcePath = path.join(cmsDir, 'WorldBuff.json');

      try {
        await fs.access(hotTimeBuffSourcePath);
      } catch {
        throw new CustomError('HotTimeBuff.json not found in cms directory', 500);
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

      // Note: Data is now generated by adminToolDataBuilder.js and uploaded via API
      // No need to save here - just invalidate cache
      // await fs.writeFile(this.hotTimeBuffKrPath, JSON.stringify(lookupData, null, 2), 'utf-8');

      // Invalidate Redis cache for all instances
      await cacheService.delete(this.CACHE_KEYS.HOT_TIME_BUFF);

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
   * Get EventPage lookup data (cached in Redis for multi-instance support)
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getEventPageLookup(lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(`${this.CACHE_KEYS.EVENT_PAGE}:${lang}`);
      if (cached) {
        await cacheService.setWithoutTTL(`${this.CACHE_KEYS.EVENT_PAGE}:${lang}`, cached);
        logger.debug(`EventPage lookup data (${lang}) retrieved from cache`);
        return cached;
      }

      // Determine file path based on language
      let filePath: string;
      if (lang === 'en') {
        filePath = this.eventPageEnPath;
      } else if (lang === 'zh') {
        filePath = this.eventPageZhPath;
      } else {
        filePath = this.eventPageKrPath;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(`${this.CACHE_KEYS.EVENT_PAGE}:${lang}`, parsed);

      return parsed;
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
      const cmsDir = path.join(__dirname, '../../cms');
      const sourceFilePath = path.join(cmsDir, 'EventPage.json');
      try {
        await fs.access(sourceFilePath);
      } catch {
        throw new CustomError('EventPage.json not found in cms directory', 500);
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
      // Note: Data is now generated by adminToolDataBuilder.js and uploaded via API
      // await fs.writeFile(this.eventPageKrPath, JSON.stringify(lookupData, null, 2), 'utf-8');

      // Invalidate Redis cache for all instances
      await cacheService.delete(this.CACHE_KEYS.EVENT_PAGE);

      logger.info('EventPage lookup data built successfully', { itemCount: items.length });
      return { success: true, message: 'EventPage lookup data built successfully', itemCount: items.length };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build EventPage lookup data', { error });
      throw new CustomError('Failed to build EventPage lookup data', 500);
    }
  }

  /**
   * Get LiveEvent lookup data (cached in Redis for multi-instance support)
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getLiveEventLookup(lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(`${this.CACHE_KEYS.LIVE_EVENT}:${lang}`);
      if (cached) {
        await cacheService.setWithoutTTL(`${this.CACHE_KEYS.LIVE_EVENT}:${lang}`, cached);
        logger.debug(`LiveEvent lookup data (${lang}) retrieved from cache`);
        return cached;
      }

      // Determine file path based on language
      let filePath: string;
      if (lang === 'en') {
        filePath = this.liveEventEnPath;
      } else if (lang === 'zh') {
        filePath = this.liveEventZhPath;
      } else {
        filePath = this.liveEventKrPath;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(`${this.CACHE_KEYS.LIVE_EVENT}:${lang}`, parsed);

      return parsed;
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
      const cmsDir = path.join(__dirname, '../../cms');
      const sourceFilePath = path.join(cmsDir, 'LiveEvent.json');
      try {
        await fs.access(sourceFilePath);
      } catch {
        throw new CustomError('LiveEvent.json not found in cms directory', 500);
      }
      const sourceData = await fs.readFile(sourceFilePath, 'utf-8');
      const parsedData = JSON.parse(sourceData);
      const liveEventData = parsedData.LiveEvent || {};

      // Use name from source data directly (client table data includes name field)
      // Remove loginBgmTag field - not needed
      // Convert dates to ISO8601 format
      const items = Object.values(liveEventData).map((item: any) => {
        const { loginBgmTag: _loginBgmTag, ...rest } = item;

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

      // Note: Data is now generated by adminToolDataBuilder.js and uploaded via API
      // await fs.writeFile(this.liveEventKrPath, JSON.stringify(lookupData, null, 2), 'utf-8');

      // Invalidate Redis cache for all instances
      await cacheService.delete(this.CACHE_KEYS.LIVE_EVENT);

      logger.info('LiveEvent lookup data built successfully', { itemCount: items.length });
      return { success: true, message: 'LiveEvent lookup data built successfully', itemCount: items.length };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build LiveEvent lookup data', { error });
      throw new CustomError('Failed to build LiveEvent lookup data', 500);
    }
  }

  /**
   * Get MateRecruitingGroup lookup data (cached in Redis for multi-instance support)
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getMateRecruitingGroupLookup(lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(`${this.CACHE_KEYS.MATE_RECRUITING}:${lang}`);
      if (cached) {
        await cacheService.setWithoutTTL(`${this.CACHE_KEYS.MATE_RECRUITING}:${lang}`, cached);
        logger.debug(`MateRecruitingGroup lookup data (${lang}) retrieved from cache`);
        return cached;
      }

      // Determine file path based on language
      let filePath: string;
      if (lang === 'en') {
        filePath = this.mateRecruitingGroupEnPath;
      } else if (lang === 'zh') {
        filePath = this.mateRecruitingGroupZhPath;
      } else {
        filePath = this.mateRecruitingGroupKrPath;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(`${this.CACHE_KEYS.MATE_RECRUITING}:${lang}`, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read MateRecruitingGroup lookup data', { error });
      throw new CustomError('Failed to load MateRecruitingGroup lookup data', 500);
    }
  }

  /**
   * Build MateRecruitingGroup lookup data from CMS file
   * NOTE: This method is deprecated. Use adminToolDataBuilder.js instead.
   */
  static async buildMateRecruitingGroupLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    try {
      logger.info('Building MateRecruitingGroup lookup data...');
      const cmsDir = path.join(__dirname, '../../cms');
      const sourceFilePath = path.join(cmsDir, 'MateRecruitingGroup.json');
      const mateTemplateFilePath = path.join(cmsDir, 'MateTemplate.json');
      const townFilePath = path.join(cmsDir, 'Town.json');

      try {
        await fs.access(sourceFilePath);
        await fs.access(mateTemplateFilePath);
        await fs.access(townFilePath);
      } catch {
        throw new CustomError('Required JSON files not found in cms directory', 500);
      }

      // This method is deprecated. Data should be built using adminToolDataBuilder.js
      // For now, just return a message indicating this is deprecated
      logger.warn('buildMateRecruitingGroupLookup is deprecated. Use adminToolDataBuilder.js instead.');

      // Check if the file exists
      const exists = await fs.access(this.mateRecruitingGroupKrPath).then(() => true).catch(() => false);
      if (!exists) {
        throw new CustomError('MateRecruitingGroup lookup file not found. Please run adminToolDataBuilder.js', 500);
      }

      // Invalidate Redis cache for all instances
      await cacheService.delete(this.CACHE_KEYS.MATE_RECRUITING);

      logger.info('MateRecruitingGroup cache invalidated');
      return { success: true, message: 'MateRecruitingGroup cache invalidated (data should be built using adminToolDataBuilder.js)', itemCount: 0 };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build MateRecruitingGroup lookup data', { error });
      throw new CustomError('Failed to build MateRecruitingGroup lookup data', 500);
    }
  }

  /**
   * Get OceanNpcAreaSpawner lookup data (cached in Redis for multi-instance support)
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getOceanNpcAreaSpawnerLookup(lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(`${this.CACHE_KEYS.OCEAN_NPC_AREA}:${lang}`);
      if (cached) {
        await cacheService.setWithoutTTL(`${this.CACHE_KEYS.OCEAN_NPC_AREA}:${lang}`, cached);
        logger.debug(`OceanNpcAreaSpawner lookup data (${lang}) retrieved from cache`);
        return cached;
      }

      // Determine file path based on language
      let filePath: string;
      if (lang === 'en') {
        filePath = this.oceanNpcAreaSpawnerEnPath;
      } else if (lang === 'zh') {
        filePath = this.oceanNpcAreaSpawnerZhPath;
      } else {
        filePath = this.oceanNpcAreaSpawnerKrPath;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(`${this.CACHE_KEYS.OCEAN_NPC_AREA}:${lang}`, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read OceanNpcAreaSpawner lookup data', { error });
      throw new CustomError('Failed to load OceanNpcAreaSpawner lookup data', 500);
    }
  }

  /**
   * Build OceanNpcAreaSpawner lookup data from CMS file
   * NOTE: This method is deprecated. Use adminToolDataBuilder.js instead.
   */
  static async buildOceanNpcAreaSpawnerLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    try {
      logger.info('Building OceanNpcAreaSpawner lookup data...');

      // This method is deprecated. Data should be built using adminToolDataBuilder.js
      // For now, just return a message indicating this is deprecated
      logger.warn('buildOceanNpcAreaSpawnerLookup is deprecated. Use adminToolDataBuilder.js instead.');

      // Check if the file exists
      const exists = await fs.access(this.oceanNpcAreaSpawnerKrPath).then(() => true).catch(() => false);
      if (!exists) {
        throw new CustomError('OceanNpcAreaSpawner lookup file not found. Please run adminToolDataBuilder.js', 500);
      }

      // Invalidate Redis cache for all instances
      await cacheService.delete(this.CACHE_KEYS.OCEAN_NPC_AREA);

      logger.info('OceanNpcAreaSpawner cache invalidated');
      return { success: true, message: 'OceanNpcAreaSpawner cache invalidated (data should be built using adminToolDataBuilder.js)', itemCount: 0 };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to build OceanNpcAreaSpawner lookup data', { error });
      throw new CustomError('Failed to build OceanNpcAreaSpawner lookup data', 500);
    }
  }

  /**
   * Upload planning data files (drag & drop)
   * Saves files to data/planning/ and caches them in Redis
   */
  static async uploadPlanningData(files: any): Promise<{ success: boolean; message: string; filesUploaded: string[]; stats: any }> {
    try {
      logger.info('Starting planning data upload...');

      // Ensure runtime data directory exists
      await fs.mkdir(this.runtimeDataPath, { recursive: true });

      // Expected file names
      const expectedFiles = [
        // Reward data
        'reward-type-list.json',
        'reward-lookup-kr.json',
        'reward-lookup-en.json',
        'reward-lookup-zh.json',
        // UI data
        'ui-list-data-kr.json',
        'ui-list-data-en.json',
        'ui-list-data-zh.json',
        // Event data - HotTimeBuff
        'hottimebuff-lookup-kr.json',
        'hottimebuff-lookup-en.json',
        'hottimebuff-lookup-zh.json',
        // Event data - EventPage
        'eventpage-lookup-kr.json',
        'eventpage-lookup-en.json',
        'eventpage-lookup-zh.json',
        // Event data - LiveEvent
        'liveevent-lookup-kr.json',
        'liveevent-lookup-en.json',
        'liveevent-lookup-zh.json',
        // Event data - MateRecruiting
        'materecruiting-lookup-kr.json',
        'materecruiting-lookup-en.json',
        'materecruiting-lookup-zh.json',
        // Event data - OceanNpcArea
        'oceannpcarea-lookup-kr.json',
        'oceannpcarea-lookup-en.json',
        'oceannpcarea-lookup-zh.json',
      ];

      // Validate uploaded files
      if (!files || Object.keys(files).length === 0) {
        throw new CustomError('No files uploaded', 400);
      }

      const uploadedFiles: string[] = [];
      const fileStats: any = {};

      // Process each uploaded file
      const invalidFiles: string[] = [];
      for (const [fieldName, fileArray] of Object.entries(files)) {
        const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

        if (!file) {
          logger.warn(`No file found for field: ${fieldName}`);
          continue;
        }

        const fileName = file.originalname;

        // Validate file name
        if (!expectedFiles.includes(fileName)) {
          logger.warn(`Unexpected file name: ${fileName}`);
          invalidFiles.push(fileName);
          continue;
        }

        // Validate JSON format
        try {
          const content = file.buffer.toString('utf-8');
          JSON.parse(content);
        } catch (error) {
          throw new CustomError(`File ${fileName} is not valid JSON`, 400);
        }

        // Save file to disk
        const filePath = path.join(this.runtimeDataPath, fileName);
        await fs.writeFile(filePath, file.buffer);

        uploadedFiles.push(fileName);
        fileStats[fileName] = {
          size: file.size,
          path: filePath,
        };

        logger.info(`File saved: ${fileName}`, { size: file.size });
      }

      if (uploadedFiles.length === 0) {
        if (invalidFiles.length > 0) {
          throw new CustomError(`인식할 수 없는 파일입니다: ${invalidFiles.join(', ')}`, 400);
        }
        throw new CustomError('No valid files were uploaded', 400);
      }

      // Cache all uploaded files in Redis
      await this.cacheUploadedFiles(uploadedFiles);

      logger.info('Planning data uploaded and cached successfully', { filesUploaded: uploadedFiles });

      return {
        success: true,
        message: `${uploadedFiles.length} planning data files uploaded and cached successfully`,
        filesUploaded: uploadedFiles,
        stats: {
          filesUploaded: uploadedFiles.length,
          totalSize: Object.values(fileStats).reduce((sum: number, stat: any) => sum + stat.size, 0),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to upload planning data', { error });
      throw new CustomError('Failed to upload planning data', 500);
    }
  }

  /**
   * Cache uploaded files in Redis
   * This ensures all instances have access to the latest data
   */
  private static async cacheUploadedFiles(uploadedFiles: string[]): Promise<void> {
    try {
      logger.info('Caching uploaded files in Redis...');

      // Map file names to cache keys
      const fileKeyMap: Record<string, string> = {
        'reward-lookup-kr.json': this.CACHE_KEYS.REWARD_LOOKUP_KR,
        'reward-lookup-en.json': this.CACHE_KEYS.REWARD_LOOKUP_EN,
        'reward-lookup-zh.json': this.CACHE_KEYS.REWARD_LOOKUP_ZH,
        'reward-type-list.json': this.CACHE_KEYS.REWARD_TYPE_LIST,
        'ui-list-data-kr.json': `${this.CACHE_KEYS.UI_LIST_DATA}:kr`,
        'ui-list-data-en.json': `${this.CACHE_KEYS.UI_LIST_DATA}:en`,
        'ui-list-data-zh.json': `${this.CACHE_KEYS.UI_LIST_DATA}:zh`,
        'hottimebuff-lookup-kr.json': `${this.CACHE_KEYS.HOT_TIME_BUFF}:kr`,
        'hottimebuff-lookup-en.json': `${this.CACHE_KEYS.HOT_TIME_BUFF}:en`,
        'hottimebuff-lookup-zh.json': `${this.CACHE_KEYS.HOT_TIME_BUFF}:zh`,
        'eventpage-lookup-kr.json': `${this.CACHE_KEYS.EVENT_PAGE}:kr`,
        'eventpage-lookup-en.json': `${this.CACHE_KEYS.EVENT_PAGE}:en`,
        'eventpage-lookup-zh.json': `${this.CACHE_KEYS.EVENT_PAGE}:zh`,
        'liveevent-lookup-kr.json': `${this.CACHE_KEYS.LIVE_EVENT}:kr`,
        'liveevent-lookup-en.json': `${this.CACHE_KEYS.LIVE_EVENT}:en`,
        'liveevent-lookup-zh.json': `${this.CACHE_KEYS.LIVE_EVENT}:zh`,
        'materecruiting-lookup-kr.json': `${this.CACHE_KEYS.MATE_RECRUITING}:kr`,
        'materecruiting-lookup-en.json': `${this.CACHE_KEYS.MATE_RECRUITING}:en`,
        'materecruiting-lookup-zh.json': `${this.CACHE_KEYS.MATE_RECRUITING}:zh`,
        'oceannpcarea-lookup-kr.json': `${this.CACHE_KEYS.OCEAN_NPC_AREA}:kr`,
        'oceannpcarea-lookup-en.json': `${this.CACHE_KEYS.OCEAN_NPC_AREA}:en`,
        'oceannpcarea-lookup-zh.json': `${this.CACHE_KEYS.OCEAN_NPC_AREA}:zh`,
      };

      // Cache each file
      for (const fileName of uploadedFiles) {
        const cacheKey = fileKeyMap[fileName];
        if (!cacheKey) {
          logger.warn(`No cache key mapping for file: ${fileName}`);
          continue;
        }

        const filePath = path.join(this.runtimeDataPath, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Cache in Redis without TTL (persistent)
        await cacheService.setWithoutTTL(cacheKey, data);

        logger.info(`File cached in Redis: ${fileName}`, { cacheKey });
      }

      logger.info('All uploaded files cached in Redis successfully');
    } catch (error) {
      logger.error('Failed to cache uploaded files in Redis', { error });
      throw new CustomError('Failed to cache planning data', 500);
    }
  }
}

