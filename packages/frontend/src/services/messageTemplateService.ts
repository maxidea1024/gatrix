import { apiService } from './api';

export type MessageTemplateType = 'maintenance' | 'general' | 'notification';
export type Lang = 'ko' | 'en' | 'zh';

export interface MessageTemplateLocale { lang: Lang; message: string }
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
  async list(params?: { type?: MessageTemplateType; isEnabled?: boolean; q?: string; limit?: number; offset?: number }): Promise<MessageTemplateListResponse> {
    const res = await apiService.get<MessageTemplateListResponse | MessageTemplate[]>(
      '/message-templates',
      { params } as any
    );
    const d: any = res.data;

    console.log('🔍 Raw API response:', res);
    console.log('🔍 Response data:', d);

    // 백워드 호환성: 배열이면 기존 형식, 객체면 새 형식
    if (Array.isArray(d)) {
      console.log('🔍 Array format detected');
      return { templates: d, total: d.length };
    }

    const result = {
      templates: d?.templates ?? d?.items ?? [],
      total: d?.total ?? 0
    };

    console.log('🔍 Processed result:', result);
    return result;
  },
  async get(id: number): Promise<MessageTemplate> {
    const res = await apiService.get<MessageTemplate>(`/message-templates/${id}`);
    return res.data as any;
  },
  async create(data: MessageTemplate): Promise<MessageTemplate> {
    const res = await apiService.post<any>('/message-templates', data);

    // 서버 응답 구조: { success: true, data: created }
    if (res?.data?.success && res?.data?.data) {
      return res.data.data;
    }

    // 백워드 호환성을 위한 다른 구조들
    return res?.data?.data || res?.data || res;
  },
  async update(id: number, data: MessageTemplate): Promise<MessageTemplate> {
    const res = await apiService.put<any>(`/message-templates/${id}`, data);

    // 서버 응답 구조: { success: true, data: updated }
    if (res?.data?.success && res?.data?.data) {
      return res.data.data;
    }

    // 백워드 호환성을 위한 다른 구조들
    return res?.data?.data || res?.data || res;
  },
  async remove(id: number): Promise<void> {
    await apiService.delete(`/message-templates/${id}`);
  },
  async delete(id: number): Promise<void> {
    await apiService.delete(`/message-templates/${id}`);
  },
  async bulkDelete(ids: number[]): Promise<void> {
    await apiService.post('/message-templates/bulk-delete', { ids });
  },

  // 태그 관련 메서드
  async getTags(id: number): Promise<any[]> {
    const response = await apiService.get(`/message-templates/${id}/tags`);
    return response.data?.data || [];
  },

  async setTags(id: number, tagIds: number[]): Promise<void> {
    await apiService.put(`/message-templates/${id}/tags`, { tagIds });
  }
};

