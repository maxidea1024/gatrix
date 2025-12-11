/**
 * Game World Service
 * Handles game world list and detail retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/game-worlds
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { GameWorld, GameWorldListResponse } from '../types/api';

export class GameWorldService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), GameWorld[]>
  private cachedWorldsByEnv: Map<string, GameWorld[]> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Get game worlds for a specific environment
   * GET /api/v1/server/:env/game-worlds
   */
  async listByEnvironment(environment: string): Promise<GameWorld[]> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/game-worlds`;

    this.logger.debug('Fetching game worlds', { environment });

    const response = await this.apiClient.get<GameWorldListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch game worlds');
    }

    const worlds = response.data.worlds;
    // Sort by displayOrder (ascending)
    const sortedWorlds = worlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    this.cachedWorldsByEnv.set(environment, sortedWorlds);

    this.logger.info('Game worlds fetched', { count: sortedWorlds.length, environment });

    return sortedWorlds;
  }

  /**
   * Get game worlds for multiple environments
   * Fetches each environment separately and caches results
   */
  async listByEnvironments(environments: string[]): Promise<GameWorld[]> {
    this.logger.debug('Fetching game worlds for multiple environments', { environments });

    const results: GameWorld[] = [];

    for (const env of environments) {
      try {
        const worlds = await this.listByEnvironment(env);
        results.push(...worlds);
      } catch (error) {
        this.logger.error(`Failed to fetch game worlds for environment ${env}`, { error });
      }
    }

    this.logger.info('Game worlds fetched for all environments', {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Get all game worlds (uses default environment for single-env mode)
   * For backward compatibility
   */
  async list(): Promise<GameWorld[]> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

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
   * Get cached game worlds
   * @param environment Environment name. If omitted, returns all worlds as flat array.
   */
  getCached(environment?: string): GameWorld[] {
    if (environment) {
      return this.cachedWorldsByEnv.get(environment) || [];
    }
    // No environment specified: return all worlds as flat array
    return Array.from(this.cachedWorldsByEnv.values()).flat();
  }

  /**
   * Get all cached game worlds (all environments)
   */
  getAllCached(): Map<string, GameWorld[]> {
    return this.cachedWorldsByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedWorldsByEnv.clear();
    this.logger.debug('Game worlds cache cleared');
  }

  /**
   * Refresh cached game worlds for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<GameWorld[]> {
    this.logger.info('Refreshing game worlds cache', { environment });
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached game worlds (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<GameWorld[]> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Update cache with new data
   */
  updateCache(worlds: GameWorld[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.cachedWorldsByEnv.set(envKey, worlds);
    this.logger.debug('Game worlds cache updated', { environment: envKey, count: worlds.length });
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
        this.removeWorld(id, environment);
        return;
      }

      // Otherwise, fetch from API and add/update
      // Add small delay to ensure backend transaction is committed
      // This is necessary because the event is published immediately after the database update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch the updated world from backend
      const updatedWorld = await this.getById(id, environment);

      // Get current worlds for this environment
      const currentWorlds = this.cachedWorldsByEnv.get(envKey) || [];

      // Check if world already exists in cache
      const existsInCache = currentWorlds.some(world => world.id === id);

      if (existsInCache) {
        // Immutable update: update existing world
        const newWorlds = currentWorlds.map(world => world.id === id ? updatedWorld : world);
        this.cachedWorldsByEnv.set(envKey, newWorlds);
        this.logger.debug('Single game world updated in cache', { id, environment: envKey });
      } else {
        // World not in cache but found in backend (e.g., isVisible changed from false to true)
        // Add it to cache and re-sort by displayOrder
        const newWorlds = [...currentWorlds, updatedWorld];
        newWorlds.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        this.cachedWorldsByEnv.set(envKey, newWorlds);
        this.logger.debug('Single game world added to cache (was previously removed)', { id, environment: envKey });
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
   */
  removeWorld(id: number, environment?: string): void {
    this.logger.debug('Removing game world from cache', { id, environment });

    const envKey = environment || this.defaultEnvironment;
    const currentWorlds = this.cachedWorldsByEnv.get(envKey) || [];

    // Immutable update: create new array without the deleted world
    const newWorlds = currentWorlds.filter(world => world.id !== id);
    this.cachedWorldsByEnv.set(envKey, newWorlds);

    this.logger.debug('Game world removed from cache', { id, environment: envKey });
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
