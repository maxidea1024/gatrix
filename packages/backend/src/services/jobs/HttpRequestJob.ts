import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BaseJob, JobExecutionResult } from './JobFactory';
import logger from '../../config/logger';

export class HttpRequestJob extends BaseJob {
  async execute(): Promise<JobExecutionResult> {
    try {
      // 필수 필드 검증
      this.validateRequiredFields(['url', 'method']);

      const { 
        url, 
        method, 
        headers = {}, 
        body, 
        timeout = 30000,
        validateStatus,
        auth
      } = this.context.jobDataMap;

      // Axios 요청 설정
      const config: AxiosRequestConfig = {
        url,
        method: method.toUpperCase(),
        headers,
        timeout,
        validateStatus: validateStatus || ((status) => status < 500) // 5xx 에러만 실패로 처리
      };

      // 요청 본문 설정
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        if (typeof body === 'string') {
          config.data = body;
        } else {
          config.data = body;
          // JSON 요청인 경우 Content-Type 설정
          if (!headers['Content-Type'] && !headers['content-type']) {
            config.headers = {
              ...config.headers,
              'Content-Type': 'application/json'
            };
          }
        }
      }

      // 인증 설정
      if (auth) {
        if (auth.type === 'basic' && auth.username && auth.password) {
          config.auth = {
            username: auth.username,
            password: auth.password
          };
        } else if (auth.type === 'bearer' && auth.token) {
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${auth.token}`
          };
        }
      }

      logger.info(`Making HTTP request`, {
        jobId: this.context.jobId,
        method: config.method,
        url: config.url
      });

      // HTTP 요청 실행
      const response: AxiosResponse = await axios(config);

      logger.info(`HTTP request completed`, {
        jobId: this.context.jobId,
        status: response.status,
        statusText: response.statusText
      });

      return {
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          config: {
            url: response.config.url,
            method: response.config.method,
            headers: response.config.headers
          }
        },
        executionTimeMs: 0 // Will be set by executeWithTimeout
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`HTTP request job failed`, {
        jobId: this.context.jobId,
        error: errorMessage,
        response: (error as any).response ? {
          status: (error as any).response.status,
          statusText: (error as any).response.statusText,
          data: (error as any).response.data
        } : undefined
      });

      // Axios 에러인 경우 응답 정보도 포함
      if ((error as any).response) {
        return {
          success: false,
          error: `HTTP ${(error as any).response.status}: ${(error as any).response.statusText}`,
          data: {
            status: (error as any).response.status,
            statusText: (error as any).response.statusText,
            headers: (error as any).response.headers,
            data: (error as any).response.data
          },
          executionTimeMs: 0
        };
      }

      throw error;
    }
  }
}
