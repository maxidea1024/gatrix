/**
 * HTTP API Client using Axios
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Logger } from '../utils/logger';
import { ErrorCode, createError } from '../utils/errors';
import { ApiResponse } from '../types/api';

export interface ApiClientConfig {
  baseURL: string;
  apiToken: string;
  applicationName: string;
  timeout?: number;
  logger?: Logger;
}

export class ApiClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(config: ApiClientConfig) {
    this.logger = config.logger || new Logger();

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
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.patch(url, data, config);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(url, config);
    return response.data;
  }

  /**
   * Get axios instance (for advanced usage)
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

