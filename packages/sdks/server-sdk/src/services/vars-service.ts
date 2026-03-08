/**
 * Vars (KV) Service
 * Handles key-value settings retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/vars
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/api-client';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import { VarItem } from '../types/api';
import { BaseEnvironmentService } from './base-environment-service';

export class VarsService extends BaseEnvironmentService<
  VarItem,
  VarItem[],
  string
> {
  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultToken: string,
    storage?: CacheStorageProvider
  ) {
    super(apiClient, logger, defaultToken, storage);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(): string {
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
   * @param environmentId environment ID (optional if envResolver can provide default)
   */
  getValue(key: string, environmentId?: string): string | null {
    const env = environmentId || this.resolveToken(environmentId);
    const item = this.getByKey(key, env);
    return item ? item.varValue : null;
  }

  /**
   * Get a variable value parsed as JSON if it's an object or array
   * @param key Variable key
   * @param environmentId environment ID
   */
  getParsedValue<T = any>(key: string, environmentId?: string): T | null {
    const value = this.getValue(key, environmentId);
    if (value === null) return null;

    try {
      const item = this.getByKey(
        key,
        environmentId || this.resolveToken(environmentId)
      );
      if (item && (item.valueType === 'object' || item.valueType === 'array')) {
        return JSON.parse(value) as T;
      }
      return value as unknown as T;
    } catch (e) {
      this.logger.warn(`Failed to parse KV value for key: ${key}`, {
        error: e,
      });
      return value as unknown as T;
    }
  }

  /**
   * Get a single VarItem by key
   * @param key Variable key
   * @param environmentId environment ID
   */
  getByKey(key: string, environmentId: string): VarItem | null {
    const items = this.getCached(environmentId);
    return items.find((item) => item.varKey === key) || null;
  }

  /**
   * Update a single var in cache by key
   * Used for granular event-driven updates (vars.updated event with value data)
   * @param key Variable key
   * @param value New variable value (null means deleted)
   * @param environmentId environment ID
   */
  updateSingleVar(
    key: string,
    value: string | null,
    environmentId: string
  ): void {
    const items = this.getCached(environmentId);
    const existingIndex = items.findIndex((item) => item.varKey === key);

    if (value === null) {
      // Remove the var from cache
      if (existingIndex >= 0) {
        const newItems = items.filter((item) => item.varKey !== key);
        this.updateCache(newItems, environmentId);
        this.logger.debug('Single var removed from cache', {
          key,
          environmentId,
        });
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
      this.updateCache(updatedItems, environmentId);
    } else {
      // Var not in cache yet — fall back to full refresh
      // We don't have full VarItem structure (valueType, etc.) from event payload
      this.logger.debug(
        'Var not found in cache for update, will need full refresh',
        {
          key,
          environmentId,
        }
      );
      this.refreshByEnvironment(environmentId).catch((error: any) => {
        this.logger.error(
          'Failed to refresh vars after single var update fallback',
          {
            error: error.message,
          }
        );
      });
    }

    this.logger.debug('Single var updated in cache', { key, environmentId });
  }
}
