/**
 * API Client Factory
 * Creates and caches ApiClient instances per token for multi-token mode.
 * In single-token mode, the default ApiClient is reused.
 *
 * Each token gets its own ApiClient to avoid ETag cache collisions
 * when the same endpoint is called with different tokens.
 */

import { ApiClient, ApiClientConfig } from './api-client';

export class ApiClientFactory {
  private readonly defaultToken: string;
  private readonly defaultClient: ApiClient;
  private readonly clientsByToken: Map<string, ApiClient> = new Map();
  private readonly baseConfig: Omit<ApiClientConfig, 'apiToken'>;

  constructor(
    defaultClient: ApiClient,
    defaultToken: string,
    baseConfig: Omit<ApiClientConfig, 'apiToken'>
  ) {
    this.defaultClient = defaultClient;
    this.defaultToken = defaultToken;
    this.baseConfig = baseConfig;

    // Register default client
    this.clientsByToken.set(defaultToken, defaultClient);
  }

  /**
   * Get ApiClient for a specific token.
   * Returns the default client if token matches defaultToken.
   * Creates a new client lazily for other tokens.
   */
  getClient(token?: string): ApiClient {
    const resolvedToken = token || this.defaultToken;

    if (resolvedToken === this.defaultToken) {
      return this.defaultClient;
    }

    let client = this.clientsByToken.get(resolvedToken);
    if (!client) {
      client = new ApiClient({
        ...this.baseConfig,
        apiToken: resolvedToken,
      });
      this.clientsByToken.set(resolvedToken, client);
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
    return this.clientsByToken;
  }

  /**
   * Remove a cached client for a token (e.g., when token is removed)
   */
  removeClient(token: string): void {
    if (token !== this.defaultToken) {
      this.clientsByToken.delete(token);
    }
  }

  /**
   * Clear all non-default clients
   */
  clearNonDefaultClients(): void {
    for (const [token] of this.clientsByToken) {
      if (token !== this.defaultToken) {
        this.clientsByToken.delete(token);
      }
    }
  }
}
