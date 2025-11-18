/**
 * Cache Manager
 * Manages in-memory caching for game worlds, popup notices, and surveys
 */

import { Logger } from '../utils/logger';
import { CacheConfig } from '../types/config';
import { GameWorldService } from '../services/GameWorldService';
import { PopupNoticeService } from '../services/PopupNoticeService';
import { SurveyService } from '../services/SurveyService';
import { WhitelistService } from '../services/WhitelistService';
import { ApiClient } from '../client/ApiClient';
import { SdkMetrics } from '../utils/sdkMetrics';

export interface MaintenanceDetail {
  type: 'regular' | 'emergency';
  startsAt: string | null;
  endsAt: string | null;
  message: string;
  localeMessages?: { ko?: string; en?: string; zh?: string };
  kickExistingPlayers?: boolean;
  kickDelayMinutes?: number;
}

export interface MaintenanceStatus {
  isUnderMaintenance: boolean;
  detail: MaintenanceDetail | null;
}

export class CacheManager {
  private logger: Logger;
  private config: CacheConfig;
  private gameWorldService: GameWorldService;
  private popupNoticeService: PopupNoticeService;
  private surveyService: SurveyService;
  private whitelistService: WhitelistService;
  private apiClient: ApiClient;
  private refreshInterval?: NodeJS.Timeout;
  private refreshCallbacks: Array<(type: string, data: any) => void> = [];
  private metrics?: SdkMetrics;
  private cachedMaintenance: MaintenanceStatus | null = null;

  constructor(
    config: CacheConfig,
    gameWorldService: GameWorldService,
    popupNoticeService: PopupNoticeService,
    surveyService: SurveyService,
    whitelistService: WhitelistService,
    apiClient: ApiClient,
    logger: Logger,
    metrics?: SdkMetrics
  ) {
    this.config = {
      enabled: config.enabled !== false,
      ttl: config.ttl || 300,
      refreshMethod: config.refreshMethod ?? 'polling', // Default: polling
    };
    this.gameWorldService = gameWorldService;
    this.popupNoticeService = popupNoticeService;
    this.surveyService = surveyService;
    this.whitelistService = whitelistService;
    this.apiClient = apiClient;
    this.logger = logger;
    this.metrics = metrics;
  }

