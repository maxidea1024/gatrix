/**
 * HTTP API Client using Axios
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ulid } from 'ulid';
import { Logger } from '../utils/logger';
import { ErrorCode, createError } from '../utils/errors';
import { ApiResponse } from '../types/api';
import { RetryConfig } from '../types/config';
import { SdkMetrics } from '../utils/sdkMetrics';

export interface ApiClientConfig {
  baseURL: string;
  apiToken: string;
  applicationName: string;
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

  constructor(config: ApiClientConfig) {
    this.logger = config.logger || new Logger();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.metrics = config.metrics;
    this.etagStore = new Map();
    this.bodyCache = new Map();

    // Create axios instance
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': config.apiToken,
        'X-Application-Name': config.applicationName,
      },
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

        this.handleError(error);
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
  private isRetryableError(error: AxiosError): boolean {
    if (!this.retryConfig.enabled) {
      return false;
    }

    // Network errors are retryable
    if (!error.response) {
      return true;
    }

    // Check if status code is retryable
    const status = error.response.status;
    return this.retryConfig.retryableStatusCodes.includes(status);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptNumber: number): number {
    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.retryDelayMultiplier, attemptNumber);
    return Math.min(delay, this.retryConfig.maxRetryDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    let lastError: AxiosError | undefined;
    const isInfiniteRetry = this.retryConfig.maxRetries === -1;
    const maxAttempts = isInfiniteRetry ? Number.MAX_SAFE_INTEGER : this.retryConfig.maxRetries;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fn();
        return response.data;
      } catch (error) {
        lastError = error as AxiosError;

        // If not retryable or last attempt, throw error
        if (!this.isRetryableError(lastError) || attempt === maxAttempts) {
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
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    // This should never happen, but TypeScript needs it
    throw lastError;
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
          const retryConfig: AxiosRequestConfig = { ...requestConfig, headers: { ...headers } };
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
      this.logger.debug('Auto-generated requestId', { requestId: headers['x-request-id'], url });
    }

    requestConfig.headers = headers;

    return this.executeWithRetry(
      () => this.client.post<ApiResponse<T>>(url, data, requestConfig),
      { method: 'POST', url }
    );
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
      this.logger.debug('Auto-generated requestId', { requestId: headers['x-request-id'], url });
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
      this.logger.debug('Auto-generated requestId', { requestId: headers['x-request-id'], url });
    }

    requestConfig.headers = headers;

    return this.executeWithRetry(
      () => this.client.put<ApiResponse<T>>(url, data, requestConfig),
      { method: 'PUT', url }
    );
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
      this.logger.debug('Auto-generated requestId', { requestId: headers['x-request-id'], url });
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
    return this.executeWithRetry(
      () => this.client.delete<ApiResponse<T>>(url, config),
      { method: 'DELETE', url }
    );
  }

  /**
   * Get axios instance (for advanced usage)
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

