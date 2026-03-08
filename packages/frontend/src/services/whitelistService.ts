import { apiService } from './api';
import { prodLogger } from '../utils/logger';

export interface Whitelist {
  id: number;
  accountId: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  isEnabled: boolean;
  tags?: string[];
  createdBy: number;
  updatedBy?: number;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhitelistData {
  accountId: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  isEnabled?: boolean;
  tags?: string[];
}

export interface UpdateWhitelistData {
  accountId?: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  isEnabled?: boolean;
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
    const validPage =
      typeof page === 'number' && !isNaN(page) && page > 0 ? page : 1;
    const validLimit =
      typeof limit === 'number' && !isNaN(limit) && limit > 0 ? limit : 10;

    const params = new URLSearchParams({
      page: validPage.toString(),
      limit: validLimit.toString(),
      // Add timestamp to prevent caching (dev environment)
      _t: Date.now().toString(),
    });

    if (filters.accountId) params.append('accountId', filters.accountId);
    if (filters.ipAddress) params.append('ipAddress', filters.ipAddress);
    if (filters.createdBy)
      params.append('createdBy', filters.createdBy.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach((tag) => params.append('tags', tag));
    }

    const response = await apiService.get<any>(`/admin/whitelist?${params}`);

    // ApiService.request() already returns response.data
    if (response?.success && response?.data) {
      return response.data;
    }

    // Return default value if response is invalid
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
    const response = await apiService.get<any>(`/admin/whitelist/${id}`);

    // ApiService.request() already returns response.data
    if (response?.success && response?.data?.whitelist) {
      return response.data.whitelist;
    } else if ((response as any)?.whitelist) {
      return (response as any).whitelist;
    }

    console.error('Unexpected getById response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async createWhitelist(data: CreateWhitelistData): Promise<Whitelist> {
    const response = await apiService.post<any>('/admin/whitelist', data);

    console.log('Create whitelist response:', response);
    console.log('Response structure:', JSON.stringify(response, null, 2));

    // ApiService.request() already returns response.data
    // response is the { success: true, data: { whitelist: ... }, message: ... } structure sent from backend
    if (response?.success && response?.data?.whitelist) {
      return response.data.whitelist;
    } else if ((response as any)?.whitelist) {
      // In case of different structure
      console.log('Using direct whitelist response structure');
      return (response as any).whitelist;
    }

    console.error('Unexpected response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async updateWhitelist(
    id: number,
    data: UpdateWhitelistData
  ): Promise<Whitelist> {
    const response = await apiService.put<any>(`/admin/whitelist/${id}`, data);

    console.log('Update whitelist response:', response);

    // ApiService.request() already returns response.data
    if (response?.success && response?.data?.whitelist) {
      return response.data.whitelist;
    } else if ((response as any)?.whitelist) {
      console.log('Using direct whitelist response structure for update');
      return (response as any).whitelist;
    }

    console.error('Unexpected update response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async deleteWhitelist(id: number): Promise<void> {
    await apiService.delete(`/admin/whitelist/${id}`);
  }

  static async toggleWhitelistStatus(id: number): Promise<Whitelist> {
    const response = await apiService.patch<any>(
      `/admin/whitelist/${id}/toggle`
    );

    if (response?.success && response?.data) {
      return response.data;
    }

    throw new Error('Failed to toggle whitelist status');
  }

  static async bulkCreateWhitelists(
    entries: BulkCreateEntry[]
  ): Promise<{ createdCount: number; requestedCount: number }> {
    const response = await apiService.post<any>('/admin/whitelist/bulk', {
      entries,
    });

    // ApiService.request() already returns response.data
    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected bulkCreate response structure:', response);
    throw new Error('Invalid response structure from server');
  }

  static async testWhitelist(
    request: WhitelistTestRequest
  ): Promise<WhitelistTestResult> {
    const response = await apiService.post<any>(
      '/admin/whitelist/test',
      request
    );

    if (response?.success && response?.data) {
      return response.data;
    }

    console.error('Unexpected test response structure:', response);
    throw new Error('Invalid response structure from server');
  }
}
