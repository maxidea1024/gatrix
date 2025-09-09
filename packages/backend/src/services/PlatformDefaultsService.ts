import VarsModel from '../models/Vars';
import logger from '../config/logger';

export interface PlatformDefaults {
  gameServerAddress?: string;
  patchAddress?: string;
}

export interface PlatformDefaultsMap {
  [platform: string]: PlatformDefaults;
}

const PLATFORM_DEFAULTS_KEY = 'platform_defaults';

export class PlatformDefaultsService {
  /**
   * 모든 플랫폼의 기본값 조회
   */
  static async getAllDefaults(): Promise<PlatformDefaultsMap> {
    try {
      const data = await VarsModel.get(PLATFORM_DEFAULTS_KEY);
      if (!data) {
        return {};
      }
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error getting platform defaults:', error);
      return {};
    }
  }

  /**
   * 특정 플랫폼의 기본값 조회
   */
  static async getPlatformDefaults(platform: string): Promise<PlatformDefaults> {
    try {
      const allDefaults = await this.getAllDefaults();
      return allDefaults[platform] || {};
    } catch (error) {
      logger.error(`Error getting defaults for platform ${platform}:`, error);
      return {};
    }
  }

  /**
   * 플랫폼별 기본값 설정
   */
  static async setPlatformDefaults(platform: string, defaults: PlatformDefaults, userId: number): Promise<void> {
    try {
      const allDefaults = await this.getAllDefaults();
      allDefaults[platform] = defaults;
      await VarsModel.set(PLATFORM_DEFAULTS_KEY, JSON.stringify(allDefaults), userId);
      logger.info(`Platform defaults updated for ${platform}:`, defaults);
    } catch (error) {
      logger.error(`Error setting defaults for platform ${platform}:`, error);
      throw error;
    }
  }

  /**
   * 모든 플랫폼의 기본값 일괄 설정
   */
  static async setAllDefaults(defaultsMap: PlatformDefaultsMap, userId: number): Promise<void> {
    try {
      await VarsModel.set(PLATFORM_DEFAULTS_KEY, JSON.stringify(defaultsMap), userId);
      logger.info('All platform defaults updated:', defaultsMap);
    } catch (error) {
      logger.error('Error setting all platform defaults:', error);
      throw error;
    }
  }

  /**
   * 특정 플랫폼의 기본값 삭제
   */
  static async deletePlatformDefaults(platform: string, userId: number): Promise<void> {
    try {
      const allDefaults = await this.getAllDefaults();
      delete allDefaults[platform];
      await VarsModel.set(PLATFORM_DEFAULTS_KEY, JSON.stringify(allDefaults), userId);
      logger.info(`Platform defaults deleted for ${platform}`);
    } catch (error) {
      logger.error(`Error deleting defaults for platform ${platform}:`, error);
      throw error;
    }
  }

  /**
   * 클라이언트 버전 데이터에 기본값 적용
   */
  static async applyDefaultsToClientVersion(platform: string, clientVersionData: any): Promise<any> {
    try {
      const defaults = await this.getPlatformDefaults(platform);
      
      return {
        ...clientVersionData,
        gameServerAddress: clientVersionData.gameServerAddress || defaults.gameServerAddress || '',
        patchAddress: clientVersionData.patchAddress || defaults.patchAddress || '',
      };
    } catch (error) {
      logger.error(`Error applying defaults to client version for platform ${platform}:`, error);
      return clientVersionData;
    }
  }
}
