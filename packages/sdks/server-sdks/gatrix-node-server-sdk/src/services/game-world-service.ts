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
import { validateAll } from '../utils/validation';

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

  // ==================== Override for ETag Invalidation ====================

  /**
   * Refresh cached game worlds for a specific environment.
   * Invalidates ApiClient ETag cache first so the SDK does NOT send
   * a stale If-None-Match header that would result in a 304 with old data.
   */
  async refreshByEnvironment(
    _suppressWarnings?: boolean,
    environmentId?: string
  ): Promise<GameWorld[]> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.logger.info('Refreshing game worlds cache', {
      environmentId: resolvedEnv,
    });
    // Invalidate ETag cache to force fresh data fetch from the correct env API client
    this.getApiClient(resolvedEnv).invalidateEtagCache(this.getEndpoint());
    return await this.listByEnvironment(resolvedEnv);
  }

  /**
   * Get game world by ID
   * GET /api/v1/server/game-worlds/:id
   * @param id Game world ID
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  async getById(id: string, environmentId?: string): Promise<GameWorld> {
    validateAll([{ param: 'id', value: id, type: 'string' }]);
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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  async getByWorldId(
    worldId: string,
    environmentId?: string
  ): Promise<GameWorld> {
    validateAll([{ param: 'worldId', value: worldId, type: 'string' }]);
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.logger.debug('Fetching game world by worldId', {
      worldId,
      environmentId: resolvedEnv,
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
   * @param isVisible Optional visibility status
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  async updateSingleWorld(
    id: string,
    isVisible?: boolean | number,
    environmentId?: string
  ): Promise<void> {
    validateAll([{ param: 'id', value: id, type: 'string' }]);
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    try {
      this.logger.debug('Updating single game world in cache', {
        id,
        environmentId: resolvedEnv,
        isVisible,
      });

      // If isVisible is explicitly false (0 or false), just remove from cache
      if (isVisible === false || isVisible === 0) {
        this.logger.info('Game world isVisible=false, removing from cache', {
          id,
          environmentId: resolvedEnv,
        });
        this.removeFromCache(id, resolvedEnv);
        return;
      }

      // Otherwise, fetch from API and add/update

      // Fetch the updated world from backend
      const updatedWorld = await this.getById(id, resolvedEnv);

      // Get current worlds for this environment
      const currentWorlds = this.cachedByEnv.get(resolvedEnv) || [];
      const existsInCache = currentWorlds.some(
        (world) => String(world.id) === String(id)
      );

      if (existsInCache) {
        // Immutable update: update existing world
        const newWorlds = currentWorlds.map((world) =>
          String(world.id) === String(id) ? updatedWorld : world
        );
        this.cachedByEnv.set(resolvedEnv, newWorlds);
        this.logger.debug('Single game world updated in cache', {
          id,
          environmentId: resolvedEnv,
        });
      } else {
        // World not in cache but found in backend
        // Add it to cache and re-sort by displayOrder
        const newWorlds = [...currentWorlds, updatedWorld];
        newWorlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        this.cachedByEnv.set(resolvedEnv, newWorlds);
        this.logger.debug('Single game world added to cache', {
          id,
          environmentId: resolvedEnv,
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single game world in cache', {
        id,
        environmentId: resolvedEnv,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refreshByEnvironment(undefined, resolvedEnv);
    }
  }

  /**
   * Check if a world is in maintenance based on flag and time window
   * @param worldId World ID
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  isWorldMaintenanceActive(worldId: string, environmentId?: string): boolean {
    validateAll([{ param: 'worldId', value: worldId, type: 'string' }]);
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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getWorldByWorldId(worldId: string, environmentId?: string): GameWorld | null {
    validateAll([{ param: 'worldId', value: worldId, type: 'string' }]);
    const worlds = this.getCached(environmentId);
    return worlds.find((w) => w.worldId === worldId) || null;
  }

  /**
   * Get maintenance message for a world with language support
   * Falls back to default message if language not found
   * @param worldId World ID
   * @param lang Language code (default: 'en')
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getWorldMaintenanceMessage(
    worldId: string,
    lang: 'ko' | 'en' | 'zh' = 'en',
    environmentId?: string
  ): string | null {
    validateAll([{ param: 'worldId', value: worldId, type: 'string' }]);
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
