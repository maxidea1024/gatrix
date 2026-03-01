import { apiService } from './api';

export type MessageTemplateType = 'maintenance' | 'general' | 'notification';
export type Lang = 'ko' | 'en' | 'zh';

export interface MessageTemplateLocale {
  lang: Lang;
  message: string;
}
export interface MessageTemplate {
  id?: number;
  name: string;
  type: MessageTemplateType;
  isEnabled: boolean;
  supportsMultiLanguage?: boolean;
  defaultMessage?: string | null;
  locales?: MessageTemplateLocale[];
  tags?: { id: number; name: string; color: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MessageTemplateListResponse {
  templates: MessageTemplate[];
  total: number;
}

export const messageTemplateService = {
  async list(params?: {
    type?: MessageTemplateType;
    isEnabled?: boolean;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<MessageTemplateListResponse> {
    const res = await apiService.get<MessageTemplateListResponse | MessageTemplate[]>(
      '/admin/message-templates',
      { params } as any
    );
    const d: any = res.data;

    // Backward compatibility: existing format if array, new format if object
    if (Array.isArray(d)) {
      return { templates: d, total: d.length };
    }

    // Server response structure: { success: true, data: { items: ..., total: ... } }
    // Nested structure if data.data exists
    const actualData = d?.data || d;

    return {
      templates: actualData?.templates ?? actualData?.items ?? [],
      total: actualData?.total ?? 0,
    };
  },
  async get(id: number): Promise<MessageTemplate> {
    const res = await apiService.get<MessageTemplate>(`/admin/message-templates/${id}`);
    return res.data as any;
  },
  async create(data: MessageTemplate): Promise<MessageTemplate> {
    const res = await apiService.post<any>('/admin/message-templates', data);

    // Server response structure: { success: true, data: created }
    if (res?.data?.success && res?.data?.data) {
      return res.data.data;
    }

    // Other structures for backward compatibility
    return res?.data?.data || res?.data || res;
  },
  async update(id: number, data: MessageTemplate): Promise<MessageTemplate> {
    const res = await apiService.put<any>(`/admin/message-templates/${id}`, data);

    // Server response structure: { success: true, data: updated }
    if (res?.data?.success && res?.data?.data) {
      return res.data.data;
    }

    // Other structures for backward compatibility
    return res?.data?.data || res?.data || res;
  },
  async remove(id: number): Promise<void> {
    await apiService.delete(`/admin/message-templates/${id}`);
  },
  async delete(id: number): Promise<void> {
    await apiService.delete(`/admin/message-templates/${id}`);
  },
  async bulkDelete(ids: number[]): Promise<void> {
    await apiService.post('/admin/message-templates/bulk-delete', { ids });
  },

  // Tag related methods
  async getTags(id: number): Promise<any[]> {
    const response = await apiService.get(`/admin/message-templates/${id}/tags`);
    return response.data?.data || [];
  },

  async setTags(id: number, tagIds: number[]): Promise<void> {
    await apiService.put(`/admin/message-templates/${id}/tags`, { tagIds });
  },
};
