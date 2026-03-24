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
  async list(
    projectApiPath: string,
    params?: {
      type?: MessageTemplateType;
      isEnabled?: boolean;
      q?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<MessageTemplateListResponse> {
    const res = await apiService.get<
      MessageTemplateListResponse | MessageTemplate[]
    >(`${projectApiPath}/message-templates`, { params } as any);
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
  async get(projectApiPath: string, id: number): Promise<MessageTemplate> {
    const res = await apiService.get<MessageTemplate>(
      `${projectApiPath}/message-templates/${id}`
    );
    return res.data as any;
  },
  async create(
    projectApiPath: string,
    data: MessageTemplate
  ): Promise<MessageTemplate> {
    const res = await apiService.post<any>(
      `${projectApiPath}/message-templates`,
      data
    );

    // Server response structure: { success: true, data: created }
    if (res?.data?.success && res?.data?.data) {
      return res.data.data;
    }

    // Other structures for backward compatibility
    return res?.data?.data || res?.data || res;
  },
  async update(
    projectApiPath: string,
    id: number,
    data: MessageTemplate
  ): Promise<MessageTemplate> {
    const res = await apiService.put<any>(
      `${projectApiPath}/message-templates/${id}`,
      data
    );

    // Server response structure: { success: true, data: updated }
    if (res?.data?.success && res?.data?.data) {
      return res.data.data;
    }

    // Other structures for backward compatibility
    return res?.data?.data || res?.data || res;
  },
  async remove(projectApiPath: string, id: number): Promise<void> {
    await apiService.delete(`${projectApiPath}/message-templates/${id}`);
  },
  async delete(projectApiPath: string, id: number): Promise<void> {
    await apiService.delete(`${projectApiPath}/message-templates/${id}`);
  },
  async bulkDelete(projectApiPath: string, ids: number[]): Promise<void> {
    await apiService.post(`${projectApiPath}/message-templates/bulk-delete`, {
      ids,
    });
  },
};
