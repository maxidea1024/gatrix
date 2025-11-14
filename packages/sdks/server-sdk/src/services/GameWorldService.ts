/**
 * Game World Service
 * Handles game world list and detail retrieval
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { GameWorld, GameWorldListResponse } from '../types/api';

export class GameWorldService {
  private apiClient: ApiClient;
  private logger: Logger;
  private cachedWorlds: GameWorld[] = [];

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Get all game worlds
   * GET /api/v1/server/game-worlds
   */
  async list(): Promise<GameWorld[]> {
    this.logger.debug('Fetching game worlds');

    const response = await this.apiClient.get<GameWorldListResponse>(
      `/api/v1/server/game-worlds`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game worlds');
    }

    const worlds = response.data.worlds;
    // Sort by displayOrder (ascending)
    const sortedWorlds = worlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    this.cachedWorlds = sortedWorlds;

    this.logger.info('Game worlds fetched', { count: sortedWorlds.length });

    return sortedWorlds;
  }

  /**
   * Get game world by ID
   * GET /api/v1/server/game-worlds/:id
   */
  async getById(id: number): Promise<GameWorld> {
    this.logger.debug('Fetching game world by ID', { id });

    const response = await this.apiClient.get<GameWorld>(`/api/v1/server/game-worlds/${id}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game world');
    }

    this.logger.info('Game world fetched', { id, worldId: response.data.worldId });

    return response.data;
  }

  /**
   * Get game world by worldId
   * GET /api/v1/server/game-worlds/world/:worldId
   */
  async getByWorldId(worldId: string): Promise<GameWorld> {
    this.logger.debug('Fetching game world by worldId', { worldId });

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
   * Get cached game worlds (from memory)
   */
  getCached(): GameWorld[] {
    return this.cachedWorlds;
  }

  /**
   * Refresh cached game worlds
   */
  async refresh(): Promise<GameWorld[]> {
    this.logger.info('Refreshing game worlds cache');
    return await this.list();
  }

  /**
   * Update cache with new data
   */
  updateCache(worlds: GameWorld[]): void {
    this.cachedWorlds = worlds;
    this.logger.debug('Game worlds cache updated', { count: worlds.length });
  }

  /**
   * Update a single game world in cache (immutable)
   * If isVisible is false, removes the world from cache (no API call needed)
   * If isVisible is true but not in cache, fetches and adds it to cache
   * If isVisible is true and in cache, fetches and updates it
   */
  async updateSingleWorld(id: number, isVisible?: boolean | number): Promise<void> {
    try {
      this.logger.debug('Updating single game world in cache', { id, isVisible });

      // If isVisible is explicitly false (0 or false), just remove from cache
      if (isVisible === false || isVisible === 0) {
        this.logger.info('Game world isVisible=false, removing from cache', { id });
        this.removeWorld(id);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      // This is necessary because the event is published immediately after the database update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the updated world from backend
      const updatedWorld = await this.getById(id);

      // Check if world already exists in cache
      const existsInCache = this.cachedWorlds.some(world => world.id === id);

      if (existsInCache) {
        // Immutable update: update existing world
        this.cachedWorlds = this.cachedWorlds.map(world =>
          world.id === id ? updatedWorld : world
        );
        this.logger.debug('Single game world updated in cache', { id });
      } else {
        // World not in cache but found in backend (e.g., isVisible changed from false to true)
        // Add it to cache and re-sort by displayOrder
        this.cachedWorlds = [...this.cachedWorlds, updatedWorld];
        this.cachedWorlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        this.logger.debug('Single game world added to cache (was previously removed)', { id });
      }
    } catch (error: any) {
      this.logger.error('Failed to update single game world in cache', {
        id,
        error: error.message,
      });
      // If update fails, fall back to full refresh
      await this.refresh();
    }
  }

  /**
   * Remove a game world from cache (immutable)
   */
  removeWorld(id: number): void {
    this.logger.debug('Removing game world from cache', { id });

    // Immutable update: create new array without the deleted world
    this.cachedWorlds = this.cachedWorlds.filter(world => world.id !== id);

    this.logger.debug('Game world removed from cache', { id });
  }

  /**
   * Check if a world is in maintenance
   */
  isWorldInMaintenance(worldId: string): boolean {
    const world = this.cachedWorlds.find((w) => w.worldId === worldId);
    return world?.isMaintenance || false;
  }

  /**
   * Get maintenance message for a world with language support
   * Falls back to default message if language not found
   */
  getMaintenanceMessage(worldId: string, lang: 'ko' | 'en' | 'zh' = 'en'): string | null {
    const world = this.cachedWorlds.find((w) => w.worldId === worldId);
    if (!world || !world.isMaintenance) {
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

