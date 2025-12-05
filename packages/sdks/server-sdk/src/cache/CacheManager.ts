/**
 * Cache Manager
 * Manages in-memory caching for game worlds, popup notices, surveys, and Edge-specific data
 */

import { Logger } from '../utils/logger';
import { CacheConfig, FeaturesConfig } from '../types/config';
import { GameWorldService } from '../services/GameWorldService';
import { PopupNoticeService } from '../services/PopupNoticeService';
import { SurveyService } from '../services/SurveyService';
import { WhitelistService } from '../services/WhitelistService';
import { ServiceMaintenanceService } from '../services/ServiceMaintenanceService';
import { ClientVersionService } from '../services/ClientVersionService';
import { ServiceNoticeService } from '../services/ServiceNoticeService';
import { BannerService } from '../services/BannerService';
import { ApiClient } from '../client/ApiClient';
import { SdkMetrics } from '../utils/sdkMetrics';
import { MaintenanceStatus, ClientVersion, ServiceNotice, Banner } from '../types/api';
import { sleep } from '../utils/time';
import { MaintenanceWatcher, MaintenanceEventCallback } from './MaintenanceWatcher';

export class CacheManager {
  private logger: Logger;
  private config: CacheConfig;
  private features: FeaturesConfig;
  private gameWorldService: GameWorldService;
  private popupNoticeService: PopupNoticeService;
  private surveyService: SurveyService;
  private whitelistService: WhitelistService;
  private serviceMaintenanceService: ServiceMaintenanceService;
  // New services for Edge
  private clientVersionService?: ClientVersionService;
  private serviceNoticeService?: ServiceNoticeService;
  private bannerService?: BannerService;
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
    configWorldId?: string,
    features?: FeaturesConfig,
    environments?: string[],
    // New services for Edge (created internally if enabled)
    clientVersionService?: ClientVersionService,
    serviceNoticeService?: ServiceNoticeService,
    bannerService?: BannerService
  ) {
    this.config = {
      enabled: config.enabled !== false,
      ttl: config.ttl || 300,
      refreshMethod: config.refreshMethod ?? 'polling', // Default: polling
    };
    this.features = features || {};
    this.gameWorldService = gameWorldService;
    this.popupNoticeService = popupNoticeService;
    this.surveyService = surveyService;
    this.whitelistService = whitelistService;
    this.serviceMaintenanceService = serviceMaintenanceService;

    // Create new services if enabled (with environments support)
    const targetEnvs = environments || [];
    if (this.features.clientVersion === true) {
      this.clientVersionService = clientVersionService || new ClientVersionService(apiClient, logger, targetEnvs);
    }
    if (this.features.serviceNotice === true) {
      this.serviceNoticeService = serviceNoticeService || new ServiceNoticeService(apiClient, logger, targetEnvs);
    }
    if (this.features.banner === true) {
      this.bannerService = bannerService || new BannerService(apiClient, logger, targetEnvs);
    }

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
   * Respects features config for conditional loading
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Cache is disabled');
      return;
    }

    try {
      // Wait for backend to be ready with retry logic
      await this.waitForBackendReady();

      // Build list of promises based on enabled features
      const promises: Promise<any>[] = [];
      const featureTypes: string[] = [];

      // Existing features - default: true (backward compatible)
      // Use !== false check to maintain backward compatibility
      if (this.features.gameWorld !== false) {
        promises.push(this.gameWorldService.list());
        featureTypes.push('gameWorld');
      }

      if (this.features.popupNotice !== false) {
        promises.push(this.popupNoticeService.list());
        featureTypes.push('popupNotice');
      }

      if (this.features.survey !== false) {
        promises.push(
          this.surveyService.list({ isActive: true }).catch((_error) => {
            return { surveys: [], settings: null };
          })
        );
        featureTypes.push('survey');
      }

      if (this.features.whitelist !== false) {
        promises.push(
          this.whitelistService.list().catch((error) => {
            this.logger.warn('Failed to load whitelists', { error: error.message });
            return { ipWhitelist: [], accountWhitelist: [] };
          })
        );
        featureTypes.push('whitelist');
      }

      if (this.features.serviceMaintenance !== false) {
        promises.push(
          this.refreshServiceMaintenanceInternal().catch((error) => {
            this.logger.warn('Failed to load service maintenance status', { error: error.message });
          })
        );
        featureTypes.push('serviceMaintenance');
      }

      // New features for Edge - default: false (explicit enable required)
      if (this.features.clientVersion === true && this.clientVersionService) {
        promises.push(
          this.clientVersionService.list().catch((error) => {
            this.logger.warn('Failed to load client versions', { error: error.message });
            return [];
          })
        );
        featureTypes.push('clientVersion');
      }

      if (this.features.serviceNotice === true && this.serviceNoticeService) {
        promises.push(
          this.serviceNoticeService.list().catch((error) => {
            this.logger.warn('Failed to load service notices', { error: error.message });
            return [];
          })
        );
        featureTypes.push('serviceNotice');
      }

      if (this.features.banner === true && this.bannerService) {
        promises.push(
          this.bannerService.list().catch((error) => {
            this.logger.warn('Failed to load banners', { error: error.message });
            return [];
          })
        );
        featureTypes.push('banner');
      }

      // Load all enabled features in parallel
      await Promise.all(promises);

      this.logger.info('SDK cache initialized', { enabledFeatures: featureTypes });

      // Initialize maintenance watcher with current state (no events emitted on first check)
      if (this.features.serviceMaintenance !== false || this.features.gameWorld !== false) {
        this.checkMaintenanceStateChanges();
      }

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
   * Refresh all cached data based on enabled features
   */
  async refreshAll(): Promise<void> {
    this.logger.info('Refreshing all caches...');

    const start = process.hrtime.bigint();
    try {
      const promises: Promise<any>[] = [];
      const refreshedTypes: string[] = [];

      // Existing features - default: true (backward compatible)
      if (this.features.gameWorld !== false) {
        promises.push(this.gameWorldService.refresh());
        refreshedTypes.push('gameWorld');
      }

      if (this.features.popupNotice !== false) {
        promises.push(this.popupNoticeService.refresh());
        refreshedTypes.push('popupNotice');
      }

      if (this.features.survey !== false) {
        promises.push(
          this.surveyService.refresh({ isActive: true }).catch((error) => {
            this.logger.warn('Failed to refresh surveys', { error: error.message });
          })
        );
        refreshedTypes.push('survey');
      }

      if (this.features.whitelist !== false) {
        promises.push(
          this.whitelistService.refresh().catch((error) => {
            this.logger.warn('Failed to refresh whitelists', { error: error.message });
          })
        );
        refreshedTypes.push('whitelist');
      }

      if (this.features.serviceMaintenance !== false) {
        promises.push(
          this.refreshServiceMaintenanceInternal().catch((error) => {
            this.logger.warn('Failed to refresh service maintenance', { error: error.message });
          })
        );
        refreshedTypes.push('serviceMaintenance');
      }

      // New features for Edge - default: false (explicit enable required)
      if (this.features.clientVersion === true && this.clientVersionService) {
        promises.push(
          this.clientVersionService.refresh().catch((error) => {
            this.logger.warn('Failed to refresh client versions', { error: error.message });
          })
        );
        refreshedTypes.push('clientVersion');
      }

      if (this.features.serviceNotice === true && this.serviceNoticeService) {
        promises.push(
          this.serviceNoticeService.refresh().catch((error) => {
            this.logger.warn('Failed to refresh service notices', { error: error.message });
          })
        );
        refreshedTypes.push('serviceNotice');
      }

      if (this.features.banner === true && this.bannerService) {
        promises.push(
          this.bannerService.refresh().catch((error) => {
            this.logger.warn('Failed to refresh banners', { error: error.message });
          })
        );
        refreshedTypes.push('banner');
      }

      await Promise.all(promises);

      try {
        const duration = Number(process.hrtime.bigint() - start) / 1e9;
        this.metrics?.incRefresh('all');
        this.metrics?.observeRefresh('all', duration);
        this.metrics?.setLastRefresh('all');
      } catch (_) {}

      this.logger.info('All caches refreshed successfully', { types: refreshedTypes });

      // Check and emit maintenance state changes
      if (this.features.serviceMaintenance !== false || this.features.gameWorld !== false) {
        this.checkMaintenanceStateChanges();
      }

      // Emit refresh events for polling method
      if (this.config.refreshMethod === 'polling') {
        this.emitRefreshEvent('cache.refreshed', {
          timestamp: new Date().toISOString(),
          types: refreshedTypes,
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

  // ==================== NEW SERVICE GETTERS (Edge features) ====================

  /**
   * Get cached client versions
   * @param environmentId Only used in multi-environment mode (Edge)
   */
  getClientVersions(environmentId?: string): ClientVersion[] {
    return this.clientVersionService?.getCached(environmentId) || [];
  }

  /**
   * Get cached service notices
   * @param environmentId Only used in multi-environment mode (Edge)
   */
  getServiceNotices(environmentId?: string): ServiceNotice[] {
    return this.serviceNoticeService?.getCached(environmentId) || [];
  }

  /**
   * Get cached banners
   * @param environmentId Only used in multi-environment mode (Edge)
   */
  getBanners(environmentId?: string): Banner[] {
    return this.bannerService?.getCached(environmentId) || [];
  }

  /**
   * Get ClientVersionService instance (for advanced usage)
   */
  getClientVersionService(): ClientVersionService | undefined {
    return this.clientVersionService;
  }

  /**
   * Get ServiceNoticeService instance (for advanced usage)
   */
  getServiceNoticeService(): ServiceNoticeService | undefined {
    return this.serviceNoticeService;
  }

  /**
   * Get BannerService instance (for advanced usage)
   */
  getBannerService(): BannerService | undefined {
    return this.bannerService;
  }

  // ==================== CACHE MANAGEMENT ====================

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
    // Note: New services use Map internally, no need to clear explicitly
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
