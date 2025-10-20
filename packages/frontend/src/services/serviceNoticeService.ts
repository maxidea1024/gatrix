import api from './api';

export interface ServiceNotice {
  id: number;
  isActive: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  startDate: string;
  endDate: string;
  tabTitle?: string;
  title: string;
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceNoticeData {
  isActive: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  startDate: string;
  endDate: string;
  tabTitle?: string;
  title: string;
  content: string;
  description?: string;
}

export interface UpdateServiceNoticeData extends Partial<CreateServiceNoticeData> {}

export interface ServiceNoticeFilters {
  isActive?: boolean;
  category?: string;
  platform?: string;
  search?: string;
}

export interface ServiceNoticesResponse {
  notices: ServiceNotice[];
  total: number;
}

class ServiceNoticeService {
  /**
   * Get service notices with pagination and filters
   */
  async getServiceNotices(
    page: number = 1,
    limit: number = 10,
    filters: ServiceNoticeFilters = {}
  ): Promise<ServiceNoticesResponse> {
    const params: any = { page, limit };
    
    if (filters.isActive !== undefined) {
      params.isActive = filters.isActive;
    }
    if (filters.category) {
      params.category = filters.category;
    }
    if (filters.platform) {
      params.platform = filters.platform;
    }
    if (filters.search) {
      params.search = filters.search;
    }

    const response = await api.get('/admin/service-notices', { params });
    return response.data.data;
  }

  /**
   * Get service notice by ID
   */
  async getServiceNoticeById(id: number): Promise<ServiceNotice> {
    const response = await api.get(`/admin/service-notices/${id}`);
    return response.data.data.notice;
  }

  /**
   * Create service notice
   */
  async createServiceNotice(data: CreateServiceNoticeData): Promise<ServiceNotice> {
    const response = await api.post('/admin/service-notices', data);
    return response.data.data.notice;
  }

  /**
   * Update service notice
   */
  async updateServiceNotice(id: number, data: UpdateServiceNoticeData): Promise<ServiceNotice> {
    const response = await api.put(`/admin/service-notices/${id}`, data);
    return response.data.data.notice;
  }

  /**
   * Delete service notice
   */
  async deleteServiceNotice(id: number): Promise<void> {
    await api.delete(`/admin/service-notices/${id}`);
  }

  /**
   * Delete multiple service notices
   */
  async deleteMultipleServiceNotices(ids: number[]): Promise<void> {
    await api.post('/admin/service-notices/bulk-delete', { ids });
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number): Promise<ServiceNotice> {
    const response = await api.patch(`/admin/service-notices/${id}/toggle-active`);
    return response.data.data.notice;
  }
}

export default new ServiceNoticeService();

