import api from './api';

// ==================== Types ====================

export interface SpreadsheetListItem {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  isPinned: boolean;
  version: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
  updatedByName?: string | null;
}

export interface SpreadsheetDetail extends SpreadsheetListItem {
  sheetData: string;
}

export interface SpreadsheetListResponse {
  items: SpreadsheetListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'updatedAt' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// ==================== Service ====================

class SpreadsheetService {
  private basePath = '/admin/spreadsheets';

  async list(params: ListParams = {}): Promise<SpreadsheetListResponse> {
    const response = await api.get(this.basePath, { params });
    return response.data;
  }

  async getById(id: string): Promise<SpreadsheetDetail> {
    const response = await api.get(`${this.basePath}/${id}`);
    return response.data;
  }

  async create(data?: {
    title?: string;
    description?: string;
    sheetData?: string;
  }): Promise<SpreadsheetDetail> {
    const response = await api.post(this.basePath, data || {});
    return response.data;
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      sheetData?: string;
      thumbnail?: string;
      isPinned?: boolean;
      expectedVersion?: number;
    }
  ): Promise<SpreadsheetDetail> {
    const response = await api.put(`${this.basePath}/${id}`, data);
    return response.data;
  }

  async updateMeta(
    id: string,
    data: {
      title?: string;
      description?: string;
      isPinned?: boolean;
    }
  ): Promise<SpreadsheetDetail> {
    const response = await api.patch(`${this.basePath}/${id}/meta`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.basePath}/${id}`);
  }

  async duplicate(id: string): Promise<SpreadsheetDetail> {
    const response = await api.post(`${this.basePath}/${id}/duplicate`);
    return response.data;
  }

  // ==================== Sharing ====================

  async listShares(id: string): Promise<SpreadsheetShare[]> {
    const response = await api.get(`${this.basePath}/${id}/shares`);
    return response.data;
  }

  async addShare(
    id: string,
    data: {
      shareType: ShareType;
      targetId?: string;
      permission: SharePermission;
    }
  ): Promise<SpreadsheetShare> {
    const response = await api.post(`${this.basePath}/${id}/shares`, data);
    return response.data;
  }

  async updateSharePermission(
    id: string,
    shareId: string,
    permission: SharePermission
  ): Promise<void> {
    await api.patch(`${this.basePath}/${id}/shares/${shareId}`, { permission });
  }

  async removeShare(id: string, shareId: string): Promise<void> {
    await api.delete(`${this.basePath}/${id}/shares/${shareId}`);
  }

  async getSharedWithMe(): Promise<SpreadsheetListItem[]> {
    const response = await api.get(`${this.basePath}/shared`);
    return response.data?.items || [];
  }

  async getByShareToken(
    token: string
  ): Promise<SpreadsheetDetail & { permission: SharePermission }> {
    const response = await api.get(`/public/spreadsheets/shared/${token}`);
    return response.data;
  }
}

// ==================== Share Types ====================

export type ShareType = 'user' | 'org' | 'public';
export type SharePermission = 'viewer' | 'editor';

export interface SpreadsheetShare {
  id: string;
  spreadsheetId: string;
  shareType: ShareType;
  targetId: string | null;
  permission: SharePermission;
  shareToken: string | null;
  createdBy: string;
  createdAt: string;
  targetName?: string | null;
  targetEmail?: string | null;
  targetAvatarUrl?: string | null;
}

export default new SpreadsheetService();
