import { apiService } from './api';
import {
  ClientVersion,
  ClientVersionFormData,
  BulkCreateFormData,
  ClientVersionFilters,
  ClientVersionListResponse,
  ClientVersionPagination,
  BulkStatusUpdateRequest,
  ClientVersionMetadata,
  ApiResponse,
  CLIENT_VERSION_DEFAULTS,
} from '../types/clientVersion';

export class ClientVersionService {
  private static readonly BASE_URL = '/client-versions';

  /**
   * 사용 가능한 버전 목록 조회
   */
  static async getAvailableVersions(): Promise<string[]> {
    try {
      const response = await apiService.get(`${this.BASE_URL}/meta/versions`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error getting available versions:', error);
      throw error;
    }
  }

  /**
   * 클라이언트 버전 목록 조회
   */
  static async getClientVersions(
    page: number = 1,
    limit: number = CLIENT_VERSION_DEFAULTS.PAGE_SIZE,
    filters: ClientVersionFilters = {},
    sortBy: string = CLIENT_VERSION_DEFAULTS.SORT_BY,
    sortOrder: string = CLIENT_VERSION_DEFAULTS.SORT_ORDER
  ): Promise<ClientVersionListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
      _t: Date.now().toString(), // 캐시 방지
    });

    // 필터 조건 추가
    console.log('Processing filters:', filters);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        console.log(`Adding filter: ${key} = ${value} (${typeof value})`);
        params.append(key, value.toString());
      }
    });
    console.log('Final URL params:', params.toString());

    const response = await apiService.get<ApiResponse<ClientVersionListResponse>>(
      `${this.BASE_URL}?${params}`
    );

    console.log('getClientVersions response:', response);
    console.log('Response type:', typeof response);
    console.log('Response keys:', Object.keys(response || {}));
    if (response?.data) {
      console.log('Response.data type:', typeof response.data);
      console.log('Response.data keys:', Object.keys(response.data || {}));
      console.log('Response.data.clientVersions length:', response.data.clientVersions?.length);
    }

    // ApiService.request()가 이미 response.data를 반환하므로
    // response는 백엔드에서 보낸 { success: true, data: {...} } 구조
    if (response?.success && response?.data) {
      console.log('Using standard response structure');
      console.log('Returning data:', response.data);
      return response.data;
    } else if (response?.clientVersions) {
      // 혹시 다른 구조일 경우
      console.log('Using direct clientVersions response structure');
      return response;
    }

    // 응답이 올바르지 않거나 데이터가 없는 경우 기본값 반환
    return {
      clientVersions: [],
      total: 0,
      page: page,
      limit: limit,
      totalPages: 0,
    };
  }

  /**
   * 클라이언트 버전 상세 조회
   */
  static async getClientVersionById(id: number): Promise<ClientVersion> {
    const response = await apiService.get<ApiResponse<ClientVersion>>(
      `${this.BASE_URL}/${id}`
    );

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected getById response structure:', response);
    return null;
  }

  /**
   * 클라이언트 버전 생성
   */
  static async createClientVersion(data: ClientVersionFormData): Promise<ClientVersion> {
    const response = await apiService.post<ApiResponse<ClientVersion>>(
      this.BASE_URL,
      data
    );

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected create response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  /**
   * 클라이언트 버전 간편 생성
   */
  static async bulkCreateClientVersions(data: BulkCreateFormData): Promise<ClientVersion[]> {
    const response = await apiService.post<ApiResponse<ClientVersion[]>>(
      `${this.BASE_URL}/bulk`,
      data
    );

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected bulk create response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  /**
   * 클라이언트 버전 수정
   */
  static async updateClientVersion(
    id: number,
    data: Partial<ClientVersionFormData>
  ): Promise<ClientVersion> {
    const response = await apiService.put<ApiResponse<ClientVersion>>(
      `${this.BASE_URL}/${id}`,
      data
    );

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected update response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  /**
   * 클라이언트 버전 삭제
   */
  static async deleteClientVersion(id: number): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/${id}`);
  }

  /**
   * 일괄 상태 변경
   */
  static async bulkUpdateStatus(data: BulkStatusUpdateRequest): Promise<{ updatedCount: number; message: string }> {
    const response = await apiService.patch<ApiResponse<{ updatedCount: number; message: string }>>(
      `${this.BASE_URL}/bulk-status`,
      data
    );

    console.log('🔍 Bulk update response:', response);

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected bulk update response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  /**
   * 채널 목록 조회
   */
  static async getPlatforms(): Promise<string[]> {
    try {
      const response = await apiService.get<ApiResponse<string[]>>(
        `${this.BASE_URL}/meta/platforms`
      );
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching platforms:', error);
      return [];
    }
  }

  /**
   * 메타데이터 조회 (플랫폼)
   */
  static async getMetadata(): Promise<ClientVersionMetadata> {
    const platforms = await this.getPlatforms();

    return {
      platforms,
    };
  }

  /**
   * 클라이언트 버전 중복 검사
   */
  static async checkDuplicate(
    platform: string,
    clientVersion: string,
    excludeId?: number
  ): Promise<boolean> {
    try {
      const filters: ClientVersionFilters = {
        platform,
        search: clientVersion,
      };

      const result = await this.getClientVersions(1, 100, filters);

      // 정확히 일치하는 버전이 있는지 확인
      const duplicate = result.clientVersions.find(cv =>
        cv.platform === platform &&
        cv.clientVersion === clientVersion &&
        cv.id !== excludeId
      );

      return !!duplicate;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return false;
    }
  }

  /**
   * 클라이언트 버전 내보내기 (CSV)
   */
  static async exportToCSV(filters: ClientVersionFilters = {}): Promise<Blob> {
    // 모든 데이터를 가져와서 CSV로 변환
    const result = await this.getClientVersions(1, 10000, filters);
    
    const headers = [
      'ID',
      'Channel',
      'Sub Channel',
      'Client Version',
      'Status',
      'Game Server Address',
      'Game Server Address (Whitelist)',
      'Patch Address',
      'Patch Address (Whitelist)',
      'Guest Mode Allowed',
      'External Click Link',
      'Memo',
      'Custom Payload',
      'Created At',
      'Created By',
      'Updated At',
      'Updated By',
    ];

    const csvContent = [
      headers.join(','),
      ...result.clientVersions.map(cv => [
        cv.id,
        `"${cv.channel}"`,
        `"${cv.subChannel}"`,
        `"${cv.clientVersion}"`,
        `"${cv.clientStatus}"`,
        `"${cv.gameServerAddress}"`,
        `"${cv.gameServerAddressForWhiteList || ''}"`,
        `"${cv.patchAddress}"`,
        `"${cv.patchAddressForWhiteList || ''}"`,
        cv.guestModeAllowed,
        `"${cv.externalClickLink || ''}"`,
        `"${cv.memo || ''}"`,
        `"${cv.customPayload || ''}"`,
        `"${cv.createdAt}"`,
        `"${cv.createdByName || ''}"`,
        `"${cv.updatedAt}"`,
        `"${cv.updatedByName || ''}"`,
      ].join(','))
    ].join('\n');

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * 로컬 스토리지에서 페이지 크기 가져오기
   */
  static getStoredPageSize(): number {
    try {
      const stored = localStorage.getItem('clientVersionPageSize');
      return stored ? parseInt(stored, 10) : CLIENT_VERSION_DEFAULTS.PAGE_SIZE;
    } catch {
      return CLIENT_VERSION_DEFAULTS.PAGE_SIZE;
    }
  }

  /**
   * 로컬 스토리지에 페이지 크기 저장
   */
  static setStoredPageSize(pageSize: number): void {
    try {
      localStorage.setItem('clientVersionPageSize', pageSize.toString());
    } catch (error) {
      console.warn('Failed to save page size to localStorage:', error);
    }
  }

  /**
   * 로컬 스토리지에서 필터 가져오기
   */
  static getStoredFilters(): ClientVersionFilters {
    try {
      const stored = localStorage.getItem('clientVersionFilters');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * 로컬 스토리지에 필터 저장
   */
  static setStoredFilters(filters: ClientVersionFilters): void {
    try {
      localStorage.setItem('clientVersionFilters', JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error);
    }
  }

  /**
   * 로컬 스토리지에서 정렬 설정 가져오기
   */
  static getStoredSort(): { sortBy: string; sortOrder: string } {
    try {
      const stored = localStorage.getItem('clientVersionSort');
      return stored ? JSON.parse(stored) : {
        sortBy: CLIENT_VERSION_DEFAULTS.SORT_BY,
        sortOrder: CLIENT_VERSION_DEFAULTS.SORT_ORDER,
      };
    } catch {
      return {
        sortBy: CLIENT_VERSION_DEFAULTS.SORT_BY,
        sortOrder: CLIENT_VERSION_DEFAULTS.SORT_ORDER,
      };
    }
  }

  /**
   * 로컬 스토리지에 정렬 설정 저장
   */
  static setStoredSort(sortBy: string, sortOrder: string): void {
    try {
      localStorage.setItem('clientVersionSort', JSON.stringify({ sortBy, sortOrder }));
    } catch (error) {
      console.warn('Failed to save sort settings to localStorage:', error);
    }
  }

  /**
   * 클라이언트 버전 태그 조회
   */
  static async getTags(id: number): Promise<any[]> {
    const response = await apiService.get<ApiResponse<any[]>>(`${this.BASE_URL}/${id}/tags`);
    return response.data.data || [];
  }

  /**
   * 클라이언트 버전 태그 설정
   */
  static async setTags(id: number, tagIds: number[]): Promise<void> {
    await apiService.put(`${this.BASE_URL}/${id}/tags`, { tagIds });
  }
}

export default ClientVersionService;
