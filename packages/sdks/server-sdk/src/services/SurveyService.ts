/**
 * Survey Service
 * Handles survey retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/surveys
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { Survey, SurveyListParams, SurveySettings } from '../types/api';

export class SurveyService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), Survey[]>
  private cachedSurveysByEnv: Map<string, Survey[]> = new Map();
  // Multi-environment settings cache: Map<environment (environmentName), SurveySettings>
  private cachedSettingsByEnv: Map<string, SurveySettings> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Get active surveys with settings for a specific environment
   * GET /api/v1/server/:env/surveys
   */
  async listByEnvironment(environment: string, params?: SurveyListParams): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/surveys`;

    this.logger.debug('Fetching surveys', { environment, params });

    const response = await this.apiClient.get<{ surveys: Survey[]; settings: SurveySettings }>(endpoint, {
      params,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch surveys');
    }

    // response.data contains { surveys, settings }
    const { surveys, settings } = response.data;
    this.cachedSurveysByEnv.set(environment, surveys);
    this.cachedSettingsByEnv.set(environment, settings);

    this.logger.info('Surveys fetched', { count: surveys.length, hasSettings: !!settings, environment });

    return { surveys, settings };
  }

  /**
   * Get surveys for multiple environments
   */
  async listByEnvironments(environments: string[], params?: SurveyListParams): Promise<{ surveys: Survey[]; settings: SurveySettings | null }> {
    this.logger.debug('Fetching surveys for multiple environments', { environments });

    const allSurveys: Survey[] = [];
    let lastSettings: SurveySettings | null = null;

    for (const env of environments) {
      try {
        const { surveys, settings } = await this.listByEnvironment(env, params);
        allSurveys.push(...surveys);
        lastSettings = settings;
      } catch (error) {
        this.logger.error(`Failed to fetch surveys for environment ${env}`, { error });
      }
    }

    return { surveys: allSurveys, settings: lastSettings };
  }

  /**
   * Get active surveys with settings (uses default environment)
   * For backward compatibility
   */
  async list(params?: SurveyListParams): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    return this.listByEnvironment(this.defaultEnvironment, params);
  }

  /**
   * Get cached surveys
   * @param environment Environment name. If omitted, returns all surveys as flat array.
   */
  getCached(environment?: string): Survey[] {
    if (environment) {
      return this.cachedSurveysByEnv.get(environment) || [];
    }
    // No environment specified: return all surveys as flat array
    return Array.from(this.cachedSurveysByEnv.values()).flat();
  }

  /**
   * Get all cached surveys (all environments)
   */
  getAllCached(): Map<string, Survey[]> {
    return this.cachedSurveysByEnv;
  }

  /**
   * Get cached survey settings
   */
  getCachedSettings(environment?: string): SurveySettings | null {
    const envKey = environment || this.defaultEnvironment;
    return this.cachedSettingsByEnv.get(envKey) || null;
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
   * Refresh cached surveys for a specific environment
   */
  async refreshByEnvironment(environment: string, params?: SurveyListParams): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    this.logger.info('Refreshing surveys cache', { environment });
    return await this.listByEnvironment(environment, params);
  }

  /**
   * Refresh cached surveys (uses default environment)
   * For backward compatibility
   */
  async refresh(params?: SurveyListParams): Promise<{ surveys: Survey[]; settings: SurveySettings }> {
    return this.refreshByEnvironment(this.defaultEnvironment, params);
  }

  /**
   * Get survey by ID
   * GET /api/v1/server/:env/surveys/:id
   */
  async getById(id: string, environment?: string): Promise<Survey> {
    const env = environment || this.defaultEnvironment;
    this.logger.debug('Fetching survey by ID', { id, environment: env });

    const response = await this.apiClient.get<{ survey: Survey }>(`/api/v1/server/${encodeURIComponent(env)}/surveys/${id}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch survey');
    }

    this.logger.info('Survey fetched', { id });

    return response.data.survey;
  }

  /**
   * Refresh survey settings only
   * GET /api/v1/server/:env/surveys/settings
   */
  async refreshSettings(environment?: string): Promise<SurveySettings> {
    const env = environment || this.defaultEnvironment;
    this.logger.info('Refreshing survey settings', { environment: env });

    const response = await this.apiClient.get<{ settings: SurveySettings }>(`/api/v1/server/${encodeURIComponent(env)}/surveys/settings`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch survey settings');
    }

    const { settings } = response.data;
    const oldSettings = this.cachedSettingsByEnv.get(env);
    this.cachedSettingsByEnv.set(env, settings);

    this.logger.info('Survey settings refreshed', {
      environment: env,
      oldSettings,
      newSettings: settings,
      changed: !this.areSettingsEqual(oldSettings || null, settings),
    });

    return settings;
  }

  /**
   * Update cache with new data
   */
  updateCache(surveys: Survey[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.cachedSurveysByEnv.set(envKey, surveys);
    this.logger.debug('Surveys cache updated', { environment: envKey, count: surveys.length });
  }

  /**
   * Update a single survey in cache (immutable)
   * If isActive is false, removes the survey from cache (no API call needed)
   * If isActive is true but not in cache, fetches and adds it to cache
   * If isActive is true and in cache, fetches and updates it
   */
  async updateSingleSurvey(id: string, environment?: string, isActive?: boolean | number): Promise<void> {
    try {
      this.logger.debug('Updating single survey in cache', { id, environment, isActive });

      const envKey = environment || this.defaultEnvironment;

      // If isActive is explicitly false (0 or false), just remove from cache
      if (isActive === false || isActive === 0) {
        this.logger.info('Survey isActive=false, removing from cache', { id, environment: envKey });
        this.removeSurvey(id, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the single survey from backend using getById (instead of list)
      let updatedSurvey: Survey;
      try {
        updatedSurvey = await this.getById(id, environment);
      } catch (_error: any) {
        // If survey not found (404), it's no longer active
        this.logger.debug('Survey not found or not active, removing from cache', { id, environment: envKey });
        this.removeSurvey(id, environment);
        return;
      }

      // Get current surveys for this environment
      const currentSurveys = this.cachedSurveysByEnv.get(envKey) || [];

      // Check if survey already exists in cache
      const existsInCache = currentSurveys.some(survey => survey.id === id);

      if (existsInCache) {
        // Immutable update: update existing survey
        const newSurveys = currentSurveys.map(survey => survey.id === id ? updatedSurvey : survey);
        this.cachedSurveysByEnv.set(envKey, newSurveys);
        this.logger.debug('Single survey updated in cache', { id, environment: envKey });
      } else {
        // Survey not in cache but found in backend (e.g., isActive changed from false to true)
        // Add it to cache
        const newSurveys = [...currentSurveys, updatedSurvey];
        this.cachedSurveysByEnv.set(envKey, newSurveys);
        this.logger.debug('Single survey added to cache (was previously removed)', { id, environment: envKey });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single survey in cache', {
        id,
        environment,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
    }
  }

  /**
   * Remove a survey from cache (immutable)
   */
  removeSurvey(id: string, environment?: string): void {
    this.logger.debug('Removing survey from cache', { id, environment });

    const envKey = environment || this.defaultEnvironment;
    const currentSurveys = this.cachedSurveysByEnv.get(envKey) || [];

    // Immutable update: create new array without the deleted survey
    const newSurveys = currentSurveys.filter(survey => survey.id !== id);
    this.cachedSurveysByEnv.set(envKey, newSurveys);

    this.logger.debug('Survey removed from cache', { id, environment: envKey });
  }

  /**
   * Get surveys for a specific world
   */
  getSurveysForWorld(worldId: string, environment?: string): Survey[] {
    const surveys = this.getCached(environment);
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
   */
  updateSettings(newSettings: SurveySettings, environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    const oldSettings = this.cachedSettingsByEnv.get(envKey);
    this.cachedSettingsByEnv.set(envKey, newSettings);

    // Check if settings actually changed
    const settingsChanged = !this.areSettingsEqual(oldSettings || null, newSettings);

    if (settingsChanged) {
      this.logger.info('Survey settings updated', {
        environment: envKey,
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
   * @param environment Environment name (optional)
   * @returns Array of appropriate surveys, empty array if none match
   */
  getActiveSurveys(
    platform: string,
    channel: string,
    subChannel: string,
    worldId: string,
    userLevel: number,
    joinDays: number,
    environment?: string
  ): Survey[] {
    const surveys = this.getCached(environment);
    return surveys.filter((survey) => {
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
