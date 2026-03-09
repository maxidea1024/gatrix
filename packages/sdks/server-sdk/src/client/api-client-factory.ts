/**
 * API Client Factory
 * Creates and caches ApiClient instances per environment for multi-environment mode.
 * In single-environment mode, the default ApiClient is reused.
 *
 * Each environment gets its own ApiClient to avoid ETag cache collisions
 * when the same endpoint is called with different tokens.
 *
 * DESIGN: environmentId is the lookup key, token is used internally for API auth.
 */

import { ApiClient, ApiClientConfig } from './api-client';

export class ApiClientFactory {
  private readonly defaultToken: string;
  private readonly defaultClient: ApiClient;
  private readonly clientsByEnv: Map<string, ApiClient> = new Map();
  // environmentId → token mapping for creating ApiClients
  private readonly envTokenMap: Map<string, string> = new Map();
  private readonly baseConfig: Omit<ApiClientConfig, 'apiToken'>;

  constructor(
    defaultClient: ApiClient,
    defaultToken: string,
    baseConfig: Omit<ApiClientConfig, 'apiToken'>
  ) {
    this.defaultClient = defaultClient;
    this.defaultToken = defaultToken;
    this.baseConfig = baseConfig;

    // Register default client under its token
    this.clientsByEnv.set(defaultToken, defaultClient);
    this.envTokenMap.set(defaultToken, defaultToken);
  }

  /**
   * Register an environment with its associated API token.
   * Must be called before getClient() for non-default environments.
   */
  registerEnvironment(environmentId: string, token: string): void {
    this.envTokenMap.set(environmentId, token);
  }

  /**
   * Remap the default client from token-based key to real environmentId.
   * Called after /ready endpoint resolves the actual environmentId.
   * The default client remains the same, but is now also accessible by the real environmentId.
   */
  remapDefaultEnvironment(environmentId: string): void {
    // Register the real environmentId → token mapping
    this.envTokenMap.set(environmentId, this.defaultToken);
    // Register the default client under the real environmentId
    this.clientsByEnv.set(environmentId, this.defaultClient);
  }

  /**
   * Unregister an environment and remove its cached client.
   */
  unregisterEnvironment(environmentId: string): void {
    if (environmentId !== this.defaultToken) {
      this.clientsByEnv.delete(environmentId);
      this.envTokenMap.delete(environmentId);
    }
  }

  /**
   * Get ApiClient for a specific environment.
   * Returns the default client if environmentId matches defaultToken.
   * Creates a new client lazily for other environments using the registered token.
   */
  getClient(environmentId?: string): ApiClient {
    const resolvedEnv = environmentId || this.defaultToken;

    if (resolvedEnv === this.defaultToken) {
      return this.defaultClient;
    }

    let client = this.clientsByEnv.get(resolvedEnv);
    if (!client) {
      // Look up the token for this environment
      const token = this.envTokenMap.get(resolvedEnv);
      if (!token) {
        // Fallback: use environmentId as token (backward compatibility)
        client = new ApiClient({
          ...this.baseConfig,
          apiToken: resolvedEnv,
        });
      } else {
        client = new ApiClient({
          ...this.baseConfig,
          apiToken: token,
        });
      }
      this.clientsByEnv.set(resolvedEnv, client);
    }

    return client;
  }

  /**
   * Get the default ApiClient (for non-environment-specific calls)
   */
  getDefaultClient(): ApiClient {
    return this.defaultClient;
  }

  /**
   * Get all cached ApiClient instances
   */
  getAllClients(): Map<string, ApiClient> {
    return this.clientsByEnv;
  }

  /**
   * Remove a cached client for an environment (e.g., when environment is removed)
   */
  removeClient(environmentId: string): void {
    if (environmentId !== this.defaultToken) {
      this.clientsByEnv.delete(environmentId);
    }
  }

  /**
   * Clear all non-default clients
   */
  clearNonDefaultClients(): void {
    for (const [envId] of this.clientsByEnv) {
      if (envId !== this.defaultToken) {
        this.clientsByEnv.delete(envId);
      }
    }
  }
}
