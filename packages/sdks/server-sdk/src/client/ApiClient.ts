/**
 * HTTP API Client using Axios
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ulid } from 'ulid';
import { Logger } from '../utils/logger';
import { ErrorCode, createError } from '../utils/errors';
import { ApiResponse } from '../types/api';
import { RetryConfig } from '../types/config';

export interface ApiClientConfig {
  baseURL: string;
  apiToken: string;
  applicationName: string;
  timeout?: number;
  logger?: Logger;
  retry?: RetryConfig;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  enabled: true,
  maxRetries: 3,
  retryDelay: 1000,
  retryDelayMultiplier: 2,
  maxRetryDelay: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export class ApiClient {
  private client: AxiosInstance;
  private logger: Logger;
  private retryConfig: Required<RetryConfig>;

  constructor(config: ApiClientConfig) {
    this.logger = config.logger || new Logger();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };

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
        return response;
      },
      (error: AxiosError) => {
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
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<AxiosResponse<ApiResponse<T>>>,
    context: { method: string; url: string }
  ): Promise<ApiResponse<T>> {
    let lastError: AxiosError | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fn();
        return response.data;
      } catch (error) {
        lastError = error as AxiosError;

        // If not retryable or last attempt, throw error
        if (!this.isRetryableError(lastError) || attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        // Calculate delay and retry
        const delay = this.calculateRetryDelay(attempt);
        this.logger.warn('Request failed, retrying...', {
          method: context.method,
          url: context.url,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
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
    return this.executeWithRetry(
      () => this.client.get<ApiResponse<T>>(url, config),
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

