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
  private static readonly BASE_URL = '/admin/client-versions';

  /**
   * 사용 가능한 버전 목록 조회
   */
  static async getAvailableVersions(): Promise<string[]> {
    try {
      const response = await apiService.get(`${this.BASE_URL}/meta/versions`);
      // apiService.get()이 이미 response.data를 반환하므로 response.data가 실제 데이터
      return response.data || [];
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
    });

    // 필터 조건 추가
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      // 태그는 백엔드에서 배열 타입으로 기대하므로 반드시 배열 파라미터로 직렬화
      if (key === 'tags') {
        if (Array.isArray(value)) {
          value.forEach((item) => params.append('tags[]', item.toString()));
        } else if (typeof value === 'string') {
          // 콤마 구분 문자열도 지원: "1,2,3" -> tags[]=1&tags[]=2&tags[]=3
          const parts = value.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length > 0) {
            parts.forEach((p) => params.append('tags[]', p));
          } else {
            params.append('tags[]', value);
          }
        } else {
          params.append('tags[]', String(value));
        }
        return;
      }

      // 배열인 경우 각 요소를 개별적으로 추가
      if (Array.isArray(value)) {
        value.forEach(item => params.append(key, item.toString()));
      } else {
        params.append(key, value.toString());
      }
    });

    const response = await apiService.get<ApiResponse<ClientVersionListResponse>>(
      `${this.BASE_URL}?${params}`
    );

    // ApiService.request()가 이미 response.data를 반환하므로
    // response는 백엔드에서 보낸 { success: true, data: {...} } 구조
    if (response?.success && response?.data) {
      return response.data;
    } else if (response?.clientVersions) {
      // 혹시 다른 구조일 경우
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

    // 정상: { success: true, data: { ...created } }
    if (response?.success && response?.data) {
      return response.data;
    }

    // 일부 서버는 생성 시 본문 없이 { success: true }만 반환할 수 있음
    if (response?.success && !response?.data) {
      try {
        const found = await this.findByPlatformAndVersion(data.platform, data.clientVersion);
        if (found) return found;
      } catch (e) {
        console.warn('Fallback lookup after create failed:', e);
      }
    }

    console.error('Unexpected create response structure:', response);
    throw new Error('Invalid response structure from server');
  }
  /**
   * 생성 직후 데이터 본문이 없는 서버 대응: 플랫폼/버전으로 재조회
   */
  static async findByPlatformAndVersion(platform: string, clientVersion: string): Promise<ClientVersion | null> {
    try {
      const result = await this.getClientVersions(1, 100, { platform, search: clientVersion });
      const exact = result.clientVersions.find(cv => cv.platform === platform && cv.clientVersion === clientVersion);
      return exact || null;
    } catch (error) {
      console.warn('findByPlatformAndVersion failed:', error);
      return null;
    }
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

    // 일부 서버는 본문 없이 { success: true }만 반환할 수 있음
    if (response?.success && !response?.data) {
      return [];
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
    // 내보내기 전용 엔드포인트 사용
    const params: Record<string, any> = {};

    // 필터 추가
    if (filters.platform) params.platform = filters.platform;
    if (filters.clientStatus) params.clientStatus = filters.clientStatus;
    if (filters.gameServerAddress) params.gameServerAddress = filters.gameServerAddress;
    if (filters.patchAddress) params.patchAddress = filters.patchAddress;
    if (filters.search) params.search = filters.search;
    if (filters.guestModeAllowed !== undefined) params.guestModeAllowed = filters.guestModeAllowed.toString();
    if (filters.externalClickLink) params.externalClickLink = filters.externalClickLink;
    if (filters.memo) params.memo = filters.memo;
    if (filters.customPayload) params.customPayload = filters.customPayload;
    if (filters.createdBy) params.createdBy = filters.createdBy.toString();
    if (filters.updatedBy) params.updatedBy = filters.updatedBy.toString();
    if (filters.createdAtFrom) params.createdAtFrom = filters.createdAtFrom;
    if (filters.createdAtTo) params.createdAtTo = filters.createdAtTo;
    if (filters.updatedAtFrom) params.updatedAtFrom = filters.updatedAtFrom;
    if (filters.updatedAtTo) params.updatedAtTo = filters.updatedAtTo;
    if (filters.tags && filters.tags.length > 0) params.tags = filters.tags;

    try {
      const result = await apiService.get(`${this.BASE_URL}/export`, { params });

      if (!result.success) {
        throw new Error(result.message || 'Failed to export client versions');
      }

      const headers = [
        'ID',
        'Platform',
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
        'Maintenance Start Date',
        'Maintenance End Date',
        'Maintenance Message',
        'Supports Multi Language',
        'Tags',
        'Created At',
        'Created By',
        'Created By Email',
        'Updated At',
        'Updated By',
        'Updated By Email',
      ];

      const csvContent = [
        headers.join(','),
        ...result.data.clientVersions.map((cv: any) => [
          cv.id,
          `"${cv.platform || ''}"`,
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
          `"${cv.maintenanceStartDate || ''}"`,
          `"${cv.maintenanceEndDate || ''}"`,
          `"${cv.maintenanceMessage || ''}"`,
          cv.supportsMultiLanguage || false,
          `"${cv.tags ? cv.tags.map((tag: any) => tag.name).join('; ') : ''}"`,
          `"${cv.createdAt}"`,
          `"${cv.createdByName || ''}"`,
          `"${cv.createdByEmail || ''}"`,
          `"${cv.updatedAt}"`,
          `"${cv.updatedByName || ''}"`,
          `"${cv.updatedByEmail || ''}"`,
        ].join(','))
      ].join('\n');

      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    } catch (error: any) {
      console.error('Error exporting client versions:', error);
      throw new Error(error.message || 'Failed to export client versions');
    }
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
