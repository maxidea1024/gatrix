import api from './api';
import {
  MutationResult,
  parseChangeRequestResponse,
} from './changeRequestUtils';

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
  tags?: any[];
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
  tags?: any[];
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
  tags?: any[];
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

export interface SurveyLog {
  id: string;
  environmentId: string;
  surveyId: string;
  action: 'JOINED' | 'SENT';
  accountId: string;
  characterId?: string | null;
  userName?: string | null;
  worldId?: string | null;
  platform?: string | null;
  channel?: string | null;
  subchannel?: string | null;
  createdAt: string;
}

export interface GetSurveyLogsParams {
  page?: number;
  limit?: number;
  surveyId?: string;
  action?: 'JOINED' | 'SENT';
  accountId?: string;
  userName?: string;
  worldId?: string;
  platform?: string;
  channel?: string;
  subchannel?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetSurveyLogsResponse {
  logs: SurveyLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class SurveyService {
  /**
   * Get all surveys with pagination
   */
  async getSurveys(
    projectApiPath: string,
    params?: GetSurveysParams
  ): Promise<GetSurveysResponse> {
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
  async getSurveyByPlatformId(
    projectApiPath: string,
    platformSurveyId: string
  ): Promise<Survey> {
    const response = await api.get(
      `${projectApiPath}/surveys/platform/${platformSurveyId}`
    );
    return response.data.survey;
  }

  /**
   * Create a new survey
   */
  async createSurvey(
    projectApiPath: string,
    input: CreateSurveyInput,
    skipCr?: boolean
  ): Promise<MutationResult<Survey>> {
    const response = await api.post(
      `${projectApiPath}/surveys${skipCr ? '?skipCr=true' : ''}`,
      input
    );
    return parseChangeRequestResponse<Survey>(response, (r) => r?.survey);
  }

  /**
   * Update a survey
   */
  async updateSurvey(
    projectApiPath: string,
    id: string,
    input: UpdateSurveyInput,
    skipCr?: boolean
  ): Promise<MutationResult<Survey>> {
    const response = await api.put(
      `${projectApiPath}/surveys/${id}${skipCr ? '?skipCr=true' : ''}`,
      input
    );
    return parseChangeRequestResponse<Survey>(response, (r) => r?.survey);
  }

  /**
   * Delete a survey
   */
  async deleteSurvey(
    projectApiPath: string,
    id: string,
    skipCr?: boolean
  ): Promise<MutationResult<void>> {
    const response = await api.delete(
      `${projectApiPath}/surveys/${id}${skipCr ? '?skipCr=true' : ''}`
    );
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Toggle survey active status
   */
  async toggleActive(
    projectApiPath: string,
    id: string,
    skipCr?: boolean
  ): Promise<MutationResult<Survey>> {
    const response = await api.patch(
      `${projectApiPath}/surveys/${id}/toggle-active${skipCr ? '?skipCr=true' : ''}`
    );
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

  /**
   * Get survey logs
   */
  async getSurveyLogs(
    projectApiPath: string,
    params?: GetSurveyLogsParams
  ): Promise<GetSurveyLogsResponse> {
    const response = await api.get(`${projectApiPath}/surveys/logs`, {
      params,
    });
    return response.data;
  }
}

export default new SurveyService();
