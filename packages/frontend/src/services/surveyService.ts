import api from './api';

export interface TriggerCondition {
  type: 'userLevel' | 'joinDays';
  value: number;
}

export interface ParticipationReward {
  rewardType: string;
  itemId: string;
  quantity: number;
}

export interface Survey {
  id: string;
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: ParticipationReward[] | null;
  rewardTemplateId?: string | null;
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetWorlds?: string[] | null;
  targetMarkets?: string[] | null;
  targetClientVersions?: string[] | null;
  targetAccountIds?: string[] | null;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyConfig {
  baseSurveyUrl: string;
  baseJoinedUrl: string;
  linkCaption: string;
  joinedSecretKey: string;
}

export interface CreateSurveyInput {
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: ParticipationReward[] | null;
  rewardTemplateId?: string | null;
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetWorlds?: string[] | null;
  targetMarkets?: string[] | null;
  targetClientVersions?: string[] | null;
  targetAccountIds?: string[] | null;
}

export interface UpdateSurveyInput {
  platformSurveyId?: string;
  surveyTitle?: string;
  surveyContent?: string;
  triggerConditions?: TriggerCondition[];
  participationRewards?: ParticipationReward[] | null;
  rewardTemplateId?: string | null;
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetWorlds?: string[] | null;
  targetMarkets?: string[] | null;
  targetClientVersions?: string[] | null;
  targetAccountIds?: string[] | null;
}

export interface GetSurveysParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

export interface GetSurveysResponse {
  surveys: Survey[];
  total: number;
  page: number;
  limit: number;
}

class SurveyService {
  /**
   * Get all surveys with pagination
   */
  async getSurveys(params?: GetSurveysParams): Promise<GetSurveysResponse> {
    const response = await api.get('/admin/surveys', { params });
    return response.data;
  }

  /**
   * Get survey by ID
   */
  async getSurveyById(id: string): Promise<Survey> {
    const response = await api.get(`/admin/surveys/${id}`);
    return response.data.survey;
  }

  /**
   * Get survey by platform survey ID
   */
  async getSurveyByPlatformId(platformSurveyId: string): Promise<Survey> {
    const response = await api.get(`/admin/surveys/platform/${platformSurveyId}`);
    return response.data.survey;
  }

  /**
   * Create a new survey
   */
  async createSurvey(input: CreateSurveyInput): Promise<Survey> {
    const response = await api.post('/admin/surveys', input);
    return response.data.survey;
  }

  /**
   * Update a survey
   */
  async updateSurvey(id: string, input: UpdateSurveyInput): Promise<Survey> {
    const response = await api.put(`/admin/surveys/${id}`, input);
    return response.data.survey;
  }

  /**
   * Delete a survey
   */
  async deleteSurvey(id: string): Promise<void> {
    await api.delete(`/admin/surveys/${id}`);
  }

  /**
   * Toggle survey active status
   */
  async toggleActive(id: string): Promise<Survey> {
    const response = await api.patch(`/admin/surveys/${id}/toggle-active`);
    return response.data.survey;
  }

  /**
   * Get survey configuration
   */
  async getSurveyConfig(): Promise<SurveyConfig> {
    const response = await api.get('/admin/surveys/config');
    return response.data.config;
  }

  /**
   * Update survey configuration
   */
  async updateSurveyConfig(input: Partial<SurveyConfig>): Promise<SurveyConfig> {
    const response = await api.put('/admin/surveys/config', input);
    return response.data.config;
  }
}

export default new SurveyService();

