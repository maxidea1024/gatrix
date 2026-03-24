import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BaseJob, JobExecutionResult } from './job-factory';
import { createLogger } from '../../config/logger';

const logger = createLogger('HttpRequestJob');
import { HEADERS, HEADER_VALUES } from '../../constants/headers';

export class HttpRequestJob extends BaseJob {
  async execute(): Promise<JobExecutionResult> {
    try {
      // Validate required fields
      this.validateRequiredFields(['url', 'method']);

      const {
        url,
        method,
        headers = {},
        body,
        timeout = 30000,
        validateStatus,
        auth,
      } = this.context.jobDataMap;

      // Axios Request Settings
      const config: AxiosRequestConfig = {
        url,
        method: method.toUpperCase(),
        headers,
        timeout,
        validateStatus: validateStatus || ((status) => status < 500), // Only treat 5xx errors as failures
      };

      // Set request body
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        if (typeof body === 'string') {
          config.data = body;
        } else {
          config.data = body;
          // Set Content-Type for JSON requests
          if (!headers[HEADERS.CONTENT_TYPE] && !headers['content-type']) {
            config.headers = {
              ...config.headers,
              [HEADERS.CONTENT_TYPE]: HEADER_VALUES.APPLICATION_JSON,
            };
          }
        }
      }

      // Authentication Settings
      if (auth) {
        if (auth.type === 'basic' && auth.username && auth.password) {
          config.auth = {
            username: auth.username,
            password: auth.password,
          };
        } else if (auth.type === 'bearer' && auth.token) {
          config.headers = {
            ...config.headers,
            [HEADERS.AUTHORIZATION]: `${HEADER_VALUES.BEARER_PREFIX}${auth.token}`,
          };
        }
      }

      logger.info(`Making HTTP request`, {
        jobId: this.context.jobId,
        method: config.method,
        url: config.url,
      });

      // Execute HTTP request
      const response: AxiosResponse = await axios(config);

      logger.info(`HTTP request completed`, {
        jobId: this.context.jobId,
        status: response.status,
        statusText: response.statusText,
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
            headers: response.config.headers,
          },
        },
        executionTimeMs: 0, // Will be set by executeWithTimeout
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(`HTTP request job failed`, {
        jobId: this.context.jobId,
        error: errorMessage,
        response: (error as any).response
          ? {
              status: (error as any).response.status,
              statusText: (error as any).response.statusText,
              data: (error as any).response.data,
            }
          : undefined,
      });

      // Include response info for Axios errors
      if ((error as any).response) {
        return {
          success: false,
          error: `HTTP ${(error as any).response.status}: ${(error as any).response.statusText}`,
          data: {
            status: (error as any).response.status,
            statusText: (error as any).response.statusText,
            headers: (error as any).response.headers,
            data: (error as any).response.data,
          },
          executionTimeMs: 0,
        };
      }

      throw error;
    }
  }
}
