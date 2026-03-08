import api from './api';
import {
  MutationResult,
  parseChangeRequestResponse,
} from './changeRequestUtils';

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
  endDate?: string | null;
  messageTemplateId: number | null;
  useTemplate: boolean;
  description: string | null;
  targetMarkets?: string[] | null;
  targetClientVersions?: string[] | null;
  targetAccountIds?: string[] | null;
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
  endDate?: string | null;
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

export type IngamePopupNoticeMutationResult = MutationResult<IngamePopupNotice>;

class IngamePopupNoticeService {
  /**
   * Get ingame popup notices with pagination and filters
   */
  async getIngamePopupNotices(
    projectApiPath: string,
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
      params.platform = Array.isArray(filters.platform)
        ? filters.platform.join(',')
        : filters.platform;
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

    const response = await api.get(`${projectApiPath}/ingame-popup-notices`, {
      params,
    });
    return response.data;
  }

  /**
   * Get ingame popup notice by ID
   */
  async getIngamePopupNoticeById(
    projectApiPath: string,
    id: number
  ): Promise<IngamePopupNotice> {
    const response = await api.get(
      `${projectApiPath}/ingame-popup-notices/${id}`
    );
    return response.data.notice;
  }

  /**
   * Create ingame popup notice
   */
  async createIngamePopupNotice(
    projectApiPath: string,
    data: CreateIngamePopupNoticeData
  ): Promise<IngamePopupNoticeMutationResult> {
    const response = await api.post(
      `${projectApiPath}/ingame-popup-notices`,
      data
    );
    return parseChangeRequestResponse<IngamePopupNotice>(
      response,
      (r) => r?.notice
    );
  }

  /**
   * Update ingame popup notice
   */
  async updateIngamePopupNotice(
    projectApiPath: string,
    id: number,
    data: UpdateIngamePopupNoticeData
  ): Promise<IngamePopupNoticeMutationResult> {
    const response = await api.put(
      `${projectApiPath}/ingame-popup-notices/${id}`,
      data
    );
    return parseChangeRequestResponse<IngamePopupNotice>(
      response,
      (r) => r?.notice
    );
  }

  /**
   * Delete ingame popup notice
   */
  async deleteIngamePopupNotice(
    projectApiPath: string,
    id: number
  ): Promise<MutationResult<void>> {
    const response = await api.delete(
      `${projectApiPath}/ingame-popup-notices/${id}`
    );
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Delete multiple ingame popup notices
   */
  async deleteMultipleIngamePopupNotices(
    projectApiPath: string,
    ids: number[]
  ): Promise<MutationResult<void>> {
    const response = await api.post(
      `${projectApiPath}/ingame-popup-notices/bulk-delete`,
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
  ): Promise<IngamePopupNoticeMutationResult> {
    const response = await api.patch(
      `${projectApiPath}/ingame-popup-notices/${id}/toggle-active`
    );
    return parseChangeRequestResponse<IngamePopupNotice>(
      response,
      (r) => r?.notice
    );
  }
}

export default new IngamePopupNoticeService();
