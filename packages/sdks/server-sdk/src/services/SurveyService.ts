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
   * Update a single survey in cache (immutable)
   * Fetches the updated survey from backend and updates only that survey in the cache
   */
  async updateSingleSurvey(id: string): Promise<void> {
    try {
      this.logger.debug('Updating single survey in cache', { id });

      // Fetch all surveys and find the updated one
      const surveys = await this.list({ isActive: true });
      const updatedSurvey = surveys.find(s => s.id === id);

      if (!updatedSurvey) {
        this.logger.warn('Updated survey not found in response', { id });
        return;
      }

      // Immutable update: create new array with updated survey
      this.cachedSurveys = this.cachedSurveys.map(survey =>
        survey.id === id ? updatedSurvey : survey
      );

      this.logger.debug('Single survey updated in cache', { id });
    } catch (error: any) {
      this.logger.error('Failed to update single survey in cache', {
        id,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh({ isActive: true });
    }
  }

  /**
   * Remove a survey from cache (immutable)
   */
  removeSurvey(id: string): void {
    this.logger.debug('Removing survey from cache', { id });

    // Immutable update: create new array without the deleted survey
    this.cachedSurveys = this.cachedSurveys.filter(survey => survey.id !== id);

    this.logger.debug('Survey removed from cache', { id });
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

