import api from './api';

export interface IngamePopupNotice {
  id: number;
  isActive: boolean;
  content: string;
  targetWorlds: string[] | null;
  targetWorldsInverted?: boolean;
  targetPlatforms: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetUserIds: string | null;
  targetUserIdsInverted?: boolean;
  displayPriority: number;
  showOnce: boolean;
  startDate?: string | null;
  endDate: string;
  messageTemplateId: number | null;
  useTemplate: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  updatedBy: number | null;
}

export interface CreateIngamePopupNoticeData {
  isActive: boolean;
  content: string;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels?: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetUserIds?: string | null;
  targetUserIdsInverted?: boolean;
  displayPriority?: number;
  showOnce?: boolean;
  startDate?: string | null;
  endDate: string;
  messageTemplateId?: number | null;
  useTemplate?: boolean;
  description?: string | null;
}

export interface UpdateIngamePopupNoticeData extends Partial<CreateIngamePopupNoticeData> {}

export interface IngamePopupNoticeFilters {
  isActive?: boolean;
  currentlyVisible?: boolean;
  world?: string;
  market?: string;
  platform?: string | string[];
  platformOperator?: 'any_of' | 'include_all';
  clientVersion?: string;
  accountId?: string;
  search?: string;
}

export interface IngamePopupNoticesResponse {
  notices: IngamePopupNotice[];
  total: number;
}

class IngamePopupNoticeService {
  /**
   * Get ingame popup notices with pagination and filters
   */
  async getIngamePopupNotices(
    page: number = 1,
    limit: number = 10,
    filters: IngamePopupNoticeFilters = {}
  ): Promise<IngamePopupNoticesResponse> {
    const params: any = { page, limit };

    if (filters.isActive !== undefined) {
      params.isActive = filters.isActive;
    }
    if (filters.currentlyVisible !== undefined) {
      params.currentlyVisible = filters.currentlyVisible;
    }
    if (filters.world) {
      params.world = filters.world;
    }
    if (filters.market) {
      params.market = filters.market;
    }
    if (filters.platform) {
      params.platform = Array.isArray(filters.platform) ? filters.platform.join(',') : filters.platform;
    }
    if (filters.platformOperator) {
      params.platformOperator = filters.platformOperator;
    }
    if (filters.clientVersion) {
      params.clientVersion = filters.clientVersion;
    }
    if (filters.accountId) {
      params.accountId = filters.accountId;
    }
    if (filters.search) {
      params.search = filters.search;
    }

    const response = await api.get('/admin/ingame-popup-notices', { params });
    return response;
  }

  /**
   * Get ingame popup notice by ID
   */
  async getIngamePopupNoticeById(id: number): Promise<IngamePopupNotice> {
    const response = await api.get(`/admin/ingame-popup-notices/${id}`);
    return response.notice;
  }

  /**
   * Create ingame popup notice
   */
  async createIngamePopupNotice(data: CreateIngamePopupNoticeData): Promise<IngamePopupNotice> {
    const response = await api.post('/admin/ingame-popup-notices', data);
    return response.notice;
  }

  /**
   * Update ingame popup notice
   */
  async updateIngamePopupNotice(id: number, data: UpdateIngamePopupNoticeData): Promise<IngamePopupNotice> {
    const response = await api.put(`/admin/ingame-popup-notices/${id}`, data);
    return response.notice;
  }

  /**
   * Delete ingame popup notice
   */
  async deleteIngamePopupNotice(id: number): Promise<void> {
    await api.delete(`/admin/ingame-popup-notices/${id}`);
  }

  /**
   * Delete multiple ingame popup notices
   */
  async deleteMultipleIngamePopupNotices(ids: number[]): Promise<void> {
    await api.post('/admin/ingame-popup-notices/bulk-delete', { ids });
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number): Promise<IngamePopupNotice> {
    const response = await api.patch(`/admin/ingame-popup-notices/${id}/toggle-active`);
    return response.notice;
  }
}

export default new IngamePopupNoticeService();

