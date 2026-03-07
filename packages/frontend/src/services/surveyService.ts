import api from './api';
import { MutationResult, parseChangeRequestResponse } from './changeRequestUtils';

export interface TriggerCondition {
  type: 'userLevel' | 'joinDays';
  value: number;
}

export interface Reward {
  rewardType: string;
  itemId: string;
  quantity: number;
  type?: string;
  id?: number;
}

export type ParticipationReward = Reward;

export interface ChannelSubchannelData {
  channel: string;
  subchannels: string[];
}

export interface Survey {
  id: string;
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: Reward[] | null;
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannelSubchannels?: ChannelSubchannelData[] | null;
  targetChannelSubchannelsInverted?: boolean;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: string;
  updatedAt?: string;
  rewardTemplateId?: string | null;
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
  participationRewards?: Reward[] | null;
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels?: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
}

export interface UpdateSurveyInput {
  platformSurveyId?: string;
  surveyTitle?: string;
  surveyContent?: string;
  triggerConditions?: TriggerCondition[];
  participationRewards?: Reward[] | null;
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels?: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
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
  async getSurveys(projectApiPath: string, params?: GetSurveysParams): Promise<GetSurveysResponse> {
    const response = await api.get(`${projectApiPath}/surveys`, { params });
    return response.data;
  }

  /**
   * Get survey by ID
   */
  async getSurveyById(projectApiPath: string, id: string): Promise<Survey> {
    const response = await api.get(`${projectApiPath}/surveys/${id}`);
    return response.data.survey;
  }

  /**
   * Get survey by platform survey ID
   */
  async getSurveyByPlatformId(projectApiPath: string, platformSurveyId: string): Promise<Survey> {
    const response = await api.get(`${projectApiPath}/surveys/platform/${platformSurveyId}`);
    return response.data.survey;
  }

  /**
   * Create a new survey
   */
  async createSurvey(
    projectApiPath: string,
    input: CreateSurveyInput
  ): Promise<MutationResult<Survey>> {
    const response = await api.post(`${projectApiPath}/surveys`, input);
    return parseChangeRequestResponse<Survey>(response, (r) => r?.survey);
  }

  /**
   * Update a survey
   */
  async updateSurvey(
    projectApiPath: string,
    id: string,
    input: UpdateSurveyInput
  ): Promise<MutationResult<Survey>> {
    const response = await api.put(`${projectApiPath}/surveys/${id}`, input);
    return parseChangeRequestResponse<Survey>(response, (r) => r?.survey);
  }

  /**
   * Delete a survey
   */
  async deleteSurvey(projectApiPath: string, id: string): Promise<MutationResult<void>> {
    const response = await api.delete(`${projectApiPath}/surveys/${id}`);
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Toggle survey active status
   */
  async toggleActive(projectApiPath: string, id: string): Promise<MutationResult<Survey>> {
    const response = await api.patch(`${projectApiPath}/surveys/${id}/toggle-active`);
    return parseChangeRequestResponse<Survey>(response, (r) => r?.survey);
  }

  /**
   * Get survey configuration
   */
  async getSurveyConfig(projectApiPath: string): Promise<SurveyConfig> {
    const response = await api.get(`${projectApiPath}/surveys/config`);
    return response.data.config;
  }

  /**
   * Update survey configuration
   */
  async updateSurveyConfig(
    projectApiPath: string,
    input: Partial<SurveyConfig>
  ): Promise<SurveyConfig> {
    const response = await api.put(`${projectApiPath}/surveys/config`, input);
    return response.data.config;
  }
}

export default new SurveyService();
