/**
 * Vars (KV) Service
 * Handles key-value settings retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/vars
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { EnvironmentResolver } from '../utils/EnvironmentResolver';
import { CacheStorageProvider } from '../cache/StorageProvider';
import { VarItem } from '../types/api';
import { BaseEnvironmentService } from './BaseEnvironmentService';

export class VarsService extends BaseEnvironmentService<VarItem, VarItem[], string> {
  constructor(
    apiClient: ApiClient,
    logger: Logger,
    envResolver: EnvironmentResolver,
    storage?: CacheStorageProvider
  ) {
    super(apiClient, logger, envResolver, storage);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(environment: string): string {
    return `/api/v1/server/vars`;
  }

  protected extractItems(response: VarItem[]): VarItem[] {
    return response;
  }

  protected getServiceName(): string {
    return 'vars';
  }

  protected getItemId(item: VarItem): string {
    return item.varKey;
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Get a variable value by key from cache
   * @param key Variable key (e.g., '$channel', 'kv:some-setting')
   * @param environment Environment name (optional if envResolver can provide default)
   */
  getValue(key: string, environment?: string): string | null {
    const env = environment || this.envResolver.resolve(environment);
    const item = this.getByKey(key, env);
    return item ? item.varValue : null;
  }

  /**
   * Get a variable value parsed as JSON if it's an object or array
   * @param key Variable key
   * @param environment Environment name
   */
  getParsedValue<T = any>(key: string, environment?: string): T | null {
    const value = this.getValue(key, environment);
    if (value === null) return null;

    try {
      const item = this.getByKey(key, environment || this.envResolver.resolve(environment));
      if (item && (item.valueType === 'object' || item.valueType === 'array')) {
        return JSON.parse(value) as T;
      }
      return value as unknown as T;
    } catch (e) {
      this.logger.warn(`Failed to parse KV value for key: ${key}`, { error: e });
      return value as unknown as T;
    }
  }

  /**
   * Get a single VarItem by key
   * @param key Variable key
   * @param environment Environment name
   */
  getByKey(key: string, environment: string): VarItem | null {
    const items = this.getCached(environment);
    return items.find((item) => item.varKey === key) || null;
  }

  /**
   * Update a single var in cache by key
   * Used for granular event-driven updates (vars.updated event with value data)
   * @param key Variable key
   * @param value New variable value (null means deleted)
   * @param environment Environment name
   */
  updateSingleVar(key: string, value: string | null, environment: string): void {
    const items = this.getCached(environment);
    const existingIndex = items.findIndex((item) => item.varKey === key);

    if (value === null) {
      // Remove the var from cache
      if (existingIndex >= 0) {
        const newItems = items.filter((item) => item.varKey !== key);
        this.updateCache(newItems, environment);
        this.logger.debug('Single var removed from cache', { key, environment });
      }
      return;
    }

    if (existingIndex >= 0) {
      // Update existing var's value
      const updatedItems = items.map((item) =>
        item.varKey === key
          ? { ...item, varValue: value, updatedAt: new Date().toISOString() }
          : item
      );
      this.updateCache(updatedItems, environment);
    } else {
      // Var not in cache yet — fall back to full refresh
      // We don't have full VarItem structure (valueType, etc.) from event payload
      this.logger.debug('Var not found in cache for update, will need full refresh', {
        key,
        environment,
      });
      this.refreshByEnvironment(environment).catch((error: any) => {
        this.logger.error('Failed to refresh vars after single var update fallback', {
          error: error.message,
        });
      });
    }

    this.logger.debug('Single var updated in cache', { key, environment });
  }
}
