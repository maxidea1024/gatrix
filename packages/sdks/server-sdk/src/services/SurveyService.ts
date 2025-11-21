/**
 * Survey Service
 * Handles survey retrieval
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { Survey, SurveyListParams, SurveySettings } from '../types/api';

export class SurveyService {
  private apiClient: ApiClient;
  private logger: Logger;
  private cachedSurveys: Survey[] = [];
  private cachedSettings: SurveySettings | null = null;

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Get active surveys with settings
   * GET /api/v1/server/surveys
   */
  async list(params?: SurveyListParams): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    this.logger.debug('Fetching surveys', params);

    const response = await this.apiClient.get<{ surveys: Survey[]; settings: SurveySettings }>(`/api/v1/server/surveys`, {
      params,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch surveys');
    }

    // response.data contains { surveys, settings }
    const { surveys, settings } = response.data;
    this.cachedSurveys = surveys;
    this.cachedSettings = settings;

    this.logger.info('Surveys fetched', { count: surveys.length, hasSettings: !!settings });

    return { surveys, settings };
  }

  /**
   * Get cached surveys (from memory)
   */
  getCached(): Survey[] {
    return this.cachedSurveys;
  }

  /**
   * Get cached survey settings
   */
  getCachedSettings(): SurveySettings | null {
    return this.cachedSettings;
  }

  /**
   * Refresh cached surveys
   */
  async refresh(params?: SurveyListParams): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    this.logger.info('Refreshing surveys cache');
    return await this.list(params);
  }

  /**
   * Refresh survey settings only
   * GET /api/v1/server/surveys/settings
   */
  async refreshSettings(): Promise<SurveySettings> {
    this.logger.info('Refreshing survey settings');

    const response = await this.apiClient.get<{ settings: SurveySettings }>(`/api/v1/server/surveys/settings`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch survey settings');
    }

    const { settings } = response.data;
    const oldSettings = this.cachedSettings;
    this.cachedSettings = settings;

    this.logger.info('Survey settings refreshed', {
      oldSettings,
      newSettings: settings,
      changed: !this.areSettingsEqual(oldSettings, settings),
    });

    return settings;
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
      const result = await this.list();
      const updatedSurvey = result.surveys.find(s => s.id === id);

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

  /**
   * Update survey settings only
   * Called when settings change (e.g., survey configuration updates)
   */
  updateSettings(newSettings: SurveySettings): void {
    const oldSettings = this.cachedSettings;
    this.cachedSettings = newSettings;

    // Check if settings actually changed
    const settingsChanged = !this.areSettingsEqual(oldSettings, newSettings);

    if (settingsChanged) {
      this.logger.info('Survey settings updated', {
        oldSettings,
        newSettings,
      });
    } else {
      this.logger.debug('Survey settings unchanged');
    }
  }

  /**
   * Check if two settings objects are equal
   */
  private areSettingsEqual(
    settings1: SurveySettings | null,
    settings2: SurveySettings | null
  ): boolean {
    if (!settings1 && !settings2) return true;
    if (!settings1 || !settings2) return false;

    return (
      settings1.defaultSurveyUrl === settings2.defaultSurveyUrl &&
      settings1.completionUrl === settings2.completionUrl &&
      settings1.linkCaption === settings2.linkCaption &&
      settings1.verificationKey === settings2.verificationKey
    );
  }

  /**
   * Check appropriate surveys for a user based on their conditions
   * Filters surveys based on platform, channel, subchannel, world, and trigger conditions
   * @param platform User's platform (e.g., 'pc', 'ios', 'android')
   * @param channel User's channel (e.g., 'steam', 'epic')
   * @param subChannel User's subchannel (e.g., 'pc', 'ios')
   * @param worldId User's world ID
   * @param userLevel User's level
   * @param joinDays User's join days
   * @returns Array of appropriate surveys, empty array if none match
   */
  getActiveSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number
  ): Survey[] {
    return this.cachedSurveys.filter((survey) => {
      // Check platform targeting
      if (survey.targetPlatforms && survey.targetPlatforms.length > 0) {
        const isInPlatformList = survey.targetPlatforms.includes(platform);
        if (survey.targetPlatformsInverted ? isInPlatformList : !isInPlatformList) {
          return false;
        }
      }

      // Check channel targeting
      if (survey.targetChannels && survey.targetChannels.length > 0) {
        const isInChannelList = survey.targetChannels.includes(channel);
        if (survey.targetChannelsInverted ? isInChannelList : !isInChannelList) {
          return false;
        }
      }

      // Check subchannel targeting (format: channel:subchannel)
      if (survey.targetSubchannels && survey.targetSubchannels.length > 0) {
        const subchannelKey = `${channel}:${subChannel}`;
        const isInSubchannelList = survey.targetSubchannels.includes(subchannelKey);
        if (survey.targetSubchannelsInverted ? isInSubchannelList : !isInSubchannelList) {
          return false;
        }
      }

      // Check world targeting
      if (survey.targetWorlds && survey.targetWorlds.length > 0) {
        const isInWorldList = survey.targetWorlds.includes(worldId);
        if (survey.targetWorldsInverted ? isInWorldList : !isInWorldList) {
          return false;
        }
      }

      // Check trigger conditions
      if (survey.triggerConditions && survey.triggerConditions.length > 0) {
        const conditionsMet = survey.triggerConditions.every((condition) => {
          if (condition.type === 'userLevel') {
            return userLevel >= condition.value;
          } else if (condition.type === 'joinDays') {
            return joinDays >= condition.value;
          }
          return true;
        });

        if (!conditionsMet) {
          return false;
        }
      }

      return true;
    });
  }
}
