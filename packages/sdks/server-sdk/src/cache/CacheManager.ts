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
import { ServiceMaintenanceService } from '../services/ServiceMaintenanceService';
import { ApiClient } from '../client/ApiClient';
import { SdkMetrics } from '../utils/sdkMetrics';
import { MaintenanceStatus } from '../types/api';
import { sleep } from '../utils/time';
import { MaintenanceWatcher, MaintenanceEventCallback } from './MaintenanceWatcher';

export class CacheManager {
  private logger: Logger;
  private config: CacheConfig;
  private gameWorldService: GameWorldService;
  private popupNoticeService: PopupNoticeService;
  private surveyService: SurveyService;
  private whitelistService: WhitelistService;
  private serviceMaintenanceService: ServiceMaintenanceService;
  private apiClient: ApiClient;
  private refreshInterval?: NodeJS.Timeout;
  private refreshCallbacks: Array<(type: string, data: any) => void> = [];
  private metrics?: SdkMetrics;
  private maintenanceWatcher: MaintenanceWatcher;

  constructor(
    config: CacheConfig,
    gameWorldService: GameWorldService,
    popupNoticeService: PopupNoticeService,
    surveyService: SurveyService,
    whitelistService: WhitelistService,
    serviceMaintenanceService: ServiceMaintenanceService,
    apiClient: ApiClient,
    logger: Logger,
    metrics?: SdkMetrics,
    configWorldId?: string
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
    this.serviceMaintenanceService = serviceMaintenanceService;
    this.apiClient = apiClient;
    this.logger = logger;
    this.metrics = metrics;
    this.maintenanceWatcher = new MaintenanceWatcher(logger, configWorldId);
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
   * Register callback for maintenance state change events
   * Returns a function to unregister the callback
   */
  onMaintenanceChange(callback: MaintenanceEventCallback): () => void {
    return this.maintenanceWatcher.onMaintenanceChange(callback);
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
        this.surveyService.list({ isActive: true }).catch((_error) => {
          return { surveys: [], settings: null };
        }),
        this.whitelistService.list().catch((error) => {
          this.logger.warn('Failed to load whitelists', { error: error.message });
          return { ipWhitelist: [], accountWhitelist: [] };
        }),
        this.refreshServiceMaintenanceInternal().catch((error) => {
          this.logger.warn('Failed to load service maintenance status', { error: error.message });
        }),
      ]);

      // Initialize maintenance watcher with current state (no events emitted on first check)
      this.checkMaintenanceStateChanges();

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
          this.logger.info('Gatrix backend is ready');
          return;
        }
      } catch (_error: any) {
        // Silently continue on connection errors during startup
      }

      if (attempt === maxAttempts) {
        this.logger.error('Gatrix backend is not ready after maximum attempts', {
          attempts: maxAttempts,
          totalTime: `${maxAttempts * retryInterval / 1000}s`,
        });
        throw new Error('Gatrix backend failed to become ready within timeout period');
      }

      // Wait before retrying
      await sleep(retryInterval);
    }
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
        this.refreshServiceMaintenanceInternal().catch((error) => {
          this.logger.warn('Failed to refresh service maintenance', { error: error.message });
        }),
      ]);

      try {
        const duration = Number(process.hrtime.bigint() - start) / 1e9;
        this.metrics?.incRefresh('all');
        this.metrics?.observeRefresh('all', duration);
        this.metrics?.setLastRefresh('all');
      } catch (_) {}

      this.logger.info('All caches refreshed successfully');

      // Check and emit maintenance state changes
      this.checkMaintenanceStateChanges();

      // Emit refresh events for polling method
      if (this.config.refreshMethod === 'polling') {
        this.emitRefreshEvent('cache.refreshed', {
          timestamp: new Date().toISOString(),
          types: ['gameworld', 'popup', 'survey', 'whitelist', 'serviceMaintenance'],
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
   * Also checks and emits maintenance state change events
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
    // Check maintenance state changes after refresh
    this.checkMaintenanceStateChanges();
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
   * Also checks and emits maintenance state change events
   */
  async updateSingleGameWorld(id: number, isVisible?: boolean | number): Promise<void> {
    await this.gameWorldService.updateSingleWorld(id, isVisible);
    // Check maintenance state changes after update
    this.checkMaintenanceStateChanges();
  }

  /**
   * Get all cached data (game worlds, popup notices, surveys)
   */
  getAllCachedData(): any {
    return {
      gameWorlds: this.gameWorldService.getCached(),
      popupNotices: this.popupNoticeService.getCached(),
      surveys: this.surveyService.getCached(),
      whitelists: this.whitelistService.getCached(),
      serviceMaintenance: this.serviceMaintenanceService.getCached(),
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
  getWhitelists() {
    return this.whitelistService.getCached();
  }

  /**
   * Internal service maintenance refresh (without maintenance state check)
   * Used by refreshAll() to avoid duplicate state checks
   */
  private async refreshServiceMaintenanceInternal(): Promise<void> {
    this.logger.info('Refreshing service maintenance cache...');
    const start = process.hrtime.bigint();
    try {
      const status = await this.serviceMaintenanceService.refresh();
      this.emitRefreshEvent('serviceMaintenance', status);
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      try {
        this.metrics?.incRefresh('serviceMaintenance');
        this.metrics?.observeRefresh('serviceMaintenance', duration);
        this.metrics?.setLastRefresh('serviceMaintenance');
      } catch (_) {}
    } catch (error: any) {
      this.logger.warn('Failed to refresh service maintenance status', { error: error.message });
    }
  }

  /**
   * Refresh service maintenance status
   * Also checks and emits maintenance state change events
   */
  async refreshServiceMaintenance(): Promise<void> {
    await this.refreshServiceMaintenanceInternal();
    // Check maintenance state changes after refresh
    this.checkMaintenanceStateChanges();
  }

  /**
   * Check and emit maintenance state change events
   * Compares current state with previous state and emits events if changed
   */
  private checkMaintenanceStateChanges(): void {
    try {
      const serviceStatus = this.serviceMaintenanceService.getCached();
      const gameWorlds = this.gameWorldService.getCached();
      this.maintenanceWatcher.checkAndEmitChanges(serviceStatus, gameWorlds);
    } catch (error: any) {
      this.logger.error('Error checking maintenance state changes', { error: error.message });
    }
  }

  /**
   * Get cached service maintenance status
   */
  getServiceMaintenanceStatus(): MaintenanceStatus | null {
    return this.serviceMaintenanceService.getCached();
  }

  /**
   * Get actual start time for service maintenance
   * Used by getMaintenanceInfo() to provide actualStartTime to clients
   */
  getServiceMaintenanceActualStartTime(): string | undefined {
    const state = this.maintenanceWatcher.getCurrentState();
    return state?.serviceActualStartTime;
  }

  /**
   * Get actual start time for world maintenance
   * @param worldId The world ID to check
   */
  getWorldMaintenanceActualStartTime(worldId: string): string | undefined {
    const state = this.maintenanceWatcher.getCurrentState();
    return state?.worldActualStartTimes.get(worldId);
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
    this.serviceMaintenanceService.updateCache(null);
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
