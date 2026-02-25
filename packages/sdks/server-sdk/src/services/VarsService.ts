/**
 * Vars (KV) Service
 * Handles key-value settings retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/:env/vars
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
    return `/api/v1/server/${encodeURIComponent(environment)}/vars`;
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
}
