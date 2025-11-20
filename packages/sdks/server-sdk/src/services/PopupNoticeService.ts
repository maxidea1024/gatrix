/**
 * Popup Notice Service
 * Handles in-game popup notice retrieval
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { PopupNotice } from '../types/api';

export class PopupNoticeService {
  private apiClient: ApiClient;
  private logger: Logger;
  private cachedNotices: PopupNotice[] = [];

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Get active popup notices
   * GET /api/v1/server/ingame-popup-notices
   */
  async list(): Promise<PopupNotice[]> {
    this.logger.debug('Fetching popup notices');

    const response = await this.apiClient.get<PopupNotice[]>(
      `/api/v1/server/ingame-popup-notices`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch popup notices');
    }

    const notices = response.data;
    this.cachedNotices = notices;

    this.logger.info('Popup notices fetched', { count: notices.length });

    return notices;
  }

  /**
   * Get cached popup notices (from memory)
   */
  getCached(): PopupNotice[] {
    return this.cachedNotices;
  }

  /**
   * Refresh cached popup notices
   */
  async refresh(): Promise<PopupNotice[]> {
    this.logger.info('Refreshing popup notices cache');
    return await this.list();
  }

  /**
   * Update cache with new data
   */
  updateCache(notices: PopupNotice[]): void {
    this.cachedNotices = notices;
    this.logger.debug('Popup notices cache updated', { count: notices.length });
  }

  /**
   * Update a single popup notice in cache (immutable)
   * If isVisible is false, removes the notice from cache (no API call needed)
   * If isVisible is true but not in cache, fetches and adds it to cache
   * If isVisible is true and in cache, fetches and updates it
   */
  async updateSingleNotice(id: number, isVisible?: boolean | number): Promise<void> {
    try {
      this.logger.debug('Updating single popup notice in cache', { id, isVisible });

      // If isVisible is explicitly false (0 or false), just remove from cache
      if (isVisible === false || isVisible === 0) {
        this.logger.info('Popup notice isVisible=false, removing from cache', { id });
        this.removeNotice(id);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Fetch all notices and find the updated one
      const notices = await this.list();
      const updatedNotice = notices.find(n => n.id === id);

      // If notice is not found in active notices, it means isActive is false
      // Remove it from cache
      if (!updatedNotice) {
        this.logger.debug('Popup notice is no longer active, removing from cache', { id });
        this.removeNotice(id);
        return;
      }

      // Check if notice already exists in cache
      const existsInCache = this.cachedNotices.some(notice => notice.id === id);

      if (existsInCache) {
        // Immutable update: update existing notice
        this.cachedNotices = this.cachedNotices.map(notice =>
          notice.id === id ? updatedNotice : notice
        );
        this.logger.debug('Single popup notice updated in cache', { id });
      } else {
        // Notice not in cache but found in backend (e.g., isActive changed from false to true)
        // Add it to cache
        this.cachedNotices = [...this.cachedNotices, updatedNotice];
        this.logger.debug('Single popup notice added to cache (was previously removed)', { id });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single popup notice in cache', {
        id,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
    }
  }

  /**
   * Remove a popup notice from cache (immutable)
   */
  removeNotice(id: number): void {
    this.logger.debug('Removing popup notice from cache', { id });

    // Immutable update: create new array without the deleted notice
    this.cachedNotices = this.cachedNotices.filter(notice => notice.id !== id);

    this.logger.debug('Popup notice removed from cache', { id });
  }

  /**
   * Get active notices for a specific world
   */
  getNoticesForWorld(worldId: string): PopupNotice[] {
    return this.cachedNotices.filter((notice) => {
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
  }): PopupNotice[] {
    const now = new Date();
    const { platform, channel, subChannel, worldId, userId } = options ?? {};

    const filtered = this.cachedNotices.filter((notice) => {
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

