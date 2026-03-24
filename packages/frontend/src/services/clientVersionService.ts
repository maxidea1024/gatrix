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

// Extended response type to indicate if change request was created
export interface ClientVersionMutationResult {
  clientVersion?: ClientVersion;
  isChangeRequest: boolean;
  changeRequestId?: string;
}

export class ClientVersionService {
  private static basePath(projectApiPath: string): string {
    return `${projectApiPath}/client-versions`;
  }

  /**
   * Get list of available versions
   */
  static async getAvailableVersions(projectApiPath: string): Promise<string[]> {
    try {
      const response = await apiService.get(
        `${this.basePath(projectApiPath)}/meta/versions`
      );
      // apiService.get() already returns response.data, so response.data is the actual data
      return response.data || [];
    } catch (error) {
      console.error('Error getting available versions:', error);
      throw error;
    }
  }

  /**
   * Get list of client versions
   */
  static async getClientVersions(
    projectApiPath: string,
    page: number = 1,
    limit: number = CLIENT_VERSION_DEFAULTS.PAGE_SIZE,
    filters: ClientVersionFilters = {},
    sortBy: string = CLIENT_VERSION_DEFAULTS.SORT_BY,
    sortOrder: string = CLIENT_VERSION_DEFAULTS.SORT_ORDER
  ): Promise<any> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    // Add filter conditions
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      // Tags are expected as an array type by backend, so must be serialized as array parameters
      if (key === 'tags') {
        if (Array.isArray(value)) {
          value.forEach((item) => params.append('tags[]', item.toString()));
        } else if (typeof value === 'string') {
          // Also supports comma-separated string: "1,2,3" -> tags[]=1&tags[]=2&tags[]=3
          const parts = value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
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

      // If array, add each element individually
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, item.toString()));
      } else {
        params.append(key, value.toString());
      }
    });

    const response = await apiService.get<any>(
      `${this.basePath(projectApiPath)}?${params}`
    );

    // ApiService.request() already returns response.data
    // response is the { success: true, data: {...} } structure sent from backend
    if (response?.success && response?.data) {
      return response.data;
    } else if ((response as any)?.clientVersions) {
      // In case of different structure
      return response;
    }

    // Return default value if response is invalid or data is missing
    return {
      clientVersions: [],
      total: 0,
      page: page,
      limit: limit,
      totalPages: 0,
    };
  }

  /**
   * Get client version details
   */
  static async getClientVersionById(
    projectApiPath: string,
    id: number
  ): Promise<ClientVersion> {
    const response = await apiService.get<any>(
      `${this.basePath(projectApiPath)}/${id}`
    );

    // ApiService.request() already returns response.data
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected getById response structure:', response);
    return null as any;
  }

  /**
   * Create client version
   */
  static async createClientVersion(
    projectApiPath: string,
    data: ClientVersionFormData
  ): Promise<ClientVersionMutationResult> {
    const response: any = await apiService.post<any>(
      this.basePath(projectApiPath),
      data
    );

    // Check if this is a change request response
    // Backend returns: { success: true, data: { changeRequestId: "...", status: "DRAFT_SAVED" } }
    if (response?.data?.changeRequestId || response?.changeRequestId) {
      return {
        clientVersion: undefined,
        isChangeRequest: true,
        changeRequestId:
          response?.data?.changeRequestId || response?.changeRequestId,
      };
    }

    // Normal creation: { success: true, data: { ...created client version } }
    if (response?.success && response?.data && response.data.id) {
      return {
        clientVersion: response.data,
        isChangeRequest: false,
      };
    }

    // Some servers may return only { success: true } without body upon creation
    if (response?.success && !response?.data) {
      try {
        const found = await this.findByPlatformAndVersion(
          projectApiPath,
          data.platform,
          data.clientVersion
        );
        if (found) {
          return {
            clientVersion: found,
            isChangeRequest: false,
          };
        }
      } catch (e) {
        console.warn('Fallback lookup after create failed:', e);
      }
    }

    console.error('Unexpected create response structure:', response);
    throw new Error('Invalid response structure from server');
  }
  /**
   * Handle servers missing data body immediately after creation: re-fetch by platform/version
   */
  static async findByPlatformAndVersion(
    projectApiPath: string,
    platform: string,
    clientVersion: string
  ): Promise<ClientVersion | null> {
    try {
      const result = await this.getClientVersions(projectApiPath, 1, 100, {
        platform,
        search: clientVersion,
      });
      const exact = result.clientVersions.find(
        (cv) => cv.platform === platform && cv.clientVersion === clientVersion
      );
      return exact || null;
    } catch (error) {
      console.warn('findByPlatformAndVersion failed:', error);
      return null;
    }
  }

  /**
   * Quick create client version
   */
  static async bulkCreateClientVersions(
    projectApiPath: string,
    data: BulkCreateFormData
  ): Promise<ClientVersion[]> {
    const response = await apiService.post<any>(
      `${this.basePath(projectApiPath)}/bulk`,
      data
    );

    // ApiService.request() already returns response.data
    if (response?.success && response?.data) {
      return response.data;
    }

    // Some servers may return only { success: true } without body
    if (response?.success && !response?.data) {
      return [];
    }

    console.error('Unexpected bulk create response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  /**
   * Update client version
   */
  static async updateClientVersion(
    projectApiPath: string,
    id: number,
    data: Partial<ClientVersionFormData>
  ): Promise<ClientVersionMutationResult> {
    const response: any = await apiService.put<any>(
      `${this.basePath(projectApiPath)}/${id}`,
      data
    );

    // Check if this is a change request response
    // Backend returns: { success: true, data: { changeRequestId: "...", status: "DRAFT_SAVED" } }
    if (response?.data?.changeRequestId || response?.changeRequestId) {
      return {
        clientVersion: undefined,
        isChangeRequest: true,
        changeRequestId:
          response?.data?.changeRequestId || response?.changeRequestId,
      };
    }

    // Normal update: { success: true, data: { ...updated client version } }
    if (response?.success && response?.data && response.data.id) {
      return {
        clientVersion: response.data,
        isChangeRequest: false,
      };
    }

    console.error('Unexpected update response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  /**
   * Delete client version
   */
  static async deleteClientVersion(
    projectApiPath: string,
    id: number
  ): Promise<{ isChangeRequest: boolean; changeRequestId?: string }> {
    const response = await apiService.delete<any>(
      `${this.basePath(projectApiPath)}/${id}`
    );
    const data = (response as any).data;
    // 202 response indicates CR creation
    const isChangeRequest = !!data?.changeRequestId;
    return {
      isChangeRequest,
      changeRequestId: data?.changeRequestId,
    };
  }

  /**
   * Bulk update status
   */
  static async bulkUpdateStatus(
    projectApiPath: string,
    data: BulkStatusUpdateRequest
  ): Promise<{ updatedCount: number; message: string }> {
    const response = await apiService.patch<any>(
      `${this.basePath(projectApiPath)}/bulk-status`,
      data
    );

    console.log('🔍 Bulk update response:', response);

    // ApiService.request() already returns response.data
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected bulk update response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  /**
   * Get list of channels
   */
  static async getPlatforms(projectApiPath: string): Promise<string[]> {
    try {
      const response = await apiService.get<any>(
        `${this.basePath(projectApiPath)}/meta/platforms`
      );
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching platforms:', error);
      return [];
    }
  }

  /**
   * Get metadata (platform)
   */
  static async getMetadata(
    projectApiPath: string
  ): Promise<ClientVersionMetadata> {
    const platforms = await this.getPlatforms(projectApiPath);

    return {
      platforms,
    };
  }

  /**
   * Check for duplicate client version
   */
  static async checkDuplicate(
    projectApiPath: string,
    platform: string,
    clientVersion: string,
    excludeId?: number
  ): Promise<boolean> {
    try {
      const filters: ClientVersionFilters = {
        platform,
        search: clientVersion,
      };

      const result = await this.getClientVersions(
        projectApiPath,
        1,
        100,
        filters
      );

      // Check if exactly matching version exists
      const duplicate = result.clientVersions.find(
        (cv) =>
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
   * Export client versions (CSV)
   */
  static async exportToCSV(
    projectApiPath: string,
    filters: ClientVersionFilters = {}
  ): Promise<Blob> {
    // Use endpoint dedicated for export
    const params: Record<string, any> = {};

    // Add filter
    if (filters.platform) params.platform = filters.platform;
    if (filters.clientStatus) params.clientStatus = filters.clientStatus;
    if (filters.gameServerAddress)
      params.gameServerAddress = filters.gameServerAddress;
    if (filters.patchAddress) params.patchAddress = filters.patchAddress;
    if (filters.search) params.search = filters.search;
    if (filters.guestModeAllowed !== undefined)
      params.guestModeAllowed = filters.guestModeAllowed.toString();
    if (filters.externalClickLink)
      params.externalClickLink = filters.externalClickLink;
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
      const result = await apiService.get(
        `${this.basePath(projectApiPath)}/export`,
        {
          params,
        }
      );

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
        ...result.data.clientVersions.map((cv: any) =>
          [
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
          ].join(',')
        ),
      ].join('\n');

      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    } catch (error: any) {
      console.error('Error exporting client versions:', error);
      throw new Error(error.message || 'Failed to export client versions');
    }
  }

  /**
   * Get page size from local storage
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
   * Save page size to local storage
   */
  static setStoredPageSize(pageSize: number): void {
    try {
      localStorage.setItem('clientVersionPageSize', pageSize.toString());
    } catch (error) {
      console.warn('Failed to save page size to localStorage:', error);
    }
  }

  /**
   * Get filter from local storage
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
   * Save filter to local storage
   */
  static setStoredFilters(filters: ClientVersionFilters): void {
    try {
      localStorage.setItem('clientVersionFilters', JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error);
    }
  }

  /**
   * Get sorting options from local storage
   */
  static getStoredSort(): { sortBy: string; sortOrder: string } {
    try {
      const stored = localStorage.getItem('clientVersionSort');
      return stored
        ? JSON.parse(stored)
        : {
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
   * Save sorting options to local storage
   */
  static setStoredSort(sortBy: string, sortOrder: string): void {
    try {
      localStorage.setItem(
        'clientVersionSort',
        JSON.stringify({ sortBy, sortOrder })
      );
    } catch (error) {
      console.warn('Failed to save sort settings to localStorage:', error);
    }
  }

  /**
   * Check if a game server address is reachable by directly calling its /health endpoint
   */
  static async checkAddressHealth(
    _projectApiPath: string,
    address: string
  ): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now();
    try {
      const normalizedAddress = address.replace(/\/+$/, '');
      const healthUrl = `${normalizedAddress}/health`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        return {
          healthy: response.ok,
          latency,
          ...(!response.ok && { error: `HTTP ${response.status}` }),
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        return {
          healthy: false,
          latency: Date.now() - startTime,
          error:
            fetchError.name === 'AbortError'
              ? 'Connection timeout'
              : fetchError.message || 'Connection failed',
        };
      }
    } catch (err: any) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: err.message || 'Unknown error',
      };
    }
  }
}

export default ClientVersionService;
