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
  private static basePath(projectApiPath: string): string {
    return `${projectApiPath}/platform-defaults`;
  }

  /**
   * Get default values of all platforms
   */
  static async getAllDefaults(projectApiPath: string): Promise<PlatformDefaultsMap> {
    const response = await apiService.get<PlatformDefaultsMap>(this.basePath(projectApiPath));
    return response.data || {};
  }

  /**
   * Get default values of specific platform
   */
  static async getPlatformDefaults(
    projectApiPath: string,
    platform: string
  ): Promise<PlatformDefaults> {
    const response = await apiService.get<{
      platform: string;
      defaults: PlatformDefaults;
    }>(`${this.basePath(projectApiPath)}/${encodeURIComponent(platform)}`);
    return response.data?.defaults || {};
  }

  /**
   * Set default values of specific platform
   */
  static async setPlatformDefaults(
    projectApiPath: string,
    platform: string,
    defaults: PlatformDefaults
  ): Promise<void> {
    await apiService.put(
      `${this.basePath(projectApiPath)}/${encodeURIComponent(platform)}`,
      defaults
    );
  }

  /**
   * Bulk set default values of all platforms
   */
  static async setAllDefaults(
    projectApiPath: string,
    defaultsMap: PlatformDefaultsMap
  ): Promise<void> {
    await apiService.put(this.basePath(projectApiPath), defaultsMap);
  }

  /**
   * Delete default values of specific platform
   */
  static async deletePlatformDefaults(projectApiPath: string, platform: string): Promise<void> {
    await apiService.delete(`${this.basePath(projectApiPath)}/${encodeURIComponent(platform)}`);
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
