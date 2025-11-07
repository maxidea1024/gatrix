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
   * GET /api/v1/server/game-worlds?lang=ko
   */
  async list(lang: string = 'en'): Promise<GameWorld[]> {
    this.logger.debug('Fetching game worlds', { lang });

    const response = await this.apiClient.get<GameWorldListResponse>(
      `/api/v1/server/game-worlds`,
      {
        params: { lang },
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game worlds');
    }

    const worlds = response.data.worlds;
    this.cachedWorlds = worlds;

    this.logger.info('Game worlds fetched', { count: worlds.length });

    return worlds;
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
  async refresh(lang: string = 'en'): Promise<GameWorld[]> {
    this.logger.info('Refreshing game worlds cache');
    return await this.list(lang);
  }

  /**
   * Update cache with new data
   */
  updateCache(worlds: GameWorld[]): void {
    this.cachedWorlds = worlds;
    this.logger.debug('Game worlds cache updated', { count: worlds.length });
  }

  /**
   * Check if a world is in maintenance
   */
  isWorldInMaintenance(worldId: string): boolean {
    const world = this.cachedWorlds.find((w) => w.worldId === worldId);
    return world?.isMaintenance || false;
  }

  /**
   * Get maintenance message for a world
   */
  getMaintenanceMessage(worldId: string): string | undefined {
    const world = this.cachedWorlds.find((w) => w.worldId === worldId);
    return world?.maintenanceMessage;
  }
}

