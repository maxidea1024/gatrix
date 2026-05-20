import api from './api';

// ==================== Types ====================

export interface SpreadsheetListItem {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  isPinned: boolean;
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
}

export default new SpreadsheetService();
