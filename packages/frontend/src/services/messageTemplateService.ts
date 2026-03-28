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

// Extended response type for CR-aware mutations
export interface MessageTemplateMutationResult {
  data?: any;
  isChangeRequest: boolean;
  changeRequestId?: string;
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
    data: MessageTemplate,
    skipCr?: boolean
  ): Promise<MessageTemplateMutationResult> {
    const res = await apiService.post<any>(
      `${projectApiPath}/message-templates${skipCr ? '?skipCr=true' : ''}`,
      data
    );

    // Check if this is a change request response
    const responseData = res?.data?.data || res?.data || res;
    if (responseData?.changeRequestId) {
      return {
        isChangeRequest: true,
        changeRequestId: responseData.changeRequestId,
      };
    }

    return {
      data: responseData,
      isChangeRequest: false,
    };
  },
  async update(
    projectApiPath: string,
    id: number,
    data: MessageTemplate,
    skipCr?: boolean
  ): Promise<MessageTemplateMutationResult> {
    const res = await apiService.put<any>(
      `${projectApiPath}/message-templates/${id}${skipCr ? '?skipCr=true' : ''}`,
      data
    );

    // Check if this is a change request response
    const responseData = res?.data?.data || res?.data || res;
    if (responseData?.changeRequestId) {
      return {
        isChangeRequest: true,
        changeRequestId: responseData.changeRequestId,
      };
    }

    return {
      data: responseData,
      isChangeRequest: false,
    };
  },
  async remove(
    projectApiPath: string,
    id: number
  ): Promise<MessageTemplateMutationResult> {
    const res: any = await apiService.delete(
      `${projectApiPath}/message-templates/${id}`
    );

    const responseData = res?.data?.data || res?.data || res;
    if (responseData?.changeRequestId) {
      return {
        isChangeRequest: true,
        changeRequestId: responseData.changeRequestId,
      };
    }

    return { isChangeRequest: false };
  },
  async delete(
    projectApiPath: string,
    id: number,
    skipCr?: boolean
  ): Promise<MessageTemplateMutationResult> {
    const res: any = await apiService.delete(
      `${projectApiPath}/message-templates/${id}${skipCr ? '?skipCr=true' : ''}`
    );

    const responseData = res?.data?.data || res?.data || res;
    if (responseData?.changeRequestId) {
      return {
        isChangeRequest: true,
        changeRequestId: responseData.changeRequestId,
      };
    }

    return { isChangeRequest: false };
  },
  async bulkDelete(
    projectApiPath: string,
    ids: number[],
    skipCr?: boolean
  ): Promise<MessageTemplateMutationResult> {
    const res: any = await apiService.post(
      `${projectApiPath}/message-templates/bulk-delete${skipCr ? '?skipCr=true' : ''}`,
      { ids }
    );

    const responseData = res?.data?.data || res?.data || res;
    if (responseData?.mode === 'CHANGE_REQUEST') {
      return {
        isChangeRequest: true,
      };
    }

    return { isChangeRequest: false };
  },
};
