/**
 * Game World Service
 * Handles game world list and detail retrieval
 * Uses per-environment API pattern: GET /api/v1/server/game-worlds
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import { GameWorld, GameWorldListResponse } from '../types/api';
import { BaseEnvironmentService } from './base-environment-service';

export class GameWorldService extends BaseEnvironmentService<
  GameWorld,
  GameWorldListResponse,
  string
> {
  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    super(apiClient, logger, defaultEnvironmentId, storage);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(): string {
    return `/api/v1/server/game-worlds`;
  }

  protected extractItems(response: GameWorldListResponse): GameWorld[] {
    const worlds = response.worlds || [];
    // Sort by displayOrder (ascending)
    return [...worlds].sort(
      (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
    );
  }

  protected getServiceName(): string {
    return 'game worlds';
  }

  protected getItemId(item: GameWorld): string {
    return item.id;
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Get game world by ID
   * GET /api/v1/server/game-worlds/:id
   * @param id Game world ID
   * @param environmentId environment ID (required)
   */
  async getById(id: string, environmentId: string): Promise<GameWorld> {
    this.logger.debug('Fetching game world by ID', { id, environmentId });

    const response = await this.apiClient.get<GameWorld>(
      `/api/v1/server/game-worlds/${id}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game world');
    }

    this.logger.info('Game world fetched', {
      id,
      worldId: response.data.worldId,
    });

    return response.data;
  }

  /**
   * Get game world by worldId
   * GET /api/v1/server/game-worlds/world/:worldId
   * @param worldId World ID
   * @param environmentId environment ID (required)
   */
  async getByWorldId(
    worldId: string,
    environmentId: string
  ): Promise<GameWorld> {
    this.logger.debug('Fetching game world by worldId', {
      worldId,
      environmentId,
    });

    const response = await this.apiClient.get<GameWorld>(
      `/api/v1/server/game-worlds/world/${encodeURIComponent(worldId)}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game world');
    }

    this.logger.info('Game world fetched', { worldId, id: response.data.id });

    return response.data;
  }

  /**
   * Update a single game world in cache (immutable)
   * If isVisible is false, removes the world from cache (no API call needed)
   * If isVisible is true but not in cache, fetches and adds it to cache
   * If isVisible is true and in cache, fetches and updates it
   * @param id Game world ID
   * @param environmentId environment ID (required)
   * @param isVisible Optional visibility status
   */
  async updateSingleWorld(
    id: string,
    environmentId: string,
    isVisible?: boolean | number
  ): Promise<void> {
    try {
      this.logger.debug('Updating single game world in cache', {
        id,
        environmentId,
        isVisible,
      });

      // If isVisible is explicitly false (0 or false), just remove from cache
      if (isVisible === false || isVisible === 0) {
        this.logger.info('Game world isVisible=false, removing from cache', {
          id,
          environmentId,
        });
        this.removeFromCache(id, environmentId);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch the updated world from backend
      const updatedWorld = await this.getById(id, environmentId);

      // Get current worlds for this environment
      const currentWorlds = this.cachedByEnv.get(environmentId) || [];
      const existsInCache = currentWorlds.some(
        (world) => String(world.id) === String(id)
      );

      if (existsInCache) {
        // Immutable update: update existing world
        const newWorlds = currentWorlds.map((world) =>
          String(world.id) === String(id) ? updatedWorld : world
        );
        this.cachedByEnv.set(environmentId, newWorlds);
        this.logger.debug('Single game world updated in cache', {
          id,
          environmentId,
        });
      } else {
        // World not in cache but found in backend
        // Add it to cache and re-sort by displayOrder
        const newWorlds = [...currentWorlds, updatedWorld];
        newWorlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        this.cachedByEnv.set(environmentId, newWorlds);
        this.logger.debug('Single game world added to cache', {
          id,
          environmentId,
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single game world in cache', {
        id,
        environmentId,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refreshByEnvironment(environmentId);
    }
  }

  /**
   * Check if a world is in maintenance based on flag and time window
   * @param worldId World ID
   * @param environmentId environment ID (required)
   */
  isWorldMaintenanceActive(worldId: string, environmentId: string): boolean {
    const worlds = this.getCached(environmentId);
    const world = worlds.find((w) => w.worldId === worldId);
    if (!world || !world.isMaintenance) {
      return false;
    }

    const now = new Date();

    // Check if maintenance has not started yet
    if (world.maintenanceStartDate) {
      const startDate = new Date(world.maintenanceStartDate);
      if (!Number.isNaN(startDate.getTime()) && now < startDate) {
        return false;
      }
    }

    // Check if maintenance has already ended
    if (world.maintenanceEndDate) {
      const endDate = new Date(world.maintenanceEndDate);
      if (!Number.isNaN(endDate.getTime()) && now > endDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get world by worldId from cache
   * @param worldId World ID
   * @param environmentId environment ID (required)
   */
  getWorldByWorldId(worldId: string, environmentId: string): GameWorld | null {
    const worlds = this.getCached(environmentId);
    return worlds.find((w) => w.worldId === worldId) || null;
  }

  /**
   * Get maintenance message for a world with language support
   * Falls back to default message if language not found
   * @param worldId World ID
   * @param environmentId environment ID (required)
   * @param lang Language code (default: 'en')
   */
  getWorldMaintenanceMessage(
    worldId: string,
    environmentId: string,
    lang: 'ko' | 'en' | 'zh' = 'en'
  ): string | null {
    const worlds = this.getCached(environmentId);
    const world = worlds.find((w) => w.worldId === worldId);
    if (!world || !this.isWorldMaintenanceActive(worldId, environmentId)) {
      return null;
    }

    // Try to find localized message
    if (world.maintenanceLocales && world.maintenanceLocales.length > 0) {
      const locale = world.maintenanceLocales.find((l: any) => l.lang === lang);
      if (locale) {
        return locale.message;
      }
    }

    // Fallback to default message
    return world.maintenanceMessage || null;
  }
}
