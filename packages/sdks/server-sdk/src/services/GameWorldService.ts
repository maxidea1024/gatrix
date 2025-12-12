/**
 * Game World Service
 * Handles game world list and detail retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/game-worlds
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { GameWorld, GameWorldListResponse } from '../types/api';
import { BaseEnvironmentService } from './BaseEnvironmentService';

export class GameWorldService extends BaseEnvironmentService<GameWorld, GameWorldListResponse, number> {
  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    super(apiClient, logger, defaultEnvironment);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(environment: string): string {
    return `/api/v1/server/${encodeURIComponent(environment)}/game-worlds`;
  }

  protected extractItems(response: GameWorldListResponse): GameWorld[] {
    return response.worlds;
  }

  protected getServiceName(): string {
    return 'game worlds';
  }

  protected getItemId(item: GameWorld): number {
    return item.id;
  }

  // ==================== Override for Custom Sorting ====================

  /**
   * Get game worlds for a specific environment
   * Overridden to add sorting by displayOrder
   */
  async listByEnvironment(environment: string): Promise<GameWorld[]> {
    const endpoint = this.getEndpoint(environment);

    this.logger.debug('Fetching game worlds', { environment });

    const response = await this.apiClient.get<GameWorldListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game worlds');
    }

    const worlds = this.extractItems(response.data);
    // Sort by displayOrder (ascending)
    const sortedWorlds = worlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    this.cachedByEnv.set(environment, sortedWorlds);

    this.logger.info('Game worlds fetched', { count: sortedWorlds.length, environment });

    return sortedWorlds;
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Get game world by ID
   * GET /api/v1/server/:env/game-worlds/:id
   */
  async getById(id: number, environment?: string): Promise<GameWorld> {
    const env = environment || this.defaultEnvironment;
    this.logger.debug('Fetching game world by ID', { id, environment: env });

    const response = await this.apiClient.get<GameWorld>(`/api/v1/server/${encodeURIComponent(env)}/game-worlds/${id}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game world');
    }

    this.logger.info('Game world fetched', { id, worldId: response.data.worldId });

    return response.data;
  }

  /**
   * Get game world by worldId
   * GET /api/v1/server/:env/game-worlds/world/:worldId
   */
  async getByWorldId(worldId: string, environment?: string): Promise<GameWorld> {
    const env = environment || this.defaultEnvironment;
    this.logger.debug('Fetching game world by worldId', { worldId, environment: env });

    const response = await this.apiClient.get<GameWorld>(
      `/api/v1/server/${encodeURIComponent(env)}/game-worlds/world/${encodeURIComponent(worldId)}`
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
   */
  async updateSingleWorld(id: number, environment?: string, isVisible?: boolean | number): Promise<void> {
    try {
      this.logger.debug('Updating single game world in cache', { id, environment, isVisible });

      const envKey = environment || this.defaultEnvironment;

      // If isVisible is explicitly false (0 or false), just remove from cache
      if (isVisible === false || isVisible === 0) {
        this.logger.info('Game world isVisible=false, removing from cache', { id, environment: envKey });
        this.removeFromCache(id, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the updated world from backend
      const updatedWorld = await this.getById(id, environment);

      // Get current worlds for this environment
      const currentWorlds = this.cachedByEnv.get(envKey) || [];
      const existsInCache = currentWorlds.some(world => world.id === id);

      if (existsInCache) {
        // Immutable update: update existing world
        const newWorlds = currentWorlds.map(world => world.id === id ? updatedWorld : world);
        this.cachedByEnv.set(envKey, newWorlds);
        this.logger.debug('Single game world updated in cache', { id, environment: envKey });
      } else {
        // World not in cache but found in backend
        // Add it to cache and re-sort by displayOrder
        const newWorlds = [...currentWorlds, updatedWorld];
        newWorlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        this.cachedByEnv.set(envKey, newWorlds);
        this.logger.debug('Single game world added to cache', { id, environment: envKey });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single game world in cache', {
        id,
        environment,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
    }
  }

  /**
   * Remove a game world from cache (immutable)
   * @deprecated Use removeFromCache instead
   */
  removeWorld(id: number, environment?: string): void {
    this.removeFromCache(id, environment);
  }

  /**
   * Check if a world is in maintenance based on flag and time window
   */
  isWorldMaintenanceActive(worldId: string, environment?: string): boolean {
    const worlds = this.getCached(environment);
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
   */
  getWorldByWorldId(worldId: string, environment?: string): GameWorld | null {
    const worlds = this.getCached(environment);
    return worlds.find((w) => w.worldId === worldId) || null;
  }

  /**
   * Get maintenance message for a world with language support
   * Falls back to default message if language not found
   */
  getWorldMaintenanceMessage(worldId: string, lang: 'ko' | 'en' | 'zh' = 'en', environment?: string): string | null {
    const worlds = this.getCached(environment);
    const world = worlds.find((w) => w.worldId === worldId);
    if (!world || !this.isWorldMaintenanceActive(worldId, environment)) {
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
