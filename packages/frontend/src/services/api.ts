import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import i18next from 'i18next';
import { ApiResponse } from '@/types';

class ApiService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private refreshAttempts: Map<string, number> = new Map(); // Track refresh attempts per token
  private readonly MAX_REFRESH_ATTEMPTS = 1; // Only try refresh once per token

  constructor() {
    // Use relative path for API calls by default. Runtime config can override.
    // In development: Vite proxy routes /api to backend (http://localhost:5000)
    // In production: API calls go to the same origin, so '/api/v1' is safest
    let baseURL = (import.meta as any).env?.VITE_API_URL || '/api/v1';

    // Only use runtime config in production (when explicitly set)
    if (import.meta.env.PROD) {
      const runtimeEnv = (typeof window !== 'undefined' && (window as any)?.ENV?.VITE_API_URL) as
        | string
        | undefined;
      if (runtimeEnv && runtimeEnv.trim()) {
        baseURL = runtimeEnv.trim();
      }
    }

    // Force relative path in development if it's accidentally set to an absolute URL pointing to port 5000
    // This often happens due to old env files or misconfigured local environments
    if (
      !import.meta.env.PROD &&
      typeof baseURL === 'string' &&
      baseURL.includes('localhost:5000')
    ) {
      console.warn(
        '[ApiService] Detected absolute URL to localhost:5000 in dev. Forcing relative path /api/v1 to use Vite proxy.'
      );
      baseURL = '/api/v1';
    }

    this.api = axios.create({
      baseURL,
      timeout: 60000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token and environment ID
    this.api.interceptors.request.use(
      (config) => {
        if (!config.headers) {
          config.headers = {} as any;
        }

        // Add authorization header
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }

        // Add environment header for multi-environment support
        // Only set from localStorage if not explicitly provided in the request config
        const hasEnvironmentHeader =
          config.headers['x-environment-id'] || config.headers['X-Environment-Id'];
        if (!hasEnvironmentHeader) {
          const environmentId =
            typeof window !== 'undefined'
              ? localStorage.getItem('gatrix_selected_environment_id')
              : null;
          if (environmentId) {
            config.headers['X-Environment-Id'] = environmentId;
          }
        }

        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors and token refresh
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Check for "user not found" error - this happens when user is deleted but token is still valid
        // Redirect to session expired page to prevent infinite loop
        // BUT skip for login requests - login USER_NOT_FOUND should show error on login page
        if (
          error.response?.status === 404 &&
          !originalRequest.url?.includes('/auth/login') &&
          (error.response?.data?.message === 'USER_NOT_FOUND' ||
            error.response?.data?.error?.message === 'USER_NOT_FOUND' ||
            error.response?.data?.message?.includes('User not found'))
        ) {
          // Clear all auth data
          this.clearTokens();
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
          }
          // Redirect to session expired page
          if (typeof window !== 'undefined' && window.location.pathname !== '/session-expired') {
            window.location.href = '/session-expired';
          }
          return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          // Don't retry if this is already a refresh request
          if (originalRequest.url?.includes('/auth/refresh')) {
            console.warn(
              '[ApiService] Token refresh failed with 401 - JWT Secret may have changed'
            );
            this.clearTokens();
            // Clear localStorage to prevent infinite loop
            if (typeof window !== 'undefined') {
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
            }
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          }

          // Don't retry for login requests - login failures should not trigger token refresh
          if (originalRequest.url?.includes('/auth/login')) {
            return Promise.reject(error);
          }

          // Don't retry for register requests
          if (originalRequest.url?.includes('/auth/register')) {
            return Promise.reject(error);
          }

          // If we don't have an access token at all, avoid refresh storm and go to login directly
          if (!this.accessToken) {
            this.clearTokens();
            // Clear localStorage to prevent infinite loop
            if (typeof window !== 'undefined') {
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
            }
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          }

          // Check if we've already attempted to refresh this token
          const tokenKey = this.accessToken.substring(0, 20);
          const attemptCount = this.refreshAttempts.get(tokenKey) || 0;

          if (attemptCount >= this.MAX_REFRESH_ATTEMPTS) {
            console.warn('[ApiService] Max refresh attempts reached - JWT Secret may have changed');
            this.clearTokens();
            this.refreshAttempts.delete(tokenKey);
            // Clear localStorage to prevent infinite loop
            if (typeof window !== 'undefined') {
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
            }
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          }

          originalRequest._retry = true;
          this.refreshAttempts.set(tokenKey, attemptCount + 1);

          try {
            // Try to refresh token
            const refreshResponse = await this.api.post('/auth/refresh');
            // refreshResponse is already { success, data: { accessToken }, message }
            // because api.request() returns response.data
            const { accessToken } = refreshResponse.data;

            this.setAccessToken(accessToken);
            this.refreshAttempts.delete(tokenKey); // Clear attempt counter on success

            // Ensure the new token is set in the original request
            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            return this.api(originalRequest);
          } catch (refreshError) {
            // Refresh failed - JWT Secret may have changed
            console.warn(
              '[ApiService] Token refresh failed - clearing auth data and redirecting to login'
            );
            this.clearTokens();
            this.refreshAttempts.delete(tokenKey);
            // Clear localStorage to prevent infinite loop
            if (typeof window !== 'undefined') {
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
            }
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        // Handle 403 Forbidden - dispatch a global event for the UI layer to display a snackbar
        // Deduplicate: only fire once within a cooldown window
        if (error.response?.status === 403) {
          error.message = error.response?.data?.error?.message || 'Insufficient permissions';
          if (typeof window !== 'undefined') {
            const now = Date.now();
            const lastForbidden = (window as any).__lastForbiddenAt || 0;
            if (now - lastForbidden > 3000) {
              (window as any).__lastForbiddenAt = now;
              window.dispatchEvent(new CustomEvent('gatrix:forbidden', {
                detail: { url: error.config?.url, message: error.message },
              }));
            }
          }
        }

        // Enhance error message for better user experience
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
          error.message = i18next.t('errors.timeout');
        } else if (error.code === 'ERR_NETWORK' || !error.response) {
          error.message = i18next.t('errors.networkError');
        } else if (error.response?.status === 500) {
          error.message = i18next.t('errors.serverError');
        } else if (error.response?.status === 404) {
          error.message = i18next.t('errors.notFound');
        }

        return Promise.reject(error);
      }
    );
  }

  setAccessToken(token: string) {
    this.accessToken = token;

    // Token information debugging
    // try {
    //   const payload = JSON.parse(atob(token.split('.')[1]));
    //   console.log('Token set:', {
    //     userId: payload.userId,
    //     role: payload.role,
    //     exp: payload.exp,
    //     expiresAt: new Date(payload.exp * 1000).toISOString(),
    //     timeUntilExpiry: Math.round((payload.exp * 1000 - Date.now()) / 1000 / 60) + ' minutes'
    //   });
    // } catch (e) {
    //   console.log('Could not decode token:', token.substring(0, 20) + '...');
    // }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshAttempts.clear(); // Clear all refresh attempt counters
  }

  // Generic request method
  private async request<T = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      // console.log('[ApiService] Request:', {
      //   url: config.url,
      //   method: config.method,
      //   baseURL: this.api.defaults.baseURL,
      //   fullURL: `${this.api.defaults.baseURL}${config.url}`
      // });
      const response = await this.api.request<ApiResponse<T>>(config);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        // Add status code to the error data
        const errorData = {
          ...error.response.data,
          status: error.response.status,
        };
        throw errorData;
      }

      // Network error classification
      const isNetworkError =
        !error.response &&
        (error.code === 'NETWORK_ERROR' ||
          error.code === 'ECONNREFUSED' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('ERR_NETWORK'));

      throw {
        success: false,
        error: {
          message: error.message || 'Network error occurred',
        },
        status: error.response?.status || 500,
        code: isNetworkError ? 'NETWORK_ERROR' : error.code,
        isNetworkError,
      };
    }
  }

  // HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // File upload
  async upload<T = any>(
    url: string,
    file: File,
    fieldName: string = 'file',
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);

    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Download file
  async download(url: string, filename?: string, config?: AxiosRequestConfig): Promise<void> {
    try {
      const response = await this.api.request({
        ...config,
        method: 'GET',
        url,
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      throw error;
    }
  }
}

export const apiService = new ApiService();
export const api = apiService; // alias for convenience

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__GATRIX_API_SERVICE__ = apiService;
  (window as any).__GATRIX_API_INSTANCE__ = apiService['api'];
}

export default apiService;
