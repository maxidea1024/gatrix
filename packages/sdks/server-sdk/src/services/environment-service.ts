/**
 * Environment Service
 * Manages environment list for wildcard (*) mode
 * Fetches environment list from backend and tracks changes
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { EnvironmentInfo, EnvironmentListResponse } from '../types/api';
import { CacheStorageProvider } from '../cache/storage-provider';

export class EnvironmentService {
  private apiClient: ApiClient;
  private logger: Logger;
  private storage?: CacheStorageProvider;
  // Cached environment list
  private cachedEnvironments: EnvironmentInfo[] = [];
  // Callback for environment changes
  private onChangeCallbacks: Array<(added: string[], removed: string[]) => void> = [];
  private readonly CACHE_KEY = 'environments_list';

  constructor(apiClient: ApiClient, logger: Logger, storage?: CacheStorageProvider) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.storage = storage;
  }

  /**
   * Initialize service by loading from local storage
   */
  async initializeAsync(): Promise<void> {
    if (!this.storage) return;

    try {
      const cachedJson = await this.storage.get(this.CACHE_KEY);
      if (cachedJson) {
        const environments = JSON.parse(cachedJson) as EnvironmentInfo[];
        if (Array.isArray(environments)) {
          this.cachedEnvironments = environments;
          this.logger.debug('Loaded environments list from local storage', {
            count: environments.length,
          });
        }
      }
    } catch (error: any) {
      this.logger.warn('Failed to load environments from local storage', {
        error: error.message,
      });
    }
  }

  /**
   * Fetch environment list from backend
   * GET /api/v1/server/environments
   */
  async fetchEnvironments(): Promise<EnvironmentInfo[]> {
    const endpoint = '/api/v1/server/environments';

    this.logger.debug('Fetching environment list');

    try {
      const response = await this.apiClient.get<EnvironmentListResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch environments');
      }

      const environments = response.data.environments;

      // Detect changes
      const oldNames = this.cachedEnvironments.map((e) => e.environment);
      const newNames = environments.map((e) => e.environment);

      const added = newNames.filter((n) => !oldNames.includes(n));
      const removed = oldNames.filter((n) => !newNames.includes(n));

      // Update cache
      this.cachedEnvironments = environments;

      // Persist to local storage
      if (this.storage) {
        this.storage.save(this.CACHE_KEY, JSON.stringify(environments)).catch(() => {});
      }

      this.logger.info('Environments fetched', {
        count: environments.length,
        added: added.length > 0 ? added : undefined,
        removed: removed.length > 0 ? removed : undefined,
      });

      // Notify callbacks if there are changes
      if (added.length > 0 || removed.length > 0) {
        this.notifyChange(added, removed);
      }

      return environments;
    } catch (error: any) {
      this.logger.error('Failed to fetch environments from backend', {
        error: error.message,
      });

      // If we have cached environments from local storage, return them instead of failing
      if (this.cachedEnvironments.length > 0) {
        this.logger.warn('Returning cached environments list after fetch failure');
        return this.cachedEnvironments;
      }

      throw error;
    }
  }

  /**
   * Get cached environments
   */
  getCached(): EnvironmentInfo[] {
    return this.cachedEnvironments;
  }

  /**
   * Get cached environment names
   */
  getEnvironmentNames(): string[] {
    return this.cachedEnvironments.map((e) => e.environment);
  }

  /**
   * Check if an environment exists
   */
  hasEnvironment(environmentName: string): boolean {
    return this.cachedEnvironments.some((e) => e.environment === environmentName);
  }

  /**
   * Register callback for environment changes
   * Returns function to unregister
   */
  onChange(callback: (added: string[], removed: string[]) => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notify all callbacks about environment changes
   */
  private notifyChange(added: string[], removed: string[]): void {
    for (const callback of this.onChangeCallbacks) {
      try {
        callback(added, removed);
      } catch (error: any) {
        this.logger.error('Error in environment change callback', {
          error: error.message,
        });
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedEnvironments = [];
    this.logger.debug('Environment cache cleared');
  }

  /**
   * Refresh environments (alias for fetchEnvironments)
   */
  async refresh(): Promise<EnvironmentInfo[]> {
    return this.fetchEnvironments();
  }
}
