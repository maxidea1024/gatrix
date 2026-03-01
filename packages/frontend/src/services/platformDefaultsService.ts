import { apiService } from './api';

export interface PlatformDefaults {
  gameServerAddress?: string;
  patchAddress?: string;
}

export interface PlatformDefaultsMap {
  [platform: string]: PlatformDefaults;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export class PlatformDefaultsService {
  private static readonly BASE_URL = '/admin/platform-defaults';

  /**
   * Get default values of all platforms
   */
  static async getAllDefaults(): Promise<PlatformDefaultsMap> {
    const response = await apiService.get<PlatformDefaultsMap>(this.BASE_URL);
    return response.data || {};
  }

  /**
   * Get default values of specific platform
   */
  static async getPlatformDefaults(platform: string): Promise<PlatformDefaults> {
    const response = await apiService.get<{
      platform: string;
      defaults: PlatformDefaults;
    }>(`${this.BASE_URL}/${encodeURIComponent(platform)}`);
    return response.data?.defaults || {};
  }

  /**
   * Set default values of specific platform
   */
  static async setPlatformDefaults(platform: string, defaults: PlatformDefaults): Promise<void> {
    await apiService.put(`${this.BASE_URL}/${encodeURIComponent(platform)}`, defaults);
  }

  /**
   * Bulk set default values of all platforms
   */
  static async setAllDefaults(defaultsMap: PlatformDefaultsMap): Promise<void> {
    await apiService.put(this.BASE_URL, defaultsMap);
  }

  /**
   * Delete default values of specific platform
   */
  static async deletePlatformDefaults(platform: string): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/${encodeURIComponent(platform)}`);
  }

  /**
   * Apply default values to client version data
   */
  static applyDefaultsToClientVersion(
    platform: string,
    defaults: PlatformDefaults,
    clientVersionData: any
  ): any {
    return {
      ...clientVersionData,
      gameServerAddress: clientVersionData.gameServerAddress || defaults.gameServerAddress || '',
      patchAddress: clientVersionData.patchAddress || defaults.patchAddress || '',
    };
  }

  /**
   * Apply default values to platform data for quick add
   */
  static applyDefaultsToPlatformData(
    platform: string,
    defaults: PlatformDefaults,
    platformData: any
  ): any {
    return {
      ...platformData,
      gameServerAddress: platformData.gameServerAddress || defaults.gameServerAddress || '',
      patchAddress: platformData.patchAddress || defaults.patchAddress || '',
    };
  }
}
