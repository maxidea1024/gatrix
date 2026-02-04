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
   * 모든 플랫폼의 기본값 조회
   */
  static async getAllDefaults(): Promise<PlatformDefaultsMap> {
    const response = await apiService.get<PlatformDefaultsMap>(this.BASE_URL);
    return response.data || {};
  }

  /**
   * 특정 플랫폼의 기본값 조회
   */
  static async getPlatformDefaults(platform: string): Promise<PlatformDefaults> {
    const response = await apiService.get<{
      platform: string;
      defaults: PlatformDefaults;
    }>(`${this.BASE_URL}/${encodeURIComponent(platform)}`);
    return response.data?.defaults || {};
  }

  /**
   * 특정 플랫폼의 기본값 설정
   */
  static async setPlatformDefaults(platform: string, defaults: PlatformDefaults): Promise<void> {
    await apiService.put(`${this.BASE_URL}/${encodeURIComponent(platform)}`, defaults);
  }

  /**
   * 모든 플랫폼의 기본값 일괄 설정
   */
  static async setAllDefaults(defaultsMap: PlatformDefaultsMap): Promise<void> {
    await apiService.put(this.BASE_URL, defaultsMap);
  }

  /**
   * 특정 플랫폼의 기본값 삭제
   */
  static async deletePlatformDefaults(platform: string): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/${encodeURIComponent(platform)}`);
  }

  /**
   * 클라이언트 버전 데이터에 기본값 적용
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
   * 간편 추가용 플랫폼 데이터에 기본값 적용
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
