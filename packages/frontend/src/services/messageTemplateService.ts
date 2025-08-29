import { apiService } from './api';

export type MessageTemplateType = 'maintenance' | 'general' | 'notification';
export type Lang = 'ko' | 'en' | 'zh';

export interface MessageTemplateLocale { lang: Lang; message: string }
export interface MessageTemplate {
  id?: number;
  name: string;
  type: MessageTemplateType;
  is_enabled: boolean;
  default_message?: string | null;
  locales?: MessageTemplateLocale[];
  created_at?: string;
  updated_at?: string;
}

export interface MessageTemplateListResponse {
  templates: MessageTemplate[];
  total: number;
}

export const messageTemplateService = {
  async list(params?: { type?: MessageTemplateType; is_enabled?: boolean; q?: string; limit?: number; offset?: number }): Promise<MessageTemplateListResponse> {
    const res = await apiService.get<MessageTemplateListResponse | MessageTemplate[]>(
      '/message-templates',
      { params } as any
    );
    const d: any = res.data;

    // 백워드 호환성: 배열이면 기존 형식, 객체면 새 형식
    if (Array.isArray(d)) {
      return { templates: d, total: d.length };
    }

    return {
      templates: d?.templates ?? [],
      total: d?.total ?? 0
    };
  },
  async get(id: number): Promise<MessageTemplate> {
    const res = await apiService.get<MessageTemplate>(`/message-templates/${id}`);
    return res.data as any;
  },
  async create(data: MessageTemplate): Promise<MessageTemplate> {
    const res = await apiService.post<MessageTemplate>('/message-templates', data);
    return res.data as any;
  },
  async update(id: number, data: MessageTemplate): Promise<MessageTemplate> {
    const res = await apiService.put<MessageTemplate>(`/message-templates/${id}`, data);
    return res.data as any;
  },
  async remove(id: number): Promise<void> {
    await apiService.delete(`/message-templates/${id}`);
  },
  async delete(id: number): Promise<void> {
    await apiService.delete(`/message-templates/${id}`);
  },
  async bulkDelete(ids: number[]): Promise<void> {
    await apiService.post('/message-templates/bulk-delete', { ids });
  }
};

