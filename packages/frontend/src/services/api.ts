import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse } from '@/types';

class ApiService {
  private api: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1',
      timeout: 10000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        // console.log('Request interceptor called:', {
        //   url: config.url,
        //   method: config.method,
        //   hasToken: !!this.accessToken,
        //   headers: config.headers,
        //   baseURL: config.baseURL
        // });

        if (this.accessToken) {
          if (!config.headers) {
            config.headers = {};
          }
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          // console.log('Request interceptor - Token added:', {
          //   url: config.url,
          //   method: config.method,
          //   tokenPrefix: this.accessToken.substring(0, 20) + '...',
          //   authHeader: config.headers.Authorization?.substring(0, 30) + '...'
          // });
        } else {
          // console.log('Request interceptor - No token available for:', {
          //   url: config.url,
          //   method: config.method
          // });
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

        if (error.response?.status === 401 && !originalRequest._retry) {
          // Don't retry if this is already a refresh request
          if (originalRequest.url?.includes('/auth/refresh')) {
            this.clearTokens();
            window.location.href = '/login';
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

          originalRequest._retry = true;

          try {
            // Try to refresh token
            // console.log('Attempting token refresh...');
            const refreshResponse = await this.api.post('/auth/refresh');
            const { accessToken } = refreshResponse.data.data;

            // console.log('Token refresh successful, new token:', accessToken?.substring(0, 20) + '...');
            this.setAccessToken(accessToken);

            // Ensure the new token is set in the original request
            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            // console.log('Retrying original request with new token:', {
            //   url: originalRequest.url,
            //   method: originalRequest.method,
            //   hasAuthHeader: !!originalRequest.headers.Authorization,
            //   tokenPrefix: accessToken?.substring(0, 20) + '...'
            // });

            return this.api(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Enhance error message for better user experience
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
          error.message = '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.code === 'ERR_NETWORK' || !error.response) {
          error.message = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
        } else if (error.response?.status === 500) {
          error.message = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.response?.status === 404) {
          error.message = '요청한 리소스를 찾을 수 없습니다.';
        } else if (error.response?.status === 403) {
          error.message = '접근 권한이 없습니다.';
        }

        return Promise.reject(error);
      }
    );
  }

  setAccessToken(token: string) {
    this.accessToken = token;

    // 토큰 정보 디버깅
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
  }

  // Generic request method
  private async request<T = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
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

      // 네트워크 오류 구분
      const isNetworkError = !error.response && (
        error.code === 'NETWORK_ERROR' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('ERR_NETWORK')
      );

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

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // File upload
  async upload<T = any>(url: string, file: File, fieldName: string = 'file', config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
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

  // Context Fields API
  async getContextFields(params?: { page?: number; limit?: number; search?: string; type?: string; isActive?: boolean }): Promise<ApiResponse<any>> {
    return this.get('/admin/remote-config/context-fields', { params });
  }

  async getContextField(id: string): Promise<ApiResponse<any>> {
    return this.get(`/admin/remote-config/context-fields/${id}`);
  }

  async createContextField(data: any): Promise<ApiResponse<any>> {
    return this.post('/admin/remote-config/context-fields', data);
  }

  async updateContextField(id: string, data: any): Promise<ApiResponse<any>> {
    return this.put(`/admin/remote-config/context-fields/${id}`, data);
  }

  async deleteContextField(id: string): Promise<ApiResponse<any>> {
    return this.delete(`/admin/remote-config/context-fields/${id}`);
  }

  async getContextFieldOperators(): Promise<ApiResponse<any>> {
    return this.get('/admin/remote-config/context-fields/operators/all');
  }

  async getContextFieldOperatorsForType(type: string): Promise<ApiResponse<any>> {
    return this.get(`/admin/remote-config/context-fields/operators/${type}`);
  }

  // Segments API (formerly Rules)
  async getSegments(): Promise<ApiResponse<any>> {
    return this.get('/admin/remote-config/segments');
  }

  async getSegment(id: string): Promise<ApiResponse<any>> {
    return this.get(`/admin/remote-config/segments/${id}`);
  }

  async createSegment(data: any): Promise<ApiResponse<any>> {
    return this.post('/admin/remote-config/segments', data);
  }

  async updateSegment(id: string, data: any): Promise<ApiResponse<any>> {
    return this.put(`/admin/remote-config/segments/${id}`, data);
  }

  async deleteSegment(id: string): Promise<ApiResponse<any>> {
    return this.delete(`/admin/remote-config/segments/${id}`);
  }
}

export const apiService = new ApiService();
export const api = apiService; // alias for convenience
export default apiService;
