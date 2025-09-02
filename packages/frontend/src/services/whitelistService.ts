import { apiService } from './api';
import { prodLogger } from '../utils/logger';

export interface Whitelist {
  id: number;
  accountId: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  tags?: string[];
  createdBy: number;
  createdByName?: string;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CreateWhitelistData {
  accountId: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  tags?: string[];
}

export interface UpdateWhitelistData {
  accountId?: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  tags?: string[];
}

export interface WhitelistFilters {
  accountId?: string;
  ipAddress?: string;
  createdBy?: number;
  search?: string;
  tags?: string[];
}

export interface WhitelistListResponse {
  whitelists: Whitelist[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BulkCreateEntry {
  accountId: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
}

export interface WhitelistTestRequest {
  accountId?: string;
  ipAddress?: string;
}

export interface WhitelistTestResult {
  isAllowed: boolean;
  matchedRules: Array<{
    type: 'account' | 'ip';
    rule: string;
    reason: string;
  }>;
}

export class WhitelistService {
  static async getWhitelists(
    page: number = 1,
    limit: number = 10,
    filters: WhitelistFilters = {}
  ): Promise<WhitelistListResponse> {
    // Ensure page and limit are valid numbers
    const validPage = typeof page === 'number' && !isNaN(page) && page > 0 ? page : 1;
    const validLimit = typeof limit === 'number' && !isNaN(limit) && limit > 0 ? limit : 10;

    const params = new URLSearchParams({
      page: validPage.toString(),
      limit: validLimit.toString(),
      // 캐시 방지를 위한 타임스탬프 추가 (개발 환경)
      _t: Date.now().toString(),
    });

    if (filters.accountId) params.append('accountId', filters.accountId);
    if (filters.ipAddress) params.append('ipAddress', filters.ipAddress);
    if (filters.createdBy) params.append('createdBy', filters.createdBy.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach(tag => params.append('tags', tag));
    }

    const response = await apiService.get<{ success: boolean; data: WhitelistListResponse }>(`/whitelist?${params}`);

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data) {
      return response.data;
    }

    // 응답이 올바르지 않은 경우 기본값 반환
    prodLogger.warn('Unexpected getWhitelists response structure:', response);
    return {
      whitelists: [],
      total: 0,
      page: page,
      limit: limit,
      totalPages: 0,
    };
  }

  static async getWhitelistById(id: number): Promise<Whitelist> {
    const response = await apiService.get<{ success: boolean; data: { whitelist: Whitelist } }>(`/whitelist/${id}`);

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data?.whitelist) {
      return response.data.whitelist;
    } else if (response?.whitelist) {
      return response.whitelist;
    }

    console.error('Unexpected getById response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async createWhitelist(data: CreateWhitelistData): Promise<Whitelist> {
    const response = await apiService.post<{ success: boolean; data: { whitelist: Whitelist } }>('/whitelist', data);

    console.log('Create whitelist response:', response);
    console.log('Response structure:', JSON.stringify(response, null, 2));

    // ApiService.request()가 이미 response.data를 반환하므로
    // response는 백엔드에서 보낸 { success: true, data: { whitelist: ... }, message: ... } 구조
    if (response?.success && response?.data?.whitelist) {
      return response.data.whitelist;
    } else if (response?.whitelist) {
      // 혹시 다른 구조일 경우
      console.log('Using direct whitelist response structure');
      return response.whitelist;
    }

    console.error('Unexpected response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async updateWhitelist(id: number, data: UpdateWhitelistData): Promise<Whitelist> {
    const response = await apiService.put<{ success: boolean; data: { whitelist: Whitelist } }>(`/whitelist/${id}`, data);

    console.log('Update whitelist response:', response);

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data?.whitelist) {
      return response.data.whitelist;
    } else if (response?.whitelist) {
      console.log('Using direct whitelist response structure for update');
      return response.whitelist;
    }

    console.error('Unexpected update response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async deleteWhitelist(id: number): Promise<void> {
    await apiService.delete(`/whitelist/${id}`);
  }

  static async bulkCreateWhitelists(entries: BulkCreateEntry[]): Promise<{ createdCount: number; requestedCount: number }> {
    const response = await apiService.post<{ success: boolean; data: { createdCount: number; requestedCount: number } }>('/whitelist/bulk', { entries });

    // ApiService.request()가 이미 response.data를 반환하므로
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected bulkCreate response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async testWhitelist(request: WhitelistTestRequest): Promise<WhitelistTestResult> {
    const response = await apiService.post<{ success: boolean; data: WhitelistTestResult }>('/whitelist/test', request);

    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected test response structure:', response);
    throw new Error('Invalid response structure from server');
  }
}