  /**
   * Register callback for cache refresh events
   * Returns a function to unregister the callback
   */
  onRefresh(callback: (type: string, data: any) => void): () => void {
    this.refreshCallbacks.push(callback);

    // Return a function to unregister this specific callback
    return () => {
      this.refreshCallbacks = this.refreshCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Emit refresh event to all registered callbacks
   */
  private emitRefreshEvent(type: string, data: any): void {
    for (const callback of this.refreshCallbacks) {
      try {
        callback(type, data);
      } catch (error: any) {
        this.logger.error('Error in refresh callback', { error: error.message });
      }
    }
  }

  /**
   * Initialize cache by loading all data with retry logic
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Cache is disabled');
      return;
    }

    try {
      // Wait for backend to be ready with retry logic
      await this.waitForBackendReady();

      // Load all data in parallel
      await Promise.all([
        this.gameWorldService.list(),
        this.popupNoticeService.list(),
        // Note: Survey endpoint might need admin auth, handle gracefully
        this.surveyService.list({ isActive: true }).catch((error) => {
          return { surveys: [], settings: null };
        }),
        this.whitelistService.list().catch((error) => {
          this.logger.warn('Failed to load whitelists', { error: error.message });
          return { ipWhitelist: [], accountWhitelist: [] };
        }),
        this.refreshMaintenance().catch((error) => {
          this.logger.warn('Failed to load maintenance status', { error: error.message });
        }),
      ]);

      this.logger.info('SDK cache initialized');

      // Setup auto-refresh if using polling method
      if (this.config.refreshMethod === 'polling' && this.config.ttl) {
        this.startAutoRefresh();
      }
    } catch (error: any) {
      this.logger.error('Failed to initialize cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Wait for backend to be ready with retry logic
   * Attempts to connect for up to 30 seconds using /api/v1/ready endpoint
   */
  private async waitForBackendReady(): Promise<void> {
    const maxAttempts = 60; // 30 seconds with 500ms interval
    const retryInterval = 500; // milliseconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check backend ready status via dedicated endpoint
        const response = await this.apiClient.get<{ status: string }>('/api/v1/ready');

        if (response.success && response.data?.status === 'ready') {
          this.logger.info('Backend is ready');
          return;
        }
      } catch (error: any) {
        // Silently continue on connection errors during startup
      }

      if (attempt === maxAttempts) {
        this.logger.error('Backend is not ready after maximum attempts', {
          attempts: maxAttempts,
          totalTime: `${maxAttempts * retryInterval / 1000}s`,
        });
        throw new Error('Backend failed to become ready within timeout period');
      }

      // Wait before retrying
      await this.sleep(retryInterval);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Start auto-refresh interval
   */
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    const intervalMs = (this.config.ttl || 300) * 1000;

    this.refreshInterval = setInterval(async () => {
      this.logger.debug('Auto-refreshing cache...');
      await this.refreshAll();
    }, intervalMs);

    this.logger.info('Auto-refresh started', { intervalMs });
  }

  /**
   * Stop auto-refresh interval
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      this.logger.info('Auto-refresh stopped');
    }
  }

  /**
   * Refresh all cached data
   */
  async refreshAll(): Promise<void> {
    this.logger.info('Refreshing all caches...');

    const start = process.hrtime.bigint();
    try {
      await Promise.all([
        this.gameWorldService.refresh(),
        this.popupNoticeService.refresh(),
        this.surveyService.refresh({ isActive: true }).catch((error) => {
          this.logger.warn('Failed to refresh surveys', { error: error.message });
        }),
        this.whitelistService.refresh().catch((error) => {
          this.logger.warn('Failed to refresh whitelists', { error: error.message });
        }),
        this.refreshMaintenance().catch((error) => {
          this.logger.warn('Failed to refresh maintenance', { error: error.message });
        }),
      ]);

      try {
        const duration = Number(process.hrtime.bigint() - start) / 1e9;
        this.metrics?.incRefresh('all');
        this.metrics?.observeRefresh('all', duration);
        this.metrics?.setLastRefresh('all');
      } catch (_) {}

      this.logger.info('All caches refreshed successfully');

      // Emit refresh events for polling method
      if (this.config.refreshMethod === 'polling') {
        this.emitRefreshEvent('cache.refreshed', {
          timestamp: new Date().toISOString(),
          types: ['gameworld', 'popup', 'survey', 'whitelist', 'maintenance'],
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to refresh caches', { error: error.message });
      try { this.metrics?.incError('cache', 'refreshAll'); } catch (_) {}
      throw error;
    }
  }

  /**
   * Refresh game worlds cache
   */
  async refreshGameWorlds(): Promise<void> {
    const start = process.hrtime.bigint();
    await this.gameWorldService.refresh();
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('gameworlds');
      this.metrics?.observeRefresh('gameworlds', duration);
      this.metrics?.setLastRefresh('gameworlds');
    } catch (_) {}
  }

  /**
   * Refresh popup notices cache
   */
  async refreshPopupNotices(): Promise<void> {
    const start = process.hrtime.bigint();
    await this.popupNoticeService.refresh();
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('popups');
      this.metrics?.observeRefresh('popups', duration);
      this.metrics?.setLastRefresh('popups');
    } catch (_) {}
  }

  /**
   * Refresh surveys cache
   */
  async refreshSurveys(): Promise<void> {
    const start = process.hrtime.bigint();
    await this.surveyService.refresh({ isActive: true });
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('surveys');
      this.metrics?.observeRefresh('surveys', duration);
      this.metrics?.setLastRefresh('surveys');
    } catch (_) {}
  }

  /**
   * Refresh survey settings only
   */
  async refreshSurveySettings(): Promise<void> {
    await this.surveyService.refreshSettings();
  }

  /**
   * Update a single game world in cache (immutable)
   */
  async updateSingleGameWorld(id: number, isVisible?: boolean | number): Promise<void> {
    await this.gameWorldService.updateSingleWorld(id, isVisible);
  }

  /**
   * Get all cached data (game worlds, popup notices, surveys)
   */
  getAllCachedData(): any {
    return {
      gameWorlds: this.gameWorldService.getCached(),
      popupNotices: this.popupNoticeService.getCached(),
      surveys: this.surveyService.getCached(),
    };
  }

  /**
   * Get cached game worlds
   */
  getGameWorlds(): any[] {
    return this.gameWorldService.getCached();
  }

  /**
   * Remove a game world from cache (immutable)
   */
  removeGameWorld(id: number): void {
    this.gameWorldService.removeWorld(id);
  }

  /**
   * Update a single popup notice in cache (immutable)
   */
  async updateSinglePopupNotice(id: number, isVisible?: boolean | number): Promise<void> {
    await this.popupNoticeService.updateSingleNotice(id, isVisible);
  }

  /**
   * Remove a popup notice from cache (immutable)
   */
  removePopupNotice(id: number): void {
    this.popupNoticeService.removeNotice(id);
  }

  /**
   * Update a single survey in cache (immutable)
   */
  async updateSingleSurvey(id: string, isActive?: boolean | number): Promise<void> {
    await this.surveyService.updateSingleSurvey(id, isActive);
  }

  /**
   * Remove a survey from cache (immutable)
   */
  removeSurvey(id: string): void {
    this.surveyService.removeSurvey(id);
  }

  /**
   * Refresh whitelist cache only
   */
  async refreshWhitelists(): Promise<void> {
    this.logger.info('Refreshing whitelist cache...');
    const start = process.hrtime.bigint();
    await this.whitelistService.refresh();
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics?.incRefresh('whitelists');
      this.metrics?.observeRefresh('whitelists', duration);
      this.metrics?.setLastRefresh('whitelists');
    } catch (_) {}
  }

  /**
   * Get cached whitelists
   */
  getCachedWhitelists() {
    return this.whitelistService.getCached();
  }

  /**
   * Refresh maintenance status
   */
  async refreshMaintenance(): Promise<void> {
    this.logger.info('Refreshing maintenance cache...');
    const start = process.hrtime.bigint();
    try {
      const response = await this.apiClient.get<MaintenanceStatus>('/api/v1/server/maintenance');
      if (response.success && response.data) {
        this.cachedMaintenance = response.data;
        this.emitRefreshEvent('maintenance', response.data);
      }
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      try {
        this.metrics?.incRefresh('maintenance');
        this.metrics?.observeRefresh('maintenance', duration);
        this.metrics?.setLastRefresh('maintenance');
      } catch (_) {}
    } catch (error: any) {
      this.logger.warn('Failed to refresh maintenance status', { error: error.message });
    }
  }

  /**
   * Get cached maintenance status
   */
  getCachedMaintenance(): MaintenanceStatus | null {
    return this.cachedMaintenance;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.logger.info('Clearing all caches');
    this.gameWorldService.updateCache([]);
    this.popupNoticeService.updateCache([]);
    this.surveyService.updateCache([]);
    this.whitelistService.updateCache({ ipWhitelist: [], accountWhitelist: [] });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.clear();
    this.logger.info('Cache manager destroyed');
  }
}

