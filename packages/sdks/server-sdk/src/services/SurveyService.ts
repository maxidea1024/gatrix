/**
 * Survey Service
 * Handles survey retrieval
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { Survey, SurveyListParams } from '../types/api';

export class SurveyService {
  private apiClient: ApiClient;
  private logger: Logger;
  private cachedSurveys: Survey[] = [];

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Get active surveys
   * GET /api/v1/server/surveys
   */
  async list(params?: SurveyListParams): Promise<Survey[]> {
    this.logger.debug('Fetching surveys', params);

    const response = await this.apiClient.get<Survey[]>(`/api/v1/server/surveys`, {
      params,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch surveys');
    }

    const surveys = response.data;
    this.cachedSurveys = surveys;

    this.logger.info('Surveys fetched', { count: surveys.length });

    return surveys;
  }

  /**
   * Get cached surveys (from memory)
   */
  getCached(): Survey[] {
    return this.cachedSurveys;
  }

  /**
   * Refresh cached surveys
   */
  async refresh(params?: SurveyListParams): Promise<Survey[]> {
    this.logger.info('Refreshing surveys cache');
    return await this.list(params);
  }

  /**
   * Update cache with new data
   */
  updateCache(surveys: Survey[]): void {
    this.cachedSurveys = surveys;
    this.logger.debug('Surveys cache updated', { count: surveys.length });
  }

  /**
   * Get active surveys
   */
  getActiveSurveys(): Survey[] {
    return this.cachedSurveys.filter((survey) => survey.isActive);
  }

  /**
   * Get surveys for a specific world
   */
  getSurveysForWorld(worldId: string): Survey[] {
    return this.cachedSurveys.filter((survey) => {
      if (!survey.targetWorlds || survey.targetWorlds.length === 0) {
        return !survey.targetWorldsInverted; // No targeting = show to all (if not inverted)
      }

      const isInTargetList = survey.targetWorlds.includes(worldId);
      return survey.targetWorldsInverted ? !isInTargetList : isInTargetList;
    });
  }
}

