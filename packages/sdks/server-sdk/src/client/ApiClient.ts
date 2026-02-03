/**
 * HTTP API Client using Axios
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ulid } from 'ulid';
import { Logger } from '../utils/logger';
import { ErrorCode, createError, isGatrixSDKError } from '../utils/errors';
import { ApiResponse } from '../types/api';
import { RetryConfig } from '../types/config';
import { SdkMetrics } from '../utils/sdkMetrics';
import { sleep } from '../utils/time';

export interface ApiClientConfig {
  baseURL: string;
  apiToken: string;
  applicationName: string;
  environment?: string; // Default environment for single-environment mode
  timeout?: number;
  logger?: Logger;
  retry?: RetryConfig;
  metrics?: SdkMetrics; // Optional SDK metrics collector
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  enabled: true,
  maxRetries: 10,
  retryDelay: 2000, // Initial delay: 2 seconds
  retryDelayMultiplier: 2, // Exponential backoff: 2s -> 4s -> 8s -> 10s (max)
  maxRetryDelay: 10000, // Max delay: 10 seconds
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export class ApiClient {
  private client: AxiosInstance;
  private logger: Logger;
  private retryConfig: Required<RetryConfig>;
  private metrics?: SdkMetrics;
  private etagStore: Map<string, string>;
  private bodyCache: Map<string, ApiResponse<any>>;

  // Connection recovery callback system
  private connectionRecoveryCallbacks: Array<() => void> = [];
  private lastRecoveryTriggerTime: number = 0;
  private recoveryThrottleMs: number = 5000; // Throttle: max once per 5 seconds

  constructor(config: ApiClientConfig) {
    this.logger = config.logger || new Logger();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.metrics = config.metrics;
    this.etagStore = new Map();
    this.bodyCache = new Map();

    // Build headers with optional environment
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Token': config.apiToken,
      'X-Application-Name': config.applicationName,
    };

    // Add environment header for single-environment mode
    if (config.environment) {
      headers['X-Environment'] = config.environment;
    }

    // Create axios instance
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers,
      // Treat 304 Not Modified as a successful response so we can handle ETag logic
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (requestConfig) => {
        // Record start time for latency metrics
        (requestConfig as any).__sdkStartTime = process.hrtime.bigint();

        this.logger.debug('API Request', {
          method: requestConfig.method?.toUpperCase(),
          url: requestConfig.url,
          params: requestConfig.params,
        });
        return requestConfig;
      },
      (error) => {
        this.logger.error('API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response', {
          status: response.status,
          url: response.config.url,
        });

        // Observe HTTP duration and increment counters
        try {
          const started = (response.config as any).__sdkStartTime as bigint | undefined;
          if (started && this.metrics) {
            const elapsed = Number(process.hrtime.bigint() - started) / 1e9;
            const method = response.config.method?.toUpperCase() || 'GET';
            const route = response.config.url || 'unknown';
            // Use SDK metrics generic error counter and custom HTTP helpers if present
            this.metrics.observeHttpDuration?.(method, route, response.status, elapsed);
            this.metrics.incHttpRequestsTotal?.(method, route, response.status);
          }
        } catch {
          // ignore metrics failures
        }

        return response;
      },
      (error: AxiosError) => {
        try {
          const cfg = error.config as any;
          const started = cfg?.__sdkStartTime as bigint | undefined;
          if (started && this.metrics) {
            const elapsed = Number(process.hrtime.bigint() - started) / 1e9;
            const method = (cfg?.method?.toUpperCase?.() as string) || 'GET';
            const route = (cfg?.url as string) || 'unknown';
            const status = error.response?.status || 0;
            this.metrics.observeHttpDuration?.(method, route, status, elapsed);
            this.metrics.incHttpRequestsTotal?.(method, route, status);
            this.metrics.incError('http', 'request');
          }
        } catch {
          // ignore metrics failures
        }

        // Don't call handleError here - it will be called in executeWithRetry on final failure
        // This prevents duplicate error logs during retry cycles
        return Promise.reject(error);
      }
    );
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      this.logger.error('API Error Response', {
        status,
        url: error.config?.url,
        error: data?.error || data?.message,
      });

      if (status === 401) {
        throw createError(
          ErrorCode.AUTH_FAILED,
          'Authentication failed. Please check your API token.',
          status,
          data
        );
      } else if (status >= 400 && status < 500) {
        throw createError(
          ErrorCode.INVALID_PARAMETERS,
          data?.error?.message || data?.message || 'Invalid request parameters',
          status,
          data
        );
      } else if (status >= 500) {
        throw createError(
          ErrorCode.API_ERROR,
          data?.error?.message || data?.message || 'Server error occurred',
          status,
          data
        );
      }
    } else if (error.request) {
      // Request was made but no response received
      this.logger.error('Network Error', {
        url: error.config?.url,
        message: error.message,
      });

      throw createError(
        ErrorCode.NETWORK_ERROR,
        'Network error. Please check your connection.',
        undefined,
        { message: error.message }
      );
    } else {
      // Something else happened
      this.logger.error('Request Setup Error', { message: error.message });

      throw createError(
        ErrorCode.API_ERROR,
        error.message || 'An unexpected error occurred',
        undefined,
        { message: error.message }
      );
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!this.retryConfig.enabled) {
      return false;
    }

    // Handle GatrixSDKError (as errors are wrapped in interceptor)
    if (isGatrixSDKError(error)) {
      if (error.statusCode) {
        return this.retryConfig.retryableStatusCodes.includes(error.statusCode);
      }
      // Network errors are retryable
      return error.code === ErrorCode.NETWORK_ERROR;
    }

    // Handle raw AxiosError
    const axiosError = error as AxiosError;

    // Network errors are retryable
    if (!axiosError.response) {
      return true;
    }

    // Check if status code is retryable
    const status = axiosError.response.status;
    return this.retryConfig.retryableStatusCodes.includes(status);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptNumber: number): number {
    const delay =
      this.retryConfig.retryDelay * Math.pow(this.retryConfig.retryDelayMultiplier, attemptNumber);
    return Math.min(delay, this.retryConfig.maxRetryDelay);
  }

  /**
   * Build a stable cache key for ETag storage based on URL and query params
   */
  private buildCacheKey(url: string, config?: AxiosRequestConfig): string {
    if (!config || !config.params) {
      return url;
    }

    try {
      const params = config.params as Record<string, any>;
      const sortedKeys = Object.keys(params).sort();
      const normalized: Record<string, any> = {};

      for (const key of sortedKeys) {
        const value = params[key];
        if (value === undefined) {
          continue;
        }
        normalized[key] = value;
      }

      return `${url}?${JSON.stringify(normalized)}`;
    } catch {
      // Fallback to URL only if params cannot be serialized safely
      return url;
    }
  }

  /**
   * Execute request with retry logic
   * Supports infinite retries when maxRetries is -1
   */
  private async executeWithRetry<T>(
    fn: () => Promise<AxiosResponse<ApiResponse<T>>>,
    context: { method: string; url: string }
  ): Promise<ApiResponse<T>> {
    let lastError: any;
    const isInfiniteRetry = this.retryConfig.maxRetries === -1;
    const maxAttempts = isInfiniteRetry ? Number.MAX_SAFE_INTEGER : this.retryConfig.maxRetries;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fn();

        // Log recovery if this was a retry attempt (attempt > 0 means we had at least one failure)
        if (attempt > 0) {
          this.logger.info('*** API connection restored ***', {
            method: context.method,
            url: context.url,
            retriesNeeded: attempt,
          });

          // Trigger connection recovery callbacks (throttled)
          this.triggerConnectionRecoveryCallbacks();
        }

        return response.data;
      } catch (error) {
        lastError = error;

        // Check if this is the final failure (not retryable or last attempt)
        const isFinalFailure = !this.isRetryableError(lastError) || attempt === maxAttempts;

        if (isFinalFailure) {
          // Log detailed error only on final failure
          this.logger.error('Request failed permanently', {
            method: context.method,
            url: context.url,
            attempt: attempt + 1,
            maxRetries: isInfiniteRetry ? 'infinite' : this.retryConfig.maxRetries,
            error: this.extractDetailedErrorMessage(lastError),
          });

          // Call handleError to transform the error before throwing
          this.handleError(lastError as AxiosError);
          throw error;
        }

        // Calculate delay and retry
        const delay = this.calculateRetryDelay(attempt);
        this.logger.warn('Request failed, retrying...', {
          method: context.method,
          url: context.url,
          attempt: attempt + 1,
          maxRetries: isInfiniteRetry ? 'infinite' : this.retryConfig.maxRetries,
          retryDelay: delay,
          error: this.extractDetailedErrorMessage(lastError),
        });

        await sleep(delay);
      }
    }

    // This should never happen, but TypeScript needs it
    throw lastError;
  }

  /**
   * Extract a detailed error message from various error types
   */
  private extractDetailedErrorMessage(error: any): string {
    // Handle AxiosError with response data
    if (error.response?.data) {
      const data = error.response.data;
      if (data.error?.message) {
        return data.error.message;
      }
      if (data.message) {
        return data.message;
      }
    }

    // Handle network errors with more context
    if (error.code) {
      // Axios error codes like ECONNREFUSED, ENOTFOUND, ETIMEDOUT, etc.
      return `${error.code}: ${error.message || 'Unknown error'}`;
    }

    // Default to error message
    return error.message || 'Unknown error';
  }

  /**
   * GET request (with retry)
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = { ...(config || {}) };
    const headers: Record<string, any> = { ...(requestConfig.headers || {}) };

    const cacheKey = this.buildCacheKey(url, requestConfig);
    const cachedEtag = this.etagStore.get(cacheKey);
    if (cachedEtag) {
      headers['If-None-Match'] = cachedEtag;
    }

    requestConfig.headers = headers;

    return this.executeWithRetry(
      async () => {
        const response = await this.client.get<ApiResponse<T>>(url, requestConfig);

        // Handle 304 Not Modified using cached response body
        if (response.status === 304) {
          const cachedBody = this.bodyCache.get(cacheKey) as ApiResponse<T> | undefined;
          if (cachedBody) {
            return {
              ...response,
              status: 200,
              data: cachedBody,
            } as AxiosResponse<ApiResponse<T>>;
          }

          // No cached body but got 304: fall back to a fresh request without conditional header
          const retryConfig: AxiosRequestConfig = {
            ...requestConfig,
            headers: { ...headers },
          };
          delete (retryConfig.headers as any)['If-None-Match'];
          delete (retryConfig.headers as any)['if-none-match'];

          const freshResponse = await this.client.get<ApiResponse<T>>(url, retryConfig);

          const freshEtag = (freshResponse.headers as any)?.etag as string | undefined;
          if (freshEtag) {
            this.etagStore.set(cacheKey, freshEtag);
            this.bodyCache.set(cacheKey, freshResponse.data);
          }

          return freshResponse;
        }

        // Normal 2xx response: capture ETag and cache body if present
        const etag = (response.headers as any)?.etag as string | undefined;
        if (etag) {
          this.etagStore.set(cacheKey, etag);
          this.bodyCache.set(cacheKey, response.data);
        }

        return response;
      },
      { method: 'GET', url }
    );
  }

  /**
   * POST request (with retry and auto-generated requestId in header)
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    // Auto-generate requestId if not provided in headers
    const requestConfig = config || {};
    const headers = requestConfig.headers || {};

    if (!headers['x-request-id']) {
      headers['x-request-id'] = ulid();
      this.logger.debug('Auto-generated requestId', {
        requestId: headers['x-request-id'],
        url,
      });
    }

    requestConfig.headers = headers;

    return this.executeWithRetry(() => this.client.post<ApiResponse<T>>(url, data, requestConfig), {
      method: 'POST',
      url,
    });
  }

  /**
   * POST request without retry (for operations like unregister that should not retry)
   */
  async postNoRetry<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    // Auto-generate requestId if not provided in headers
    const requestConfig = config || {};
    const headers = requestConfig.headers || {};

    if (!headers['x-request-id']) {
      headers['x-request-id'] = ulid();
      this.logger.debug('Auto-generated requestId', {
        requestId: headers['x-request-id'],
        url,
      });
    }

    requestConfig.headers = headers;

    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, requestConfig);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
      throw error;
    }
  }

  /**
   * PUT request (with retry and auto-generated requestId in header)
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    // Auto-generate requestId if not provided in headers
    const requestConfig = config || {};
    const headers = requestConfig.headers || {};

    if (!headers['x-request-id']) {
      headers['x-request-id'] = ulid();
      this.logger.debug('Auto-generated requestId', {
        requestId: headers['x-request-id'],
        url,
      });
    }

    requestConfig.headers = headers;

    return this.executeWithRetry(() => this.client.put<ApiResponse<T>>(url, data, requestConfig), {
      method: 'PUT',
      url,
    });
  }

  /**
   * PATCH request (with retry and auto-generated requestId in header)
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    // Auto-generate requestId if not provided in headers
    const requestConfig = config || {};
    const headers = requestConfig.headers || {};

    if (!headers['x-request-id']) {
      headers['x-request-id'] = ulid();
      this.logger.debug('Auto-generated requestId', {
        requestId: headers['x-request-id'],
        url,
      });
    }

    requestConfig.headers = headers;

    return this.executeWithRetry(
      () => this.client.patch<ApiResponse<T>>(url, data, requestConfig),
      { method: 'PATCH', url }
    );
  }

  /**
   * DELETE request (with retry)
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.executeWithRetry(() => this.client.delete<ApiResponse<T>>(url, config), {
      method: 'DELETE',
      url,
    });
  }

  /**
   * Get axios instance (for advanced usage)
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }

  /**
   * Invalidate ETag cache for a specific URL pattern
   * This forces the next request to fetch fresh data instead of returning cached 304 response
   * @param urlPattern URL or URL pattern (partial match) to invalidate
   */
  invalidateEtagCache(urlPattern: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.etagStore.keys()) {
      if (key.includes(urlPattern)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.etagStore.delete(key);
      this.bodyCache.delete(key);
    }
    if (keysToDelete.length > 0) {
      this.logger.debug('Invalidated ETag cache', {
        urlPattern,
        count: keysToDelete.length,
      });
    }
  }

  /**
   * Clear all ETag caches
   */
  clearAllEtagCache(): void {
    const count = this.etagStore.size;
    this.etagStore.clear();
    this.bodyCache.clear();
    this.logger.debug('Cleared all ETag cache', { count });
  }

  /**
   * Register a callback to be called when connection is recovered after retries
   * Callbacks are throttled to prevent multiple triggers in quick succession
   * @param callback Function to call on connection recovery
   * @returns Function to unregister the callback
   */
  onConnectionRecovered(callback: () => void): () => void {
    this.connectionRecoveryCallbacks.push(callback);
    return () => {
      const index = this.connectionRecoveryCallbacks.indexOf(callback);
      if (index !== -1) {
        this.connectionRecoveryCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Trigger connection recovery callbacks (with throttle)
   * Called internally when a request succeeds after retries
   */
  private triggerConnectionRecoveryCallbacks(): void {
    const now = Date.now();

    // Throttle: only trigger if enough time has passed since last trigger
    if (now - this.lastRecoveryTriggerTime < this.recoveryThrottleMs) {
      this.logger.debug('Connection recovery callback throttled', {
        timeSinceLastTrigger: now - this.lastRecoveryTriggerTime,
        throttleMs: this.recoveryThrottleMs,
      });
      return;
    }

    this.lastRecoveryTriggerTime = now;

    // Call all registered callbacks asynchronously (don't block the request)
    if (this.connectionRecoveryCallbacks.length > 0) {
      this.logger.debug('Triggering connection recovery callbacks', {
        count: this.connectionRecoveryCallbacks.length,
      });

      // Execute callbacks in a microtask to avoid blocking
      Promise.resolve().then(() => {
        for (const callback of this.connectionRecoveryCallbacks) {
          try {
            callback();
          } catch (error: any) {
            this.logger.error('Error in connection recovery callback', {
              error: error.message,
            });
          }
        }
      });
    }
  }
}
