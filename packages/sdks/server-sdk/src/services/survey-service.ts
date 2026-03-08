/**
 * Survey Service
 * Handles survey retrieval
 * Uses per-environment API pattern: GET /api/v1/server/surveys
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly in multi-env mode
 * - Environment resolution is delegated to string
 * - In multi-environment mode (edge), environment MUST always be provided
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import { Survey, SurveyListParams, SurveySettings } from '../types/api';

export class SurveyService {
  private apiClient: ApiClient;
  private logger: Logger;
  private defaultToken: string;
  private storage?: CacheStorageProvider;
  // Multi-environment cache: Map<environment (environmentName), Survey[]>
  private cachedSurveysByEnv: Map<string, Survey[]> = new Map();
  // Multi-environment settings cache: Map<environment (environmentName), SurveySettings>
  private cachedSettingsByEnv: Map<string, SurveySettings> = new Map();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultToken: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultToken = defaultToken;
    this.storage = storage;
  }

  /**
   * Initialize service and load data from local storage
   */
  async initializeAsync(environmentId: string): Promise<void> {
    if (!this.storage) return;

    try {
      const [surveysJson, settingsJson] = await Promise.all([
        this.storage.get(`Surveys_${environmentId}_data`),
        this.storage.get(`Surveys_${environmentId}_settings`),
      ]);

      if (surveysJson) {
        this.cachedSurveysByEnv.set(environmentId, JSON.parse(surveysJson));
      }
      if (settingsJson) {
        this.cachedSettingsByEnv.set(environmentId, JSON.parse(settingsJson));
      }
      this.logger.debug('Loaded surveys from local storage', { environmentId });
    } catch (error: any) {
      this.logger.warn('Failed to load surveys from local storage', {
        environmentId,
        error: error.message,
      });
    }
  }

  /**
   * Set feature enabled flag
   * When false, refresh methods will log a warning
   */
  setFeatureEnabled(enabled: boolean): void {
    this.featureEnabled = enabled;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  /**
   * Get active surveys with settings for a specific environment
   * GET /api/v1/server/surveys
   */
  async listByEnvironment(
    environmentId: string,
    params?: SurveyListParams
  ): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    const endpoint = `/api/v1/server/surveys`;

    this.logger.debug('Fetching surveys', { environmentId, params });

    const response = await this.apiClient.get<{
      surveys: Survey[];
      settings: SurveySettings;
    }>(endpoint, {
      params,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch surveys');
    }

    // response.data contains { surveys, settings }
    const { surveys, settings } = response.data;
    this.cachedSurveysByEnv.set(environmentId, surveys);
    this.cachedSettingsByEnv.set(environmentId, settings);

    // Save to local storage if available
    if (this.storage) {
      await Promise.all([
        this.storage.save(
          `Surveys_${environmentId}_data`,
          JSON.stringify(surveys)
        ),
        this.storage.save(
          `Surveys_${environmentId}_settings`,
          JSON.stringify(settings)
        ),
      ]);
    }

    this.logger.info('Surveys fetched', {
      count: surveys.length,
      hasSettings: !!settings,
      environmentId,
    });

    return { surveys, settings };
  }

  /**
   * Get surveys for multiple environments
   */
  async listByEnvironments(
    environments: string[],
    params?: SurveyListParams
  ): Promise<{ surveys: Survey[]; settings: SurveySettings | null }> {
    this.logger.debug('Fetching surveys for multiple environments', {
      environments,
    });

    const allSurveys: Survey[] = [];
    let lastSettings: SurveySettings | null = null;

    for (const env of environments) {
      try {
        const { surveys, settings } = await this.listByEnvironment(env, params);
        allSurveys.push(...surveys);
        lastSettings = settings;
      } catch (error) {
        this.logger.error(`Failed to fetch surveys for environment ${env}`, {
          error,
        });
      }
    }

    return { surveys: allSurveys, settings: lastSettings };
  }

  /**
   * Get cached surveys
   * @param environmentId environment ID (required)
   */
  getCached(environmentId: string): Survey[] {
    return this.cachedSurveysByEnv.get(environmentId) || [];
  }

  /**
   * Get all cached surveys (all environments)
   */
  getAllCached(): Map<string, Survey[]> {
    return this.cachedSurveysByEnv;
  }

  /**
   * Get all cached surveys as flat array (for internal use)
   */
  getAllCachedFlat(): Survey[] {
    return Array.from(this.cachedSurveysByEnv.values()).flat();
  }

  /**
   * Get cached survey settings
   * @param environmentId environment ID (required)
   */
  getCachedSettings(environmentId: string): SurveySettings | null {
    return this.cachedSettingsByEnv.get(environmentId) || null;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedSurveysByEnv.clear();
    this.cachedSettingsByEnv.clear();
    this.logger.debug('Surveys cache cleared');
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environmentId: string): void {
    this.cachedSurveysByEnv.delete(environmentId);
    this.cachedSettingsByEnv.delete(environmentId);
    this.logger.debug('Surveys cache cleared for environment', {
      environmentId,
    });
  }

  /**
   * Refresh cached surveys for a specific environment
   * @param environmentId environment ID
   * @param params Optional list parameters
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    environmentId: string,
    params?: SurveyListParams,
    suppressWarnings?: boolean
  ): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'SurveyService.refreshByEnvironment() called but feature is disabled',
        {
          environmentId,
        }
      );
    }
    this.logger.info('Refreshing surveys cache', { environmentId });
    return await this.listByEnvironment(environmentId, params);
  }

  /**
   * Get survey by ID
   * GET /api/v1/server/surveys/:id
   * @param id Survey ID
   * @param environmentId environment ID (required)
   */
  async getById(id: string, environmentId: string): Promise<Survey> {
    this.logger.debug('Fetching survey by ID', { id, environmentId });

    const response = await this.apiClient.get<{ survey: Survey }>(
      `/api/v1/server/surveys/${id}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch survey');
    }

    this.logger.info('Survey fetched', { id });

    return response.data.survey;
  }

  /**
   * Refresh survey settings only
   * GET /api/v1/server/surveys/settings
   * @param environmentId environment ID (required)
   */
  async refreshSettings(environmentId: string): Promise<SurveySettings> {
    this.logger.info('Refreshing survey settings', { environmentId });

    const response = await this.apiClient.get<{ settings: SurveySettings }>(
      `/api/v1/server/surveys/settings`
    );

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch survey settings'
      );
    }

    const { settings } = response.data;
    const oldSettings = this.cachedSettingsByEnv.get(environmentId);
    this.cachedSettingsByEnv.set(environmentId, settings);

    this.logger.info('Survey settings refreshed', {
      environmentId,
      oldSettings,
      newSettings: settings,
      changed: !this.areSettingsEqual(oldSettings || null, settings),
    });

    return settings;
  }

  /**
   * Update cache with new data
   * @param surveys Surveys to cache
   * @param environmentId environment ID (required)
   */
  updateCache(surveys: Survey[], environmentId: string): void {
    this.cachedSurveysByEnv.set(environmentId, surveys);
    this.logger.debug('Surveys cache updated', {
      environmentId,
      count: surveys.length,
    });
  }

  /**
   * Update a single survey in cache (immutable)
   * If isActive is false, removes the survey from cache (no API call needed)
   * If isActive is true but not in cache, fetches and adds it to cache
   * If isActive is true and in cache, fetches and updates it
   * @param id Survey ID
   * @param environmentId environment ID (required)
   * @param isActive Optional active status
   */
  async updateSingleSurvey(
    id: string,
    environmentId: string,
    isActive?: boolean | number
  ): Promise<void> {
    try {
      this.logger.debug('Updating single survey in cache', {
        id,
        environmentId,
        isActive,
      });

      // If isActive is explicitly false (0 or false), just remove from cache
      if (isActive === false || isActive === 0) {
        this.logger.info('Survey isActive=false, removing from cache', {
          id,
          environmentId,
        });
        this.removeSurvey(id, environmentId);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch the single survey from backend using getById (instead of list)
      let updatedSurvey: Survey;
      try {
        updatedSurvey = await this.getById(id, environmentId);
      } catch (_error: any) {
        // If survey not found (404), it's no longer active
        this.logger.debug(
          'Survey not found or not active, removing from cache',
          {
            id,
            environmentId,
          }
        );
        this.removeSurvey(id, environmentId);
        return;
      }

      // Get current surveys for this environment
      const currentSurveys = this.cachedSurveysByEnv.get(environmentId) || [];

      // Check if survey already exists in cache
      const existsInCache = currentSurveys.some((survey) => survey.id === id);

      if (existsInCache) {
        // Immutable update: update existing survey
        const newSurveys = currentSurveys.map((survey) =>
          survey.id === id ? updatedSurvey : survey
        );
        this.cachedSurveysByEnv.set(environmentId, newSurveys);
        this.logger.debug('Single survey updated in cache', {
          id,
          environmentId,
        });
      } else {
        // Survey not in cache but found in backend (e.g., isActive changed from false to true)
        // Add it to cache
        const newSurveys = [...currentSurveys, updatedSurvey];
        this.cachedSurveysByEnv.set(environmentId, newSurveys);
        this.logger.debug(
          'Single survey added to cache (was previously removed)',
          {
            id,
            environmentId,
          }
        );
      }
    } catch (error: any) {
      this.logger.error('Failed to update single survey in cache', {
        id,
        environmentId,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refreshByEnvironment(environmentId);
    }
  }

  /**
   * Remove a survey from cache (immutable)
   * @param id Survey ID
   * @param environmentId environment ID (required)
   */
  removeSurvey(id: string, environmentId: string): void {
    this.logger.debug('Removing survey from cache', { id, environmentId });

    const currentSurveys = this.cachedSurveysByEnv.get(environmentId) || [];

    // Immutable update: create new array without the deleted survey
    const newSurveys = currentSurveys.filter((survey) => survey.id !== id);
    this.cachedSurveysByEnv.set(environmentId, newSurveys);

    this.logger.debug('Survey removed from cache', { id, environmentId });
  }

  /**
   * Get surveys for a specific world
   * @param worldId World ID
   * @param environmentId environment ID (required)
   */
  getSurveysForWorld(worldId: string, environmentId: string): Survey[] {
    const surveys = this.getCached(environmentId);
    return surveys.filter((survey) => {
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
   * @param newSettings New settings to cache
   * @param environmentId environment ID (required)
   */
  updateSettings(newSettings: SurveySettings, environmentId: string): void {
    const oldSettings = this.cachedSettingsByEnv.get(environmentId);
    this.cachedSettingsByEnv.set(environmentId, newSettings);

    // Check if settings actually changed
    const settingsChanged = !this.areSettingsEqual(
      oldSettings || null,
      newSettings
    );

    if (settingsChanged) {
      this.logger.info('Survey settings updated', {
        environmentId,
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
   * @param environmentId environment ID (required)
   * @returns Array of appropriate surveys, empty array if none match
   */
  getActiveSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number,
    environmentId: string
  ): Survey[] {
    const surveys = this.getCached(environmentId);
    return surveys.filter((survey) => {
      // Check platform targeting
      if (survey.targetPlatforms && survey.targetPlatforms.length > 0) {
        const isInPlatformList = survey.targetPlatforms.includes(platform);
        if (
          survey.targetPlatformsInverted ? isInPlatformList : !isInPlatformList
        ) {
          return false;
        }
      }

      // Check channel targeting
      if (survey.targetChannels && survey.targetChannels.length > 0) {
        const isInChannelList = survey.targetChannels.includes(channel);
        if (
          survey.targetChannelsInverted ? isInChannelList : !isInChannelList
        ) {
          return false;
        }
      }

      // Check subchannel targeting (format: channel:subchannel)
      if (survey.targetSubchannels && survey.targetSubchannels.length > 0) {
        const subchannelKey = `${channel}:${subChannel}`;
        const isInSubchannelList =
          survey.targetSubchannels.includes(subchannelKey);
        if (
          survey.targetSubchannelsInverted
            ? isInSubchannelList
            : !isInSubchannelList
        ) {
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
