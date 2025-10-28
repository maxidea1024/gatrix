import api from './api';

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
  tags?: string[];
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRewardTemplateInput {
  name: string;
  description?: string;
  rewardItems: ParticipationReward[];
  tags?: string[];
}

export interface UpdateRewardTemplateInput {
  name?: string;
  description?: string;
  rewardItems?: ParticipationReward[];
  tags?: string[];
}

export interface GetRewardTemplatesParams {
  page?: number;
  limit?: number;
  search?: string;
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
    return response.data.data;
  }

  /**
   * Get reward template by ID
   */
  async getRewardTemplateById(id: string): Promise<RewardTemplate> {
    const response = await api.get(`/admin/reward-templates/${id}`);
    return response.data.data.template;
  }

  /**
   * Create a new reward template
   */
  async createRewardTemplate(input: CreateRewardTemplateInput): Promise<RewardTemplate> {
    const response = await api.post('/admin/reward-templates', input);
    return response.data.data.template;
  }

  /**
   * Update a reward template
   */
  async updateRewardTemplate(id: string, input: UpdateRewardTemplateInput): Promise<RewardTemplate> {
    const response = await api.put(`/admin/reward-templates/${id}`, input);
    return response.data.data.template;
  }

  /**
   * Delete a reward template
   */
  async deleteRewardTemplate(id: string): Promise<void> {
    await api.delete(`/admin/reward-templates/${id}`);
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

