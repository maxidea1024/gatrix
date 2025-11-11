/**
 * Cache Manager
 * Manages in-memory caching for game worlds, popup notices, and surveys
 */

import { Logger } from '../utils/logger';
import { CacheConfig } from '../types/config';
import { GameWorldService } from '../services/GameWorldService';
import { PopupNoticeService } from '../services/PopupNoticeService';
import { SurveyService } from '../services/SurveyService';

export class CacheManager {
  private logger: Logger;
  private config: CacheConfig;
  private gameWorldService: GameWorldService;
  private popupNoticeService: PopupNoticeService;
  private surveyService: SurveyService;
  private refreshInterval?: NodeJS.Timeout;

  constructor(
    config: CacheConfig,
    gameWorldService: GameWorldService,
    popupNoticeService: PopupNoticeService,
    surveyService: SurveyService,
    logger: Logger
  ) {
    this.config = {
      enabled: config.enabled !== false,
      ttl: config.ttl || 300,
      autoRefresh: config.autoRefresh !== false,
    };
    this.gameWorldService = gameWorldService;
    this.popupNoticeService = popupNoticeService;
    this.surveyService = surveyService;
    this.logger = logger;
  }

  /**
   * Initialize cache by loading all data
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Cache is disabled');
      return;
    }

    this.logger.info('Initializing cache...');

    try {
      // Load all data in parallel
      await Promise.all([
        this.gameWorldService.list(),
        this.popupNoticeService.list(),
        // Note: Survey endpoint might need admin auth, handle gracefully
        this.surveyService.list({ isActive: true }).catch((error) => {
          this.logger.warn('Failed to load surveys (might require admin auth)', {
            error: error.message,
          });
          return { surveys: [], settings: null };
        }),
      ]);

      this.logger.info('Cache initialized successfully');

      // Setup auto-refresh if enabled
      if (this.config.autoRefresh && this.config.ttl) {
        this.startAutoRefresh();
      }
    } catch (error: any) {
      this.logger.error('Failed to initialize cache', { error: error.message });
      throw error;
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

    try {
      await Promise.all([
        this.gameWorldService.refresh(),
        this.popupNoticeService.refresh(),
        this.surveyService.refresh({ isActive: true }).catch((error) => {
          this.logger.warn('Failed to refresh surveys', { error: error.message });
        }),
      ]);

      this.logger.info('All caches refreshed successfully');
    } catch (error: any) {
      this.logger.error('Failed to refresh caches', { error: error.message });
      throw error;
    }
  }

  /**
   * Refresh game worlds cache
   */
  async refreshGameWorlds(): Promise<void> {
    await this.gameWorldService.refresh();
  }

  /**
   * Refresh popup notices cache
   */
  async refreshPopupNotices(): Promise<void> {
    await this.popupNoticeService.refresh();
  }

  /**
   * Refresh surveys cache
   */
  async refreshSurveys(): Promise<void> {
    await this.surveyService.refresh({ isActive: true });
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
   * Clear all caches
   */
  clear(): void {
    this.logger.info('Clearing all caches');
    this.gameWorldService.updateCache([]);
    this.popupNoticeService.updateCache([]);
    this.surveyService.updateCache([]);
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

