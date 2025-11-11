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
   * If isActive is false, removes the survey from cache (no API call needed)
   * If isActive is true but not in cache, fetches and adds it to cache
   * If isActive is true and in cache, fetches and updates it
   */
  async updateSingleSurvey(id: string, isActive?: boolean | number): Promise<void> {
    try {
      this.logger.debug('Updating single survey in cache', { id, isActive });

      // If isActive is explicitly false (0 or false), just remove from cache
      if (isActive === false || isActive === 0) {
        this.logger.info('Survey isActive=false, removing from cache', { id });
        this.removeSurvey(id);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Fetch all surveys and find the updated one
      const surveys = await this.list();
      const updatedSurvey = surveys.find(s => s.id === id);

      if (!updatedSurvey) {
        this.logger.debug('Survey is no longer active, removing from cache', { id });
        this.removeSurvey(id);
        return;
      }

      // Check if survey already exists in cache
      const existsInCache = this.cachedSurveys.some(survey => survey.id === id);

      if (existsInCache) {
        // Immutable update: update existing survey
        this.cachedSurveys = this.cachedSurveys.map(survey =>
          survey.id === id ? updatedSurvey : survey
        );
        this.logger.debug('Single survey updated in cache', { id });
      } else {
        // Survey not in cache but found in backend (e.g., isActive changed from false to true)
        // Add it to cache
        this.cachedSurveys = [...this.cachedSurveys, updatedSurvey];
        this.logger.debug('Single survey added to cache (was previously removed)', { id });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single survey in cache', {
        id,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
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

