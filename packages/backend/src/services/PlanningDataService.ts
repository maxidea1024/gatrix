import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { diff as deepDiff, Diff } from 'deep-diff';
import { GatrixError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { cacheService } from './CacheService';
import db from '../config/knex';

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
    CASH_SHOP: 'planning:cashshop-lookup',
  };

  /**
   * Get environment-specific runtime data path
   */
  private static getEnvironmentDataPath(environment: string): string {
    return path.join(this.baseRuntimeDataPath, environment);
  }

  /**
   * Get environment-scoped cache key
   */
  private static getEnvCacheKey(environment: string, key: string): string {
    return `${this.CACHE_KEY_PREFIX}:${environment}:${key}`;
  }

  /**
   * Get file path for environment-specific planning data
   */
  private static getFilePath(environment: string, fileName: string): string {
    return path.join(this.getEnvironmentDataPath(environment), fileName);
  }

  /**
   * Map file name to cache key
   */
  private static getFileCacheKey(fileName: string): string | null {
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
      'cashshop-lookup.json': this.CACHE_KEYS.CASH_SHOP,
    };
    return fileKeyMap[fileName] || null;
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
  static async ensureEnvironmentDataDir(environment: string): Promise<void> {
    const envDataPath = this.getEnvironmentDataPath(environment);
    await fs.mkdir(envDataPath, { recursive: true });
  }

  /**
   * Get reward lookup data (cached in Redis for multi-instance support)
   * Data is already localized at generation time, so just load the appropriate language file
   * @param environment Environment name
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getRewardLookup(environment: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<RewardLookupData> {
    try {
      // Determine cache key and file path based on language
      const baseCacheKey = lang === 'en' ? this.CACHE_KEYS.REWARD_LOOKUP_EN :
        lang === 'zh' ? this.CACHE_KEYS.REWARD_LOOKUP_ZH :
          this.CACHE_KEYS.REWARD_LOOKUP_KR;
      const cacheKey = this.getEnvCacheKey(environment, baseCacheKey);
      const filePath = this.getFilePath(environment, `reward-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<RewardLookupData>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`Reward lookup data (${lang}) retrieved from cache`, { environment });
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

      logger.debug(`Reward lookup data (${lang}) loaded from file and cached`, { environment });
      return parsed;
    } catch (error) {
      logger.error('Failed to read reward lookup data', { error, lang, environment });
      throw new GatrixError('Failed to load reward lookup data', 500);
    }
  }

  /**
   * Get reward type list (cached in Redis for multi-instance support)
   * @param environment Environment name
   */
  static async getRewardTypeList(environment: string): Promise<RewardTypeInfo[]> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, this.CACHE_KEYS.REWARD_TYPE_LIST);
      const filePath = this.getFilePath(environment, 'reward-type-list.json');

      // Try to get from Redis cache first
      const cached = await cacheService.get<RewardTypeInfo[]>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug('Reward type list retrieved from cache', { environment });
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
      logger.error('Failed to read reward type list', { error, environment });
      throw new GatrixError('Failed to load reward type list', 500);
    }
  }

  /**
   * Get items for a specific reward type with localized names
   * @param environment Environment name
   * @param rewardType - Reward type number
   * @param language - Language code (kr, en, zh)
   */
  static async getRewardTypeItems(environment: string, rewardType: number, language: 'kr' | 'en' | 'zh' = 'kr'): Promise<RewardItem[]> {
    try {
      // Load the language-specific reward lookup data
      const lookupData = await PlanningDataService.getRewardLookup(environment, language);
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
   * @param environment Environment name
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getUIListData(environment: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<any> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, `${this.CACHE_KEYS.UI_LIST_DATA}:${lang}`);
      const filePath = this.getFilePath(environment, `ui-list-data-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`UI list data (${lang}) retrieved from cache`, { environment });
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
      logger.error('Failed to read UI list data', { error, environment });
      throw new GatrixError('Failed to load UI list data', 500);
    }
  }

  /**
   * Get UI list items for a specific category with language support
   * @param environment Environment name
   * @param category - Category name (nations, towns, villages, ships, mates, etc.)
   * @param language - Language code (kr, en, zh)
   */
  static async getUIListItems(environment: string, category: string, language: 'kr' | 'en' | 'zh' = 'kr'): Promise<any[]> {
    try {
      const uiListData = await PlanningDataService.getUIListData(environment, language);

      if (!uiListData[category]) {
        throw new GatrixError(`Category '${category}' not found`, 404);
      }

      return uiListData[category];
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Failed to get UI list items', { error, category, language, environment });
      throw new GatrixError('Failed to load UI list items', 500);
    }
  }

  /**
   * Get planning data statistics
   * @param environment Environment name
   */
  static async getStats(environment: string): Promise<any> {
    try {
      const lookupData = await PlanningDataService.getRewardLookup(environment);
      const typeList = await PlanningDataService.getRewardTypeList(environment);
      const uiListData = await PlanningDataService.getUIListData(environment);

      const envDataPath = this.getEnvironmentDataPath(environment);

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
      logger.error('Failed to get planning data stats', { error, environment });
      throw new GatrixError('Failed to load planning data statistics', 500);
    }
  }

  /**
   * Get HotTimeBuff lookup data (cached in Redis for multi-instance support)
   * @param environment Environment name
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getHotTimeBuffLookup(environment: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, `${this.CACHE_KEYS.HOT_TIME_BUFF}:${lang}`);
      const filePath = this.getFilePath(environment, `hottimebuff-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`HotTimeBuff lookup data (${lang}) retrieved from cache`, { environment });
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
      logger.error('Failed to read HotTimeBuff lookup data', { error, environment });
      throw new GatrixError('Failed to load HotTimeBuff lookup data', 500);
    }
  }



  /**
   * Get EventPage lookup data (cached in Redis for multi-instance support)
   * @param environment Environment name
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getEventPageLookup(environment: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, `${this.CACHE_KEYS.EVENT_PAGE}:${lang}`);
      const filePath = this.getFilePath(environment, `eventpage-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`EventPage lookup data (${lang}) retrieved from cache`, { environment });
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
      logger.error('Failed to read EventPage lookup data', { error, environment });
      throw new GatrixError('Failed to load EventPage lookup data', 500);
    }
  }

  /**
   * Get LiveEvent lookup data (cached in Redis for multi-instance support)
   * @param environment Environment name
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getLiveEventLookup(environment: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, `${this.CACHE_KEYS.LIVE_EVENT}:${lang}`);
      const filePath = this.getFilePath(environment, `liveevent-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`LiveEvent lookup data (${lang}) retrieved from cache`, { environment });
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
      logger.error('Failed to read LiveEvent lookup data', { error, environment });
      throw new GatrixError('Failed to load LiveEvent lookup data', 500);
    }
  }

  /**
   * Get MateRecruitingGroup lookup data (cached in Redis for multi-instance support)
   * @param environment Environment name
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getMateRecruitingGroupLookup(environment: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, `${this.CACHE_KEYS.MATE_RECRUITING}:${lang}`);
      const filePath = this.getFilePath(environment, `materecruiting-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`MateRecruitingGroup lookup data (${lang}) retrieved from cache`, { environment });
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
      logger.error('Failed to read MateRecruitingGroup lookup data', { error, environment });
      throw new GatrixError('Failed to load MateRecruitingGroup lookup data', 500);
    }
  }

  /**
   * Get OceanNpcAreaSpawner lookup data (cached in Redis for multi-instance support)
   * @param environment Environment name
   * @param lang Language code: 'kr', 'en', 'zh'
   */
  static async getOceanNpcAreaSpawnerLookup(environment: string, lang: 'kr' | 'en' | 'zh' = 'kr'): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:${lang}`);
      const filePath = this.getFilePath(environment, `oceannpcarea-lookup-${lang}.json`);

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug(`OceanNpcAreaSpawner lookup data (${lang}) retrieved from cache`, { environment });
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
      logger.error('Failed to read OceanNpcAreaSpawner lookup data', { error, environment });
      throw new GatrixError('Failed to load OceanNpcAreaSpawner lookup data', 500);
    }
  }

  /**
   * Get CashShop lookup data (unified multi-language file)
   * @param environment Environment name
   */
  static async getCashShopLookup(environment: string): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getEnvCacheKey(environment, this.CACHE_KEYS.CASH_SHOP);
      const filePath = this.getFilePath(environment, 'cashshop-lookup.json');

      // Try to get from Redis cache first
      const cached = await cacheService.get<Record<string, any>>(cacheKey);
      if (cached) {
        await cacheService.setWithoutTTL(cacheKey, cached);
        logger.debug('CashShop lookup data retrieved from cache', { environment });
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
      logger.error('Failed to read CashShop lookup data', { error, environment });
      throw new GatrixError('Failed to load CashShop lookup data', 500);
    }
  }

  /**
   * Upload planning data files (drag & drop)
   * Saves files to data/planning/{environment}/ and caches them in Redis
   * @param environment Environment name
   * @param files Uploaded files
   * @param uploadInfo Optional upload metadata (uploader info, comment, source)
   */
  static async uploadPlanningData(
    environment: string,
    files: any,
    uploadInfo?: {
      uploadedBy?: number;
      uploaderName?: string;
      uploadSource?: 'web' | 'cli';
      uploadComment?: string;
    }
  ): Promise<{ success: boolean; message: string; filesUploaded: string[]; stats: any; uploadRecord?: any }> {
    try {
      logger.info('Starting planning data upload...', { environment, uploadInfo });

      // Ensure environment-specific data directory exists
      const envDataPath = this.getEnvironmentDataPath(environment);
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
        // CashShop data (unified multi-language file)
        'cashshop-lookup.json',
      ];

      // Validate uploaded files
      if (!files || Object.keys(files).length === 0) {
        throw new GatrixError('No files uploaded', 400);
      }

      const uploadedFiles: string[] = [];
      const fileStats: Record<string, { size: number; path: string }> = {};
      const fileHashes: Record<string, string> = {};
      const fileContents: Record<string, string> = {};
      const allBuffers: Buffer[] = [];

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

        // Calculate file hash
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        fileHashes[fileName] = fileHash;
        fileContents[fileName] = file.buffer.toString('utf-8');
        allBuffers.push(file.buffer);

        // Save file to disk (environment-specific path)
        const filePath = path.join(envDataPath, fileName);
        await fs.writeFile(filePath, file.buffer);

        uploadedFiles.push(fileName);
        fileStats[fileName] = {
          size: file.size,
          path: filePath,
        };

        logger.info(`File saved: ${fileName}`, { size: file.size, hash: fileHash.substring(0, 8), environment });
      }

      if (uploadedFiles.length === 0) {
        if (invalidFiles.length > 0) {
          throw new GatrixError(`인식할 수 없는 파일입니다: ${invalidFiles.join(', ')}`, 400);
        }
        throw new GatrixError('No valid files were uploaded', 400);
      }

      // Calculate overall upload hash
      const combinedHash = crypto.createHash('sha256');
      allBuffers.forEach(buf => combinedHash.update(buf));
      const uploadHash = combinedHash.digest('hex');

      // Get previous upload to determine changed files
      const previousUpload = await db('planningDataUploads')
        .where({ environment })
        .orderBy('uploadedAt', 'desc')
        .first();

      // Check if upload hash is the same - skip if no changes
      if (previousUpload && previousUpload.uploadHash === uploadHash) {
        logger.info('Planning data upload skipped - no changes detected', {
          environment,
          uploadHash: uploadHash.substring(0, 16),
        });
        return {
          success: true,
          message: 'No changes detected - upload skipped',
          filesUploaded: uploadedFiles,
          stats: {
            filesUploaded: uploadedFiles.length,
            totalSize: Object.values(fileStats).reduce((sum, stat) => sum + stat.size, 0),
            timestamp: new Date().toISOString(),
            uploadHash: uploadHash.substring(0, 16),
            changedFilesCount: 0,
            changedFiles: [],
            skipped: true,
          },
        };
      }

      const changedFiles: string[] = [];
      const fileDiffs: Record<string, {
        added: Array<{ path: string; value: any }>;
        removed: Array<{ path: string; value: any }>;
        modified: Array<{ path: string; before: any; after: any }>;
      }> = {};

      // Compare with cached data to detect changes (works even if history was cleared)
      for (const [fileName, _hash] of Object.entries(fileHashes)) {
        try {
          const currentContent = fileContents[fileName];
          if (!currentContent) continue;

          const currentJson = JSON.parse(currentContent);
          const baseCacheKey = this.getFileCacheKey(fileName);

          if (baseCacheKey) {
            const cacheKey = this.getEnvCacheKey(environment, baseCacheKey);
            const prevContent = await cacheService.get<any>(cacheKey);

            if (prevContent) {
              // Compare JSON content
              const prevStr = JSON.stringify(prevContent, null, 0);
              const currStr = JSON.stringify(currentJson, null, 0);

              if (prevStr !== currStr) {
                changedFiles.push(fileName);

                // Calculate detailed diff
                const diff = this.calculateJsonDiff(prevContent, currentJson);
                if (diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0) {
                  fileDiffs[fileName] = diff;
                }
                logger.debug(`File changed: ${fileName}`, { added: diff.added.length, removed: diff.removed.length, modified: diff.modified.length });
              }
            } else {
              // No cache = new file
              changedFiles.push(fileName);
              logger.debug(`New file (no cache): ${fileName}`);
            }
          } else {
            // Unknown file type
            changedFiles.push(fileName);
            logger.debug(`Unknown file type: ${fileName}`);
          }
        } catch (e) {
          // Parse error - treat as changed
          changedFiles.push(fileName);
          logger.debug(`Error comparing ${fileName}:`, e);
        }
      }

      // Calculate total size
      const totalSize = Object.values(fileStats).reduce((sum, stat) => sum + stat.size, 0);

      // Save upload record to database
      const [uploadRecordId] = await db('planningDataUploads').insert({
        environment,
        uploadHash,
        filesUploaded: JSON.stringify(uploadedFiles),
        fileHashes: JSON.stringify(fileHashes),
        filesCount: uploadedFiles.length,
        totalSize,
        uploadedBy: uploadInfo?.uploadedBy || null,
        uploaderName: uploadInfo?.uploaderName || null,
        uploadSource: uploadInfo?.uploadSource || 'web',
        uploadComment: uploadInfo?.uploadComment || null,
        changedFiles: JSON.stringify(changedFiles),
        fileDiffs: JSON.stringify(fileDiffs),
        uploadedAt: new Date(),
      });

      // Fetch the created record
      const uploadRecord = await db('planningDataUploads').where({ id: uploadRecordId }).first();

      // Cache all uploaded files in Redis (environment-scoped)
      await this.cacheUploadedFiles(environment, uploadedFiles);

      logger.info('Planning data uploaded and cached successfully', {
        filesUploaded: uploadedFiles,
        uploadHash: uploadHash.substring(0, 8),
        changedFiles,
        uploadRecordId,
      });

      return {
        success: true,
        message: `${uploadedFiles.length} planning data files uploaded and cached successfully`,
        filesUploaded: uploadedFiles,
        stats: {
          filesUploaded: uploadedFiles.length,
          totalSize,
          timestamp: new Date().toISOString(),
          uploadHash: uploadHash.substring(0, 16),
          changedFilesCount: changedFiles.length,
          changedFiles,
        },
        uploadRecord: uploadRecord ? {
          id: uploadRecord.id,
          uploadHash: uploadRecord.uploadHash.substring(0, 16),
          uploaderName: uploadRecord.uploaderName,
          uploadSource: uploadRecord.uploadSource,
          uploadedAt: uploadRecord.uploadedAt,
        } : undefined,
      };
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to upload planning data', { error, environment });
      throw new GatrixError('Failed to upload planning data', 500);
    }
  }

  /**
   * Get planning data upload history for an environment
   * @param environment Environment name
   * @param limit Maximum number of records to return
   */
  static async getUploadHistory(environment: string, limit: number = 20): Promise<any[]> {
    try {
      const uploads = await db('planningDataUploads')
        .where({ environment })
        .orderBy('uploadedAt', 'desc')
        .limit(limit);

      return uploads.map(upload => ({
        id: upload.id,
        uploadHash: upload.uploadHash.substring(0, 16),
        filesUploaded: typeof upload.filesUploaded === 'string' ? JSON.parse(upload.filesUploaded) : upload.filesUploaded,
        filesCount: upload.filesCount,
        totalSize: upload.totalSize,
        uploaderName: upload.uploaderName,
        uploadSource: upload.uploadSource,
        uploadComment: upload.uploadComment,
        changedFiles: typeof upload.changedFiles === 'string' ? JSON.parse(upload.changedFiles) : (upload.changedFiles || []),
        fileDiffs: typeof upload.fileDiffs === 'string' ? JSON.parse(upload.fileDiffs) : (upload.fileDiffs || {}),
        uploadedAt: upload.uploadedAt,
      }));
    } catch (error) {
      logger.error('Failed to get upload history', { error, environment });
      throw new GatrixError('Failed to get upload history', 500);
    }
  }

  /**
   * Get the latest planning data upload for an environment
   * @param environment Environment name
   */
  static async getLatestUpload(environment: string): Promise<any | null> {
    try {
      const upload = await db('planningDataUploads')
        .where({ environment })
        .orderBy('uploadedAt', 'desc')
        .first();

      if (!upload) return null;

      return {
        id: upload.id,
        uploadHash: upload.uploadHash.substring(0, 16),
        filesUploaded: typeof upload.filesUploaded === 'string' ? JSON.parse(upload.filesUploaded) : upload.filesUploaded,
        filesCount: upload.filesCount,
        totalSize: upload.totalSize,
        uploaderName: upload.uploaderName,
        uploadSource: upload.uploadSource,
        uploadComment: upload.uploadComment,
        changedFiles: typeof upload.changedFiles === 'string' ? JSON.parse(upload.changedFiles) : (upload.changedFiles || []),
        fileDiffs: typeof upload.fileDiffs === 'string' ? JSON.parse(upload.fileDiffs) : (upload.fileDiffs || {}),
        uploadedAt: upload.uploadedAt,
      };
    } catch (error) {
      logger.error('Failed to get latest upload', { error, environment });
      throw new GatrixError('Failed to get latest upload', 500);
    }
  }

  /**
   * Reset all upload history for an environment
   * @param environment Environment name
   * @returns Number of deleted records
   */
  static async resetUploadHistory(environment: string): Promise<number> {
    try {
      const deletedCount = await db('planningDataUploads')
        .where({ environment })
        .delete();

      logger.info('Upload history reset', { deletedCount, environment });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to reset upload history', { error, environment });
      throw new GatrixError('Failed to reset upload history', 500);
    }
  }

  /**
   * Cleanup old upload records beyond retention period
   * @param environment Environment name
   * @param retentionDays Number of days to keep records (default from env: PLANNING_DATA_RETENTION_DAYS)
   */
  static async cleanupOldRecords(environment: string, retentionDays?: number): Promise<number> {
    try {
      const days = retentionDays || parseInt(process.env.PLANNING_DATA_RETENTION_DAYS || '14', 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const deletedCount = await db('planningDataUploads')
        .where({ environment })
        .where('uploadedAt', '<', cutoffDate)
        .delete();

      if (deletedCount > 0) {
        logger.info('Old upload records cleaned up', { environment, deletedCount, retentionDays: days });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old upload records', { error, environment });
      throw new GatrixError('Failed to cleanup old upload records', 500);
    }
  }

  /**
   * Cleanup old upload records for all environments
   * Called by QueueService periodically
   */
  static async cleanupAllEnvironments(): Promise<{ total: number; byEnvironment: Record<string, number> }> {
    try {
      const environments = await db('planningDataUploads')
        .distinct('environment')
        .pluck('environment');

      const byEnvironment: Record<string, number> = {};
      let total = 0;

      for (const environment of environments) {
        const deleted = await this.cleanupOldRecords(environment);
        byEnvironment[environment] = deleted;
        total += deleted;
      }

      if (total > 0) {
        logger.info('Planning data upload records cleanup completed', { total, byEnvironment });
      }

      return { total, byEnvironment };
    } catch (error) {
      logger.error('Failed to cleanup all environments', { error });
      throw new GatrixError('Failed to cleanup old upload records', 500);
    }
  }

  /**
   * Cache uploaded files in Redis (environment-scoped)
   * This ensures all instances have access to the latest data
   * @param environment Environment name
   * @param uploadedFiles List of uploaded file names
   */
  private static async cacheUploadedFiles(environment: string, uploadedFiles: string[]): Promise<void> {
    try {
      logger.info('Caching uploaded files in Redis...', { environment });

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
        'cashshop-lookup.json': this.CACHE_KEYS.CASH_SHOP,
      };

      const envDataPath = this.getEnvironmentDataPath(environment);

      // Cache each file
      for (const fileName of uploadedFiles) {
        const baseCacheKey = fileKeyMap[fileName];
        if (!baseCacheKey) {
          logger.warn(`No cache key mapping for file: ${fileName}`);
          continue;
        }

        // Use environment-scoped cache key
        const cacheKey = this.getEnvCacheKey(environment, baseCacheKey);
        const filePath = path.join(envDataPath, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Cache in Redis without TTL (persistent)
        await cacheService.setWithoutTTL(cacheKey, data);

        logger.info(`File cached in Redis: ${fileName}`, { cacheKey, environment });
      }

      logger.info('All uploaded files cached in Redis successfully', { environment });
    } catch (error) {
      logger.error('Failed to cache uploaded files in Redis', { error, environment });
      throw new GatrixError('Failed to cache planning data', 500);
    }
  }

  /**
   * Copy planning data from one environment to another
   * Copies both files and Redis cache
   * @param sourceEnv Source environment name
   * @param targetEnv Target environment name
   */
  static async copyPlanningData(sourceEnv: string, targetEnv: string): Promise<{ success: boolean; filesCopied: number }> {
    try {
      logger.info('Copying planning data between environments...', { sourceEnv, targetEnv });

      const sourceDataPath = this.getEnvironmentDataPath(sourceEnv);
      const targetDataPath = this.getEnvironmentDataPath(targetEnv);

      // Ensure target directory exists
      await fs.mkdir(targetDataPath, { recursive: true });

      // Check if source directory exists
      const sourceExists = await fs.access(sourceDataPath).then(() => true).catch(() => false);
      if (!sourceExists) {
        logger.info('Source environment has no planning data to copy', { sourceEnv });
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

        logger.debug(`Copied planning file: ${fileName}`, { sourceEnv, targetEnv });
      }

      // Cache all copied files in Redis for target environment
      if (filesCopied > 0) {
        await this.cacheUploadedFiles(targetEnv, files.filter(f => f.endsWith('.json')));
      }

      logger.info('Planning data copied successfully', { sourceEnv, targetEnv, filesCopied });
      return { success: true, filesCopied };
    } catch (error) {
      logger.error('Failed to copy planning data', { error, sourceEnv, targetEnv });
      throw new GatrixError('Failed to copy planning data', 500);
    }
  }

  /**
   * Delete all planning data for an environment
   * @param environment Environment name
   */
  static async deletePlanningData(environment: string): Promise<void> {
    try {
      logger.info('Deleting planning data for environment...', { environment });

      const envDataPath = this.getEnvironmentDataPath(environment);

      // Delete directory if exists
      const exists = await fs.access(envDataPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(envDataPath, { recursive: true, force: true });
      }

      // Delete all cache keys for this environment
      const cacheKeysToDelete = [
        this.getEnvCacheKey(environment, this.CACHE_KEYS.REWARD_LOOKUP_KR),
        this.getEnvCacheKey(environment, this.CACHE_KEYS.REWARD_LOOKUP_EN),
        this.getEnvCacheKey(environment, this.CACHE_KEYS.REWARD_LOOKUP_ZH),
        this.getEnvCacheKey(environment, this.CACHE_KEYS.REWARD_TYPE_LIST),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.UI_LIST_DATA}:kr`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.UI_LIST_DATA}:en`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.UI_LIST_DATA}:zh`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.HOT_TIME_BUFF}:kr`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.HOT_TIME_BUFF}:en`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.HOT_TIME_BUFF}:zh`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.EVENT_PAGE}:kr`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.EVENT_PAGE}:en`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.EVENT_PAGE}:zh`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.LIVE_EVENT}:kr`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.LIVE_EVENT}:en`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.LIVE_EVENT}:zh`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.MATE_RECRUITING}:kr`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.MATE_RECRUITING}:en`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.MATE_RECRUITING}:zh`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:kr`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:en`),
        this.getEnvCacheKey(environment, `${this.CACHE_KEYS.OCEAN_NPC_AREA}:zh`),
      ];

      await Promise.all(cacheKeysToDelete.map(key => cacheService.delete(key)));

      logger.info('Planning data deleted successfully', { environment });
    } catch (error) {
      logger.error('Failed to delete planning data', { error, environment });
      throw new GatrixError('Failed to delete planning data', 500);
    }
  }

  /**
   * Preview diff between uploaded files and cached data without saving
   * Returns diff information for each file that would change
   */
  static async previewDiff(
    environment: string,
    files: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined
  ): Promise<{
    changedFiles: string[];
    fileDiffs: Record<string, {
      added: Array<{ path: string; value: any }>;
      removed: Array<{ path: string; value: any }>;
      modified: Array<{ path: string; before: any; after: any }>;
    }>;
    summary: {
      totalAdded: number;
      totalRemoved: number;
      totalModified: number;
    };
  }> {
    if (!files) {
      return {
        changedFiles: [],
        fileDiffs: {},
        summary: { totalAdded: 0, totalRemoved: 0, totalModified: 0 },
      };
    }

    // Normalize files array
    const fileArray = Array.isArray(files) ? files : Object.values(files).flat();

    // Read file contents
    const fileContents: Record<string, string> = {};
    for (const file of fileArray) {
      const content = file.buffer.toString('utf-8');
      fileContents[file.originalname] = content;
    }

    const changedFiles: string[] = [];
    const fileDiffs: Record<string, {
      added: Array<{ path: string; value: any }>;
      removed: Array<{ path: string; value: any }>;
      modified: Array<{ path: string; before: any; after: any }>;
    }> = {};

    let totalAdded = 0;
    let totalRemoved = 0;
    let totalModified = 0;

    // Compare with cached data
    for (const [fileName, content] of Object.entries(fileContents)) {
      try {
        const currentJson = JSON.parse(content);
        const baseCacheKey = this.getFileCacheKey(fileName);

        if (baseCacheKey) {
          const cacheKey = this.getEnvCacheKey(environment, baseCacheKey);
          const prevContent = await cacheService.get<any>(cacheKey);

          if (prevContent) {
            // Compare JSON content
            const prevStr = JSON.stringify(prevContent, null, 0);
            const currStr = JSON.stringify(currentJson, null, 0);

            if (prevStr !== currStr) {
              changedFiles.push(fileName);

              // Calculate detailed diff
              const diff = this.calculateJsonDiff(prevContent, currentJson);
              if (diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0) {
                fileDiffs[fileName] = diff;
                totalAdded += diff.added.length;
                totalRemoved += diff.removed.length;
                totalModified += diff.modified.length;
              }
            }
          } else {
            // No cache = new file (all items are "added")
            changedFiles.push(fileName);
            // For new files, treat the entire content as added
            const itemCount = Array.isArray(currentJson) ? currentJson.length : Object.keys(currentJson).length;
            fileDiffs[fileName] = {
              added: [{ path: 'root', value: `New file with ${itemCount} items` }],
              removed: [],
              modified: [],
            };
            totalAdded += 1;
          }
        }
      } catch (e) {
        // Parse error - treat as changed
        changedFiles.push(fileName);
        logger.debug(`Error parsing ${fileName} for preview:`, e);
      }
    }

    return {
      changedFiles,
      fileDiffs,
      summary: { totalAdded, totalRemoved, totalModified },
    };
  }

  /**
   * Calculate diff between two JSON objects using deep-diff library
   * For arrays with 'id' field, converts to id-keyed objects to avoid index shift issues
   * Returns lists of added, removed, and modified items with before/after values
   */
  private static calculateJsonDiff(
    oldJson: any,
    newJson: any
  ): { added: Array<{ path: string; value: any }>; removed: Array<{ path: string; value: any }>; modified: Array<{ path: string; before: any; after: any }> } {
    const added: Array<{ path: string; value: any }> = [];
    const removed: Array<{ path: string; value: any }> = [];
    const modified: Array<{ path: string; before: any; after: any }> = [];

    // Convert arrays with id field to id-keyed objects for better comparison
    const normalizeForDiff = (obj: any): any => {
      if (Array.isArray(obj)) {
        // Check if array items have 'id' field
        if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && 'id' in obj[0]) {
          // Convert to object keyed by id
          const result: Record<string, any> = {};
          for (const item of obj) {
            result[String(item.id)] = normalizeForDiff(item);
          }
          return result;
        }
        // Regular array without id - keep as is
        return obj.map(normalizeForDiff);
      } else if (typeof obj === 'object' && obj !== null) {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = normalizeForDiff(value);
        }
        return result;
      }
      return obj;
    };

    const normalizedOld = normalizeForDiff(oldJson);
    const normalizedNew = normalizeForDiff(newJson);

    const differences = deepDiff(normalizedOld, normalizedNew);

    if (differences) {
      for (const d of differences) {
        // Build path string from diff path array
        const pathStr = d.path ? d.path.join('.') : 'root';

        switch (d.kind) {
          case 'N': // New (added)
            added.push({ path: pathStr, value: d.rhs });
            break;
          case 'D': // Deleted (removed)
            removed.push({ path: pathStr, value: d.lhs });
            break;
          case 'E': // Edited (modified)
            modified.push({ path: pathStr, before: d.lhs, after: d.rhs });
            break;
          case 'A': // Array change
            // For array changes, include the index and nested path
            const arrayPath = d.path ? d.path.join('.') : 'root';
            const indexPath = `${arrayPath}[${d.index}]`;
            if (d.item.kind === 'N') {
              added.push({ path: indexPath, value: d.item.rhs });
            } else if (d.item.kind === 'D') {
              removed.push({ path: indexPath, value: d.item.lhs });
            } else if (d.item.kind === 'E') {
              modified.push({ path: indexPath, before: d.item.lhs, after: d.item.rhs });
            }
            break;
        }
      }
    }

    return { added, removed, modified };
  }
}


