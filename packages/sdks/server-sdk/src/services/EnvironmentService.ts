/**
 * Environment Service
 * Manages environment list for wildcard (*) mode
 * Fetches environment list from backend and tracks changes
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { EnvironmentInfo, EnvironmentListResponse } from '../types/api';

export class EnvironmentService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Cached environment list
  private cachedEnvironments: EnvironmentInfo[] = [];
  // Callback for environment changes
  private onChangeCallbacks: Array<(added: string[], removed: string[]) => void> = [];

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Fetch environment list from backend
   * GET /api/v1/server/environments
   */
  async fetchEnvironments(): Promise<EnvironmentInfo[]> {
    const endpoint = '/api/v1/server/environments';

    this.logger.debug('Fetching environment list');

    const response = await this.apiClient.get<EnvironmentListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch environments');
    }

    const environments = response.data.environments;
    
    // Detect changes
    const oldNames = this.cachedEnvironments.map(e => e.environmentName);
    const newNames = environments.map(e => e.environmentName);
    
    const added = newNames.filter(n => !oldNames.includes(n));
    const removed = oldNames.filter(n => !newNames.includes(n));

    // Update cache
    this.cachedEnvironments = environments;

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
    return this.cachedEnvironments.map(e => e.environmentName);
  }

  /**
   * Check if an environment exists
   */
  hasEnvironment(environmentName: string): boolean {
    return this.cachedEnvironments.some(e => e.environmentName === environmentName);
  }

  /**
   * Register callback for environment changes
   * Returns function to unregister
   */
  onChange(callback: (added: string[], removed: string[]) => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter(cb => cb !== callback);
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
        this.logger.error('Error in environment change callback', { error: error.message });
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

