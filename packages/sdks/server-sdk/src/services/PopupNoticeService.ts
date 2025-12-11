/**
 * Popup Notice Service
 * Handles in-game popup notice retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/ingame-popup-notices
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { PopupNotice } from '../types/api';

export class PopupNoticeService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), PopupNotice[]>
  private cachedNoticesByEnv: Map<string, PopupNotice[]> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Get popup notices for a specific environment
   * GET /api/v1/server/:env/ingame-popup-notices
   */
  async listByEnvironment(environment: string): Promise<PopupNotice[]> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/ingame-popup-notices`;

    this.logger.debug('Fetching popup notices', { environment });

    const response = await this.apiClient.get<PopupNotice[]>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch popup notices');
    }

    const notices = response.data;
    this.cachedNoticesByEnv.set(environment, notices);

    this.logger.info('Popup notices fetched', { count: notices.length, environment });

    return notices;
  }

  /**
   * Get popup notices for multiple environments
   * Fetches each environment separately and caches results
   */
  async listByEnvironments(environments: string[]): Promise<PopupNotice[]> {
    this.logger.debug('Fetching popup notices for multiple environments', { environments });

    const results: PopupNotice[] = [];

    for (const env of environments) {
      try {
        const notices = await this.listByEnvironment(env);
        results.push(...notices);
      } catch (error) {
        this.logger.error(`Failed to fetch popup notices for environment ${env}`, { error });
      }
    }

    this.logger.info('Popup notices fetched for all environments', {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Get active popup notices (uses default environment for single-env mode)
   * For backward compatibility
   */
  async list(): Promise<PopupNotice[]> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached popup notices
   * @param environment Environment name. If omitted, returns all notices as flat array.
   */
  getCached(environment?: string): PopupNotice[] {
    if (environment) {
      return this.cachedNoticesByEnv.get(environment) || [];
    }
    // No environment specified: return all notices as flat array
    return Array.from(this.cachedNoticesByEnv.values()).flat();
  }

  /**
   * Get all cached popup notices (all environments)
   */
  getAllCached(): Map<string, PopupNotice[]> {
    return this.cachedNoticesByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedNoticesByEnv.clear();
    this.logger.debug('Popup notices cache cleared');
  }

  /**
   * Refresh cached popup notices for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<PopupNotice[]> {
    this.logger.info('Refreshing popup notices cache', { environment });
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached popup notices (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<PopupNotice[]> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get popup notice by ID
   * GET /api/v1/server/:env/ingame-popup-notices/:id
   */
  async getById(id: number, environment?: string): Promise<PopupNotice> {
    const env = environment || this.defaultEnvironment;
    this.logger.debug('Fetching popup notice by ID', { id, environment: env });

    const response = await this.apiClient.get<{ notice: PopupNotice }>(`/api/v1/server/${encodeURIComponent(env)}/ingame-popup-notices/${id}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch popup notice');
    }

    this.logger.info('Popup notice fetched', { id });

    return response.data.notice;
  }

  /**
   * Update cache with new data
   */
  updateCache(notices: PopupNotice[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.cachedNoticesByEnv.set(envKey, notices);
    this.logger.debug('Popup notices cache updated', { environment: envKey, count: notices.length });
  }

  /**
   * Update a single popup notice in cache (immutable)
   * If isVisible is false, removes the notice from cache (no API call needed)
   * If isVisible is true but not in cache, fetches and adds it to cache
   * If isVisible is true and in cache, fetches and updates it
   */
  async updateSingleNotice(id: number, environment?: string, isVisible?: boolean | number): Promise<void> {
    try {
      this.logger.debug('Updating single popup notice in cache', { id, environment, isVisible });

      const envKey = environment || this.defaultEnvironment;

      // If isVisible is explicitly false (0 or false), just remove from cache
      if (isVisible === false || isVisible === 0) {
        this.logger.info('Popup notice isVisible=false, removing from cache', { id, environment: envKey });
        this.removeNotice(id, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the single notice from backend using getById (instead of list)
      let updatedNotice: PopupNotice;
      try {
        updatedNotice = await this.getById(id, environment);
      } catch (_error: any) {
        // If notice not found (404), it's no longer active or visible
        this.logger.debug('Popup notice not found or not active, removing from cache', { id, environment: envKey });
        this.removeNotice(id, environment);
        return;
      }

      // Get current notices for this environment
      const currentNotices = this.cachedNoticesByEnv.get(envKey) || [];

      // Check if notice already exists in cache
      const existsInCache = currentNotices.some(notice => notice.id === id);

      if (existsInCache) {
        // Immutable update: update existing notice
        const newNotices = currentNotices.map(notice => notice.id === id ? updatedNotice : notice);
        this.cachedNoticesByEnv.set(envKey, newNotices);
        this.logger.debug('Single popup notice updated in cache', { id, environment: envKey });
      } else {
        // Notice not in cache but found in backend (e.g., isActive changed from false to true)
        // Add it to cache
        const newNotices = [...currentNotices, updatedNotice];
        this.cachedNoticesByEnv.set(envKey, newNotices);
        this.logger.debug('Single popup notice added to cache (was previously removed)', { id, environment: envKey });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single popup notice in cache', {
        id,
        environment,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
    }
  }

  /**
   * Remove a popup notice from cache (immutable)
   */
  removeNotice(id: number, environment?: string): void {
    this.logger.debug('Removing popup notice from cache', { id, environment });

    const envKey = environment || this.defaultEnvironment;
    const currentNotices = this.cachedNoticesByEnv.get(envKey) || [];

    // Immutable update: create new array without the deleted notice
    const newNotices = currentNotices.filter(notice => notice.id !== id);
    this.cachedNoticesByEnv.set(envKey, newNotices);

    this.logger.debug('Popup notice removed from cache', { id, environment: envKey });
  }

  /**
   * Get active notices for a specific world
   */
  getNoticesForWorld(worldId: string, environment?: string): PopupNotice[] {
    const notices = this.getCached(environment);
    return notices.filter((notice) => {
      if (!notice.targetWorlds || notice.targetWorlds.length === 0) {
        return true; // No targeting = show to all
      }
      return notice.targetWorlds.includes(worldId);
    });
  }

  /**
   * Get active popup notices that are currently visible for the given context
   * Filters by date range (startDate/endDate) and targeting fields
   * Sorted by displayPriority (ascending, lower values mean higher priority)
   * @returns Array of active popup notices, empty array if none match
   */
  getActivePopupNotices(options?: {
    platform?: string;
    channel?: string;
    subChannel?: string;
    worldId?: string;
    userId?: string;
    environment?: string;
  }): PopupNotice[] {
    const now = new Date();
    const { platform, channel, subChannel, worldId, userId, environment } = options ?? {};

    const notices = this.getCached(environment);
    const filtered = notices.filter((notice) => {
      // Check startDate: if set, current time must be after startDate
      if (notice.startDate) {
        const startDate = new Date(notice.startDate);
        if (now < startDate) {
          return false;
        }
      }

      // Check endDate: if set, current time must be before endDate
      if (notice.endDate) {
        const endDate = new Date(notice.endDate);
        if (now > endDate) {
          return false;
        }
      }

      // Platform targeting
      if (platform && notice.targetPlatforms && notice.targetPlatforms.length > 0) {
        const isInPlatformList = notice.targetPlatforms.includes(platform);
        const inverted = Boolean(notice.targetPlatformsInverted);
        if (inverted ? isInPlatformList : !isInPlatformList) {
          return false;
        }
      }

      // Channel targeting
      if (channel && notice.targetChannels && notice.targetChannels.length > 0) {
        const isInChannelList = notice.targetChannels.includes(channel);
        const inverted = Boolean(notice.targetChannelsInverted);
        if (inverted ? isInChannelList : !isInChannelList) {
          return false;
        }
      }

      // Subchannel targeting (format: channel:subchannel)
      if (
        channel &&
        subChannel &&
        notice.targetSubchannels &&
        notice.targetSubchannels.length > 0
      ) {
        const subchannelKey = `${channel}:${subChannel}`;
        const isInSubchannelList = notice.targetSubchannels.includes(subchannelKey);
        const inverted = Boolean(notice.targetSubchannelsInverted);
        if (inverted ? isInSubchannelList : !isInSubchannelList) {
          return false;
        }
      }

      // World targeting
      if (worldId && notice.targetWorlds && notice.targetWorlds.length > 0) {
        const isInWorldList = notice.targetWorlds.includes(worldId);
        const inverted = Boolean(notice.targetWorldsInverted);
        if (inverted ? isInWorldList : !isInWorldList) {
          return false;
        }
      }

      // User targeting
      if (userId && notice.targetUserIds) {
        const userIdList = Array.isArray(notice.targetUserIds)
          ? notice.targetUserIds
          : String(notice.targetUserIds)
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id);

        if (userIdList.length > 0) {
          const isInUserList = userIdList.includes(userId);
          const inverted = Boolean(notice.targetUserIdsInverted);
          if (inverted ? isInUserList : !isInUserList) {
            return false;
          }
        }
      }

      return true;
    });

    return filtered.sort((a, b) => a.displayPriority - b.displayPriority);
  }
}

