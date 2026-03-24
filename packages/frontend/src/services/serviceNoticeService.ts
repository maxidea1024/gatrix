import api from './api';
import {
  MutationResult,
  parseChangeRequestResponse,
} from './changeRequestUtils';

export interface ServiceNotice {
  id: number;
  isActive: boolean;
  isPinned: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  channels?: string[];
  subchannels?: string[];
  startDate: string | null;
  endDate: string | null;
  tabTitle?: string | null;
  title: string;
  content: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: any[];
}

export interface CreateServiceNoticeData {
  isActive: boolean;
  isPinned?: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  channels?: string[] | null;
  subchannels?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
  tabTitle?: string | null;
  title: string;
  content: string;
  description?: string | null;
  tags?: any[];
}

export interface UpdateServiceNoticeData extends Partial<CreateServiceNoticeData> {}

export interface ServiceNoticeFilters {
  isActive?: boolean;
  currentlyVisible?: boolean;
  category?: string;
  platform?: string | string[];
  platformOperator?: 'any_of' | 'include_all';
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ServiceNoticesResponse {
  notices: ServiceNotice[];
  total: number;
}

export type ServiceNoticeMutationResult = MutationResult<ServiceNotice>;

class ServiceNoticeService {
  /**
   * Get service notices with pagination and filters
   */
  async getServiceNotices(
    projectApiPath: string,
    page: number = 1,
    limit: number = 10,
    filters: ServiceNoticeFilters = {}
  ): Promise<ServiceNoticesResponse> {
    const params: any = { page, limit };

    if (filters.isActive !== undefined) {
      params.isActive = filters.isActive;
    }
    if (filters.currentlyVisible !== undefined) {
      params.currentlyVisible = filters.currentlyVisible;
    }
    if (filters.category) {
      params.category = filters.category;
    }
    if (filters.platform) {
      // Send as comma-separated string if array
      params.platform = Array.isArray(filters.platform)
        ? filters.platform.join(',')
        : filters.platform;
    }
    if (filters.platformOperator) {
      params.platformOperator = filters.platformOperator;
    }
    if (filters.search) {
      params.search = filters.search;
    }
    if (filters.sortBy) {
      params.sortBy = filters.sortBy;
    }
    if (filters.sortOrder) {
      params.sortOrder = filters.sortOrder;
    }

    const response = await api.get(`${projectApiPath}/service-notices`, {
      params,
    });
    return response.data;
  }

  /**
   * Get service notice by ID
   */
  async getServiceNoticeById(
    projectApiPath: string,
    id: number
  ): Promise<ServiceNotice> {
    const response = await api.get(`${projectApiPath}/service-notices/${id}`);
    return response.data.notice;
  }

  /**
   * Create service notice
   */
  async createServiceNotice(
    projectApiPath: string,
    data: CreateServiceNoticeData
  ): Promise<ServiceNoticeMutationResult> {
    const response = await api.post(`${projectApiPath}/service-notices`, data);
    return parseChangeRequestResponse<ServiceNotice>(
      response,
      (r) => r?.notice
    );
  }

  /**
   * Update service notice
   */
  async updateServiceNotice(
    projectApiPath: string,
    id: number,
    data: UpdateServiceNoticeData
  ): Promise<ServiceNoticeMutationResult> {
    const response = await api.put(
      `${projectApiPath}/service-notices/${id}`,
      data
    );
    return parseChangeRequestResponse<ServiceNotice>(
      response,
      (r) => r?.notice
    );
  }

  /**
   * Delete service notice
   */
  async deleteServiceNotice(
    projectApiPath: string,
    id: number
  ): Promise<MutationResult<void>> {
    const response = await api.delete(
      `${projectApiPath}/service-notices/${id}`
    );
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Delete multiple service notices
   */
  async deleteMultipleServiceNotices(
    projectApiPath: string,
    ids: number[]
  ): Promise<MutationResult<void>> {
    const response = await api.post(
      `${projectApiPath}/service-notices/bulk-delete`,
      {
        ids,
      }
    );
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Toggle active status
   */
  async toggleActive(
    projectApiPath: string,
    id: number
  ): Promise<ServiceNoticeMutationResult> {
    const response = await api.patch(
      `${projectApiPath}/service-notices/${id}/toggle-active`
    );
    return parseChangeRequestResponse<ServiceNotice>(
      response,
      (r) => r?.notice
    );
  }
}

export default new ServiceNoticeService();
