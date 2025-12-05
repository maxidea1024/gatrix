import fs from 'fs/promises';
import path from 'path';
import { GatrixError } from '../middleware/errorHandler';
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

  // Base runtime data path (read-write, for dynamically generated files)
  // Now environment-specific: data/planning/{environmentId}/
  private static baseRuntimeDataPath = path.join(__dirname, '../../data/planning');

  private static initialized = false;

  // Redis cache key prefixes for environment-scoped data
  private static readonly CACHE_KEY_PREFIX = 'env';
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

  /**
   * Get environment-specific runtime data path
   */
  private static getEnvironmentDataPath(environmentId: string): string {
    return path.join(this.baseRuntimeDataPath, environmentId);
  }

  /**
   * Get environment-scoped cache key
   */
  private static getEnvCacheKey(environmentId: string, key: string): string {
    return `${this.CACHE_KEY_PREFIX}:${environmentId}:${key}`;
  }

  /**
   * Get file path for environment-specific planning data
   */
  private static getFilePath(environmentId: string, fileName: string): string {
    return path.join(this.getEnvironmentDataPath(environmentId), fileName);
  }

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
      // Ensure base runtime data directory exists
      await fs.mkdir(this.baseRuntimeDataPath, { recursive: true });
      logger.info('Runtime data directory ready', { path: this.baseRuntimeDataPath });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize planning data', { error });
      // Don't throw error - allow server to start even if planning data fails
    }
  }

  /**
   * Ensure environment-specific data directory exists
   */
  static async ensureEnvironmentDataDir(environmentId: string): Promise<void> {
    const envDataPath = this.getEnvironmentDataPath(environmentId);
    await fs.mkdir(envDataPath, { recursive: true });
  }

  /**
   * Get reward lookup data (cached in Redis for multi-instance support)
   * Data is already localized at generation time, so just load the appropriate language file
   * @param environmentId Environment ULID
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getRewardLookup(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<RewardLookupData> {
    try {
      // Determine cache key and file path based on language
      const baseCacheKey = lang === 'en' ? this.CACHE_KEYS.REWARD_LOOKUP_EN :
                           lang === 'zh' ? this.CACHE_KEYS.REWARD_LOOKUP_ZH :
                           this.CACHE_KEYS.REWARD_LOOKUP_KR;
      const cacheKey = this.getEnvCacheKey(environmentId, baseCacheKey);
      const filePath = this.getFilePath(environmentId, `reward-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<RewardLookupData>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`Reward lookup data (${lang}) retrieved from cache`, { environmentId });
        return cached;
      }

      // If not in cache, read from file
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return {};
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      logger.debug(`Reward lookup data (${lang}) loaded from file and cached`, { environmentId });
      return parsed;
    } catch (error) {
      logger.error('Failed to read reward lookup data', { error, lang, environmentId });
      throw new GatrixError('Failed to load reward lookup data', 500);
    }
  }

  /**
   * Get reward type list (cached in Redis for multi-instance support)
   * @param environmentId Environment ULID
   */
  static async getRewardTypeList(environmentId: string): Promise<RewardTypeInfo[]> {
    try {
      const cacheKey = this.getEnvCacheKey(environmentId, this.CACHE_KEYS.REWARD_TYPE_LIST);
      const filePath = this.getFilePath(environmentId, 'reward-type-list.json');

      // Try to get from Redis cache first
      const cached = await cacheService.get<RewardTypeInfo[]>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug('Reward type list retrieved from cache', { environmentId });
        return cached;
      }

      // If not in cache, read from file
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return [];
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read reward type list', { error, environmentId });
      throw new GatrixError('Failed to load reward type list', 500);
    }
  }

  /**
   * Get items for a specific reward type with localized names
   * @param environmentId Environment ULID
   * @param rewardType - Reward type number
   * @param language - Language code (kr, en, zh)
   */
  static async getRewardTypeItems(environmentId: string, rewardType: number, language: 'kr' | 'en' | 'zh' = 'kr'): Promise<RewardItem[]> {
    try {
      // Load the language-specific reward lookup data
      const lookupData = await PlanningDataService.getRewardLookup(environmentId, language);
      const typeData = lookupData[rewardType.toString()];

      if (!typeData) {
        throw new GatrixError(`Reward type ${rewardType} not found`, 404);
      }

      // Data is already localized at generation time, so just return items as-is
      return typeData.items || [];
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Failed to get reward type items', { error, rewardType, language });
      throw new GatrixError('Failed to load reward type items', 500);
    }
  }

  /**
   * Get UI list data (nations, towns, villages) - cached in Redis for multi-instance support
   * @param environmentId Environment ULID
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getUIListData(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<any> {
    try {
      const cacheKey = this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.UI_LIST_DATA}:${lang}`);
      const filePath = this.getFilePath(environmentId, `ui-list-data-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`UI list data (${lang}) retrieved from cache`, { environmentId });
        return cached;
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
      logger.error('Failed to read UI list data', { error, environmentId });
      throw new GatrixError('Failed to load UI list data', 500);
    }
  }

  /**
   * Get UI list items for a specific category with language support
   * @param environmentId Environment ULID
   * @param category - Category name (nations, towns, villages, ships, mates, etc.)
   * @param language - Language code (kr, en, zh)
   */
  static async getUIListItems(environmentId: string, category: string, language: 'kr' | 'en' | 'zh' = 'kr'): Promise<any[]> {
    try {
      const uiListData = await PlanningDataService.getUIListData(environmentId, language);

      if (!uiListData[category]) {
        throw new GatrixError(`Category '${category}' not found`, 404);
      }

      return uiListData[category];
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Failed to get UI list items', { error, category, language, environmentId });
      throw new GatrixError('Failed to load UI list items', 500);
    }
  }

  /**
   * Get planning data statistics
   * @param environmentId Environment ULID
   */
  static async getStats(environmentId: string): Promise<any> {
    try {
      const lookupData = await PlanningDataService.getRewardLookup(environmentId);
      const typeList = await PlanningDataService.getRewardTypeList(environmentId);
      const uiListData = await PlanningDataService.getUIListData(environmentId);

      const envDataPath = this.getEnvironmentDataPath(environmentId);

      // Check which files exist
      const filesExist = {
        rewardLookupKo: await fs.access(path.join(envDataPath, 'reward-lookup-kr.json')).then(() => true).catch(() => false),
        rewardLookupEn: await fs.access(path.join(envDataPath, 'reward-lookup-en.json')).then(() => true).catch(() => false),
        rewardLookupZh: await fs.access(path.join(envDataPath, 'reward-lookup-zh.json')).then(() => true).catch(() => false),
        rewardTypeList: await fs.access(path.join(envDataPath, 'reward-type-list.json')).then(() => true).catch(() => false),
        uiListData: await fs.access(path.join(envDataPath, 'ui-list-data-kr.json')).then(() => true).catch(() => false),
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
      throw new GatrixError('Failed to load planning data statistics', 500);
    }
  }

  /**
   * Get HotTimeBuff lookup data (cached in Redis for multi-instance support)
   * @param environmentId Environment ULID
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getHotTimeBuffLookup(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.HOT_TIME_BUFF}:${lang}`);
      const filePath = this.getFilePath(environmentId, `hottimebuff-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`HotTimeBuff lookup data (${lang}) retrieved from cache`, { environmentId });
        return cached;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return {};
      }

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read HotTimeBuff lookup data', { error, environmentId });
      throw new GatrixError('Failed to load HotTimeBuff lookup data', 500);
    }
  }



  /**
   * Get EventPage lookup data (cached in Redis for multi-instance support)
   * @param environmentId Environment ULID
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getEventPageLookup(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.EVENT_PAGE}:${lang}`);
      const filePath = this.getFilePath(environmentId, `eventpage-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`EventPage lookup data (${lang}) retrieved from cache`, { environmentId });
        return cached;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read EventPage lookup data', { error, environmentId });
      throw new GatrixError('Failed to load EventPage lookup data', 500);
    }
  }

  /**
   * Get LiveEvent lookup data (cached in Redis for multi-instance support)
   * @param environmentId Environment ULID
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getLiveEventLookup(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.LIVE_EVENT}:${lang}`);
      const filePath = this.getFilePath(environmentId, `liveevent-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`LiveEvent lookup data (${lang}) retrieved from cache`, { environmentId });
        return cached;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read LiveEvent lookup data', { error, environmentId });
      throw new GatrixError('Failed to load LiveEvent lookup data', 500);
    }
  }

  /**
   * Get MateRecruitingGroup lookup data (cached in Redis for multi-instance support)
   * @param environmentId Environment ULID
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getMateRecruitingGroupLookup(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.MATE_RECRUITING}:${lang}`);
      const filePath = this.getFilePath(environmentId, `materecruiting-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`MateRecruitingGroup lookup data (${lang}) retrieved from cache`, { environmentId });
        return cached;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read MateRecruitingGroup lookup data', { error, environmentId });
      throw new GatrixError('Failed to load MateRecruitingGroup lookup data', 500);
    }
  }

  /**
   * Get OceanNpcAreaSpawner lookup data (cached in Redis for multi-instance support)
   * @param environmentId Environment ULID
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getOceanNpcAreaSpawnerLookup(environmentId: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:${lang}`);
      const filePath = this.getFilePath(environmentId, `oceannpcarea-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`OceanNpcAreaSpawner lookup data (${lang}) retrieved from cache`, { environmentId });
        return cached;
      }

      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) return { totalCount: 0, items: [] };

      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Store in Redis cache for other instances
      await cacheService.setWithoutTTL(cacheKey, parsed);

      return parsed;
    } catch (error) {
      logger.error('Failed to read OceanNpcAreaSpawner lookup data', { error, environmentId });
      throw new GatrixError('Failed to load OceanNpcAreaSpawner lookup data', 500);
    }
  }

  /**
   * Upload planning data files (drag & drop)
   * Saves files to data/planning/{environmentId}/ and caches them in Redis
   * @param environmentId Environment ULID
   * @param files Uploaded files
   */
  static async uploadPlanningData(environmentId: string, files: any): Promise<{ success: boolean; message: string; filesUploaded: string[]; stats: any }> {
    try {
      logger.info('Starting planning data upload...', { environmentId });

      // Ensure environment-specific data directory exists
      const envDataPath = this.getEnvironmentDataPath(environmentId);
      await fs.mkdir(envDataPath, { recursive: true });

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
        throw new GatrixError('No files uploaded', 400);
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
          throw new GatrixError(`File ${fileName} is not valid JSON`, 400);
        }

        // Save file to disk (environment-specific path)
        const filePath = path.join(envDataPath, fileName);
        await fs.writeFile(filePath, file.buffer);

        uploadedFiles.push(fileName);
        fileStats[fileName] = {
          size: file.size,
          path: filePath,
        };

        logger.info(`File saved: ${fileName}`, { size: file.size, environmentId });
      }

      if (uploadedFiles.length === 0) {
        if (invalidFiles.length > 0) {
          throw new GatrixError(`인식할 수 없는 파일입니다: ${invalidFiles.join(', ')}`, 400);
        }
        throw new GatrixError('No valid files were uploaded', 400);
      }

      // Cache all uploaded files in Redis (environment-scoped)
      await this.cacheUploadedFiles(environmentId, uploadedFiles);

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
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to upload planning data', { error });
      throw new GatrixError('Failed to upload planning data', 500);
    }
  }

  /**
   * Cache uploaded files in Redis (environment-scoped)
   * This ensures all instances have access to the latest data
   * @param environmentId Environment ULID
   * @param uploadedFiles List of uploaded file names
   */
  private static async cacheUploadedFiles(environmentId: string, uploadedFiles: string[]): Promise<void> {
    try {
      logger.info('Caching uploaded files in Redis...', { environmentId });

      // Map file names to base cache keys
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

      const envDataPath = this.getEnvironmentDataPath(environmentId);

      // Cache each file
      for (const fileName of uploadedFiles) {
        const baseCacheKey = fileKeyMap[fileName];
        if (!baseCacheKey) {
          logger.warn(`No cache key mapping for file: ${fileName}`);
          continue;
        }

        // Use environment-scoped cache key
        const cacheKey = this.getEnvCacheKey(environmentId, baseCacheKey);
        const filePath = path.join(envDataPath, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Cache in Redis without TTL (persistent)
        await cacheService.setWithoutTTL(cacheKey, data);

        logger.info(`File cached in Redis: ${fileName}`, { cacheKey, environmentId });
      }

      logger.info('All uploaded files cached in Redis successfully', { environmentId });
    } catch (error) {
      logger.error('Failed to cache uploaded files in Redis', { error, environmentId });
      throw new GatrixError('Failed to cache planning data', 500);
    }
  }

  /**
   * Copy planning data from one environment to another
   * Copies both files and Redis cache
   * @param sourceEnvId Source environment ULID
   * @param targetEnvId Target environment ULID
   */
  static async copyPlanningData(sourceEnvId: string, targetEnvId: string): Promise<{ success: boolean; filesCopied: number }> {
    try {
      logger.info('Copying planning data between environments...', { sourceEnvId, targetEnvId });

      const sourceDataPath = this.getEnvironmentDataPath(sourceEnvId);
      const targetDataPath = this.getEnvironmentDataPath(targetEnvId);

      // Ensure target directory exists
      await fs.mkdir(targetDataPath, { recursive: true });

      // Check if source directory exists
      const sourceExists = await fs.access(sourceDataPath).then(() => true).catch(() => false);
      if (!sourceExists) {
        logger.info('Source environment has no planning data to copy', { sourceEnvId });
        return { success: true, filesCopied: 0 };
      }

      // Get list of files in source directory
      const files = await fs.readdir(sourceDataPath);
      let filesCopied = 0;

      for (const fileName of files) {
        if (!fileName.endsWith('.json')) continue;

        const sourceFilePath = path.join(sourceDataPath, fileName);
        const targetFilePath = path.join(targetDataPath, fileName);

        // Copy file
        const content = await fs.readFile(sourceFilePath, 'utf-8');
        await fs.writeFile(targetFilePath, content, 'utf-8');
        filesCopied++;

        logger.debug(`Copied planning file: ${fileName}`, { sourceEnvId, targetEnvId });
      }

      // Cache all copied files in Redis for target environment
      if (filesCopied > 0) {
        await this.cacheUploadedFiles(targetEnvId, files.filter(f => f.endsWith('.json')));
      }

      logger.info('Planning data copied successfully', { sourceEnvId, targetEnvId, filesCopied });
      return { success: true, filesCopied };
    } catch (error) {
      logger.error('Failed to copy planning data', { error, sourceEnvId, targetEnvId });
      throw new GatrixError('Failed to copy planning data', 500);
    }
  }

  /**
   * Delete all planning data for an environment
   * @param environmentId Environment ULID
   */
  static async deletePlanningData(environmentId: string): Promise<void> {
    try {
      logger.info('Deleting planning data for environment...', { environmentId });

      const envDataPath = this.getEnvironmentDataPath(environmentId);

      // Delete directory if exists
      const exists = await fs.access(envDataPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(envDataPath, { recursive: true, force: true });
      }

      // Delete all cache keys for this environment
      const cacheKeysToDelete = [
        this.getEnvCacheKey(environmentId, this.CACHE_KEYS.REWARD_LOOKUP_KR),
        this.getEnvCacheKey(environmentId, this.CACHE_KEYS.REWARD_LOOKUP_EN),
        this.getEnvCacheKey(environmentId, this.CACHE_KEYS.REWARD_LOOKUP_ZH),
        this.getEnvCacheKey(environmentId, this.CACHE_KEYS.REWARD_TYPE_LIST),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.UI_LIST_DATA}:kr`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.UI_LIST_DATA}:en`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.UI_LIST_DATA}:zh`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.HOT_TIME_BUFF}:kr`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.HOT_TIME_BUFF}:en`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.HOT_TIME_BUFF}:zh`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.EVENT_PAGE}:kr`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.EVENT_PAGE}:en`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.EVENT_PAGE}:zh`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.LIVE_EVENT}:kr`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.LIVE_EVENT}:en`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.LIVE_EVENT}:zh`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.MATE_RECRUITING}:kr`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.MATE_RECRUITING}:en`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.MATE_RECRUITING}:zh`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:kr`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:en`),
        this.getEnvCacheKey(environmentId, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:zh`),
      ];

      await Promise.all(cacheKeysToDelete.map(key => cacheService.delete(key)));

      logger.info('Planning data deleted successfully', { environmentId });
    } catch (error) {
      logger.error('Failed to delete planning data', { error, environmentId });
      throw new GatrixError('Failed to delete planning data', 500);
    }
  }
}

