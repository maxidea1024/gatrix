import api from './api';
import { Tag } from './tagService';
import { MutationResult, parseChangeRequestResponse } from './changeRequestUtils';

export interface ParticipationReward {
  rewardType: string;
  itemId: string;
  quantity: number;
}

export interface RewardTemplate {
  id: string;
  name: string;
  description?: string;
  rewardItems: ParticipationReward[];
  tags?: Tag[];
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRewardTemplateInput {
  name: string;
  description?: string;
  rewardItems: ParticipationReward[];
  tagIds?: number[];
}

export interface UpdateRewardTemplateInput {
  name?: string;
  description?: string;
  rewardItems?: ParticipationReward[];
  tagIds?: number[];
}

export interface GetRewardTemplatesParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetRewardTemplatesResponse {
  templates: RewardTemplate[];
  total: number;
  page: number;
  limit: number;
}

class RewardTemplateService {
  /**
   * Get all reward templates with pagination
   */
  async getRewardTemplates(params?: GetRewardTemplatesParams): Promise<GetRewardTemplatesResponse> {
    const response = await api.get('/admin/reward-templates', { params });
    // API service already unwraps response.data, so response = { success: true, data: { templates, total, page, limit }, message: "..." }
    return response.data;
  }

  /**
   * Get reward template by ID
   */
  async getRewardTemplateById(id: string): Promise<RewardTemplate> {
    const response = await api.get(`/admin/reward-templates/${id}`);
    // API service already unwraps response.data, so response = { success: true, data: { template }, message: "..." }
    return response.data.template;
  }

  /**
   * Create a new reward template
   */
  async createRewardTemplate(input: CreateRewardTemplateInput): Promise<MutationResult<RewardTemplate>> {
    const response = await api.post('/admin/reward-templates', input);
    return parseChangeRequestResponse<RewardTemplate>(response, (r) => r?.template);
  }

  /**
   * Update a reward template
   */
  async updateRewardTemplate(id: string, input: UpdateRewardTemplateInput): Promise<MutationResult<RewardTemplate>> {
    const response = await api.put(`/admin/reward-templates/${id}`, input);
    return parseChangeRequestResponse<RewardTemplate>(response, (r) => r?.template);
  }

  /**
   * Delete a reward template
   */
  async deleteRewardTemplate(id: string): Promise<MutationResult<void>> {
    const response = await api.delete(`/admin/reward-templates/${id}`);
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Check references for a reward template
   */
  async checkReferences(id: string): Promise<{ surveys: any[], coupons: any[] }> {
    const response = await api.get(`/admin/reward-templates/${id}/references`);
    return response.data.data;
  }
}

export default new RewardTemplateService();

