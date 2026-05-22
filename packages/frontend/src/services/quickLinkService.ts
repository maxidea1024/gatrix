import { apiService } from './api';

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  description?: string | null;
  iconName: string;
  color?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuickLinkData {
  title: string;
  url: string;
  description?: string;
  iconName?: string;
  color?: string;
}

export interface UpdateQuickLinkData {
  title?: string;
  url?: string;
  description?: string | null;
  iconName?: string;
  color?: string | null;
}

export class QuickLinkService {
  static async getQuickLinks(): Promise<QuickLink[]> {
    const response = await apiService.get<{ links: QuickLink[] }>(
      '/users/me/quick-links'
    );

    if (response.success && response.data) {
      return response.data.links;
    }

    throw new Error(response.error?.message || 'Failed to fetch quick links');
  }

  static async createQuickLink(data: CreateQuickLinkData): Promise<QuickLink> {
    const response = await apiService.post<{ link: QuickLink }>(
      '/users/me/quick-links',
      data
    );

    if (response.success && response.data) {
      return response.data.link;
    }

    throw new Error(response.error?.message || 'Failed to create quick link');
  }

  static async updateQuickLink(
    id: string,
    data: UpdateQuickLinkData
  ): Promise<QuickLink> {
    const response = await apiService.put<{ link: QuickLink }>(
      `/users/me/quick-links/${id}`,
      data
    );

    if (response.success && response.data) {
      return response.data.link;
    }

    throw new Error(response.error?.message || 'Failed to update quick link');
  }

  static async deleteQuickLink(id: string): Promise<void> {
    const response = await apiService.delete(`/users/me/quick-links/${id}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete quick link');
    }
  }

  static async reorderQuickLinks(orderedIds: string[]): Promise<void> {
    const response = await apiService.put('/users/me/quick-links/reorder', {
      orderedIds,
    });

    if (!response.success) {
      throw new Error(
        response.error?.message || 'Failed to reorder quick links'
      );
    }
  }
}
