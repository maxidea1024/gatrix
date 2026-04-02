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
import { ApiClientFactory } from '../client/api-client-factory';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import { Survey, SurveyListParams, SurveySettings } from '../types/api';
import { validateAll } from '../utils/validation';

export class SurveyService {
  private apiClient: ApiClient;
  private logger: Logger;
  private defaultEnvironmentId: string;
  private storage?: CacheStorageProvider;
  // Multi-environment cache: Map<environmentId, Survey[]>
  private cachedSurveysByEnv: Map<string, Survey[]> = new Map();
  // Multi-environment settings cache: Map<environmentId, SurveySettings>
  private cachedSettingsByEnv: Map<string, SurveySettings> = new Map();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;
  // Optional factory for multi-environment mode (Edge)
  private apiClientFactory?: ApiClientFactory;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironmentId = defaultEnvironmentId;
    this.storage = storage;
  }

  /**
   * Initialize service and load data from local storage
   */
  async initializeAsync(environmentId?: string): Promise<void> {
    if (!this.storage) return;

    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    try {
      const [surveysJson, settingsJson] = await Promise.all([
        this.storage.get(`Surveys_${resolvedEnv}_data`),
        this.storage.get(`Surveys_${resolvedEnv}_settings`),
      ]);

      if (surveysJson) {
        this.cachedSurveysByEnv.set(resolvedEnv, JSON.parse(surveysJson));
      }
      if (settingsJson) {
        this.cachedSettingsByEnv.set(resolvedEnv, JSON.parse(settingsJson));
      }
      this.logger.debug('Loaded surveys from local storage', {
        environmentId: resolvedEnv,
      });
    } catch (error: any) {
      this.logger.warn('Failed to load surveys from local storage', {
        environmentId: resolvedEnv,
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
   * Set ApiClientFactory for multi-environment mode.
   * When set, API calls use the factory to get a per-environment ApiClient
   * that includes the x-environment-id header.
   */
  setApiClientFactory(factory: ApiClientFactory): void {
    this.apiClientFactory = factory;
  }

  /**
   * Get the appropriate ApiClient for a given environment.
   * Uses the factory if available, otherwise falls back to the default client.
   */
  private getApiClient(environmentId?: string): ApiClient {
    if (this.apiClientFactory) {
      return this.apiClientFactory.getClient(environmentId);
    }
    return this.apiClient;
  }

  /**
   * Get active surveys with settings for a specific environment
   * GET /api/v1/server/surveys
   */
  async listByEnvironment(
    params?: SurveyListParams,
    environmentId?: string
  ): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const endpoint = `/api/v1/server/surveys`;

    this.logger.debug('Fetching surveys', {
      environmentId: resolvedEnv,
      params,
    });

    const client = this.getApiClient(resolvedEnv);
    const response = await client.get<{
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
    this.cachedSurveysByEnv.set(resolvedEnv, surveys);
    this.cachedSettingsByEnv.set(resolvedEnv, settings);

    // Save to local storage if available
    if (this.storage) {
      await Promise.all([
        this.storage.save(
          `Surveys_${resolvedEnv}_data`,
          JSON.stringify(surveys)
        ),
        this.storage.save(
          `Surveys_${resolvedEnv}_settings`,
          JSON.stringify(settings)
        ),
      ]);
    }

    this.logger.info('Surveys fetched', {
      count: surveys.length,
      hasSettings: !!settings,
      environmentId: resolvedEnv,
    });

    return { surveys, settings };
  }

  /**
   * Get surveys for multiple environments
   */
  async listByEnvironments(
    environmentIds: string[],
    params?: SurveyListParams
  ): Promise<{ surveys: Survey[]; settings: SurveySettings | null }> {
    this.logger.debug('Fetching surveys for multiple environments', {
      environmentIds,
    });

    const allSurveys: Survey[] = [];
    let lastSettings: SurveySettings | null = null;

    for (const env of environmentIds) {
      try {
        const { surveys, settings } = await this.listByEnvironment(params, env);
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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getCached(environmentId?: string): Survey[] {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    return this.cachedSurveysByEnv.get(resolvedEnv) || [];
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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getCachedSettings(environmentId?: string): SurveySettings | null {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    return this.cachedSettingsByEnv.get(resolvedEnv) || null;
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
  clearCacheForEnvironment(environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.cachedSurveysByEnv.delete(resolvedEnv);
    this.cachedSettingsByEnv.delete(resolvedEnv);
    this.logger.debug('Surveys cache cleared for environment', {
      environmentId: resolvedEnv,
    });
  }

  /**
   * Refresh cached surveys for a specific environment
   * @param params Optional list parameters
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  async refreshByEnvironment(
    params?: SurveyListParams,
    suppressWarnings?: boolean,
    environmentId?: string
  ): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'SurveyService.refreshByEnvironment() called but feature is disabled',
        {
          environmentId: resolvedEnv,
        }
      );
    }
    this.logger.info('Refreshing surveys cache', {
      environmentId: resolvedEnv,
    });
    return await this.listByEnvironment(params, resolvedEnv);
  }

  /**
   * Get survey by ID
   * GET /api/v1/server/surveys/:id
   * @param id Survey ID
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  async getById(id: string, environmentId?: string): Promise<Survey> {
    validateAll([{ param: 'id', value: id, type: 'string' }]);
    this.logger.debug('Fetching survey by ID', { id, environmentId });

    const client = this.getApiClient(environmentId);
    const response = await client.get<{ survey: Survey }>(
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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  async refreshSettings(environmentId?: string): Promise<SurveySettings> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.logger.info('Refreshing survey settings', {
      environmentId: resolvedEnv,
    });

    const client = this.getApiClient(resolvedEnv);
    const response = await client.get<{ settings: SurveySettings }>(
      `/api/v1/server/surveys/settings`
    );

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch survey settings'
      );
    }

    const { settings } = response.data;
    const oldSettings = this.cachedSettingsByEnv.get(resolvedEnv);
    this.cachedSettingsByEnv.set(resolvedEnv, settings);

    this.logger.info('Survey settings refreshed', {
      environmentId: resolvedEnv,
      oldSettings,
      newSettings: settings,
      changed: !this.areSettingsEqual(oldSettings || null, settings),
    });

    return settings;
  }

  /**
   * Update cache with new data
   * @param surveys Surveys to cache
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  updateCache(surveys: Survey[], environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.cachedSurveysByEnv.set(resolvedEnv, surveys);
    this.logger.debug('Surveys cache updated', {
      environmentId: resolvedEnv,
      count: surveys.length,
    });
  }

  /**
   * Update a single survey in cache (immutable)
   * If isActive is false, removes the survey from cache (no API call needed)
   * If isActive is true but not in cache, fetches and adds it to cache
   * If isActive is true and in cache, fetches and updates it
   * @param id Survey ID
   * @param isActive Optional active status
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  async updateSingleSurvey(
    id: string,
    isActive?: boolean | number,
    environmentId?: string
  ): Promise<void> {
    validateAll([{ param: 'id', value: id, type: 'string' }]);
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    try {
      this.logger.debug('Updating single survey in cache', {
        id,
        environmentId: resolvedEnv,
        isActive,
      });

      // If isActive is explicitly false (0 or false), just remove from cache
      if (isActive === false || isActive === 0) {
        this.logger.info('Survey isActive=false, removing from cache', {
          id,
          environmentId: resolvedEnv,
        });
        this.removeSurvey(id, resolvedEnv);
        return;
      }

      // Otherwise, fetch from API and add/update

      // Fetch the single survey from backend using getById (instead of list)
      let updatedSurvey: Survey;
      try {
        updatedSurvey = await this.getById(id, resolvedEnv);
      } catch (_error: any) {
        // If survey not found (404), it's no longer active
        this.logger.debug(
          'Survey not found or not active, removing from cache',
          {
            id,
            environmentId: resolvedEnv,
          }
        );
        this.removeSurvey(id, resolvedEnv);
        return;
      }

      // Get current surveys for this environment
      const currentSurveys = this.cachedSurveysByEnv.get(resolvedEnv) || [];

      // Check if survey already exists in cache
      const existsInCache = currentSurveys.some((survey) => survey.id === id);

      if (existsInCache) {
        // Immutable update: update existing survey
        const newSurveys = currentSurveys.map((survey) =>
          survey.id === id ? updatedSurvey : survey
        );
        this.cachedSurveysByEnv.set(resolvedEnv, newSurveys);
        this.logger.debug('Single survey updated in cache', {
          id,
          environmentId: resolvedEnv,
        });
      } else {
        // Survey not in cache but found in backend (e.g., isActive changed from false to true)
        // Add it to cache
        const newSurveys = [...currentSurveys, updatedSurvey];
        this.cachedSurveysByEnv.set(resolvedEnv, newSurveys);
        this.logger.debug(
          'Single survey added to cache (was previously removed)',
          {
            id,
            environmentId: resolvedEnv,
          }
        );
      }
    } catch (error: any) {
      this.logger.error('Failed to update single survey in cache', {
        id,
        environmentId: resolvedEnv,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refreshByEnvironment(undefined, undefined, resolvedEnv);
    }
  }

  /**
   * Remove a survey from cache (immutable)
   * @param id Survey ID
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  removeSurvey(id: string, environmentId?: string): void {
    validateAll([{ param: 'id', value: id, type: 'string' }]);
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.logger.debug('Removing survey from cache', {
      id,
      environmentId: resolvedEnv,
    });

    const currentSurveys = this.cachedSurveysByEnv.get(resolvedEnv) || [];

    // Immutable update: create new array without the deleted survey
    const newSurveys = currentSurveys.filter((survey) => survey.id !== id);
    this.cachedSurveysByEnv.set(resolvedEnv, newSurveys);

    this.logger.debug('Survey removed from cache', {
      id,
      environmentId: resolvedEnv,
    });
  }

  /**
   * Get surveys for a specific world
   * @param worldId World ID
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getSurveysForWorld(worldId: string, environmentId?: string): Survey[] {
    validateAll([{ param: 'worldId', value: worldId, type: 'string' }]);
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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  updateSettings(newSettings: SurveySettings, environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const oldSettings = this.cachedSettingsByEnv.get(resolvedEnv);
    this.cachedSettingsByEnv.set(resolvedEnv, newSettings);

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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   * @returns Array of appropriate surveys, empty array if none match
   */
  getActiveSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number,
    environmentId?: string
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
