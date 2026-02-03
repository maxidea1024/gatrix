import { BaseJob, JobExecutionResult } from './JobFactory';
import logger from '../../config/logger';

interface LogMessageJobData {
  message: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category?: string;
  metadata?: Record<string, any>;
}

export class LogMessageJob extends BaseJob {
  async execute(): Promise<JobExecutionResult> {
    try {
      const data = this.context.jobDataMap as LogMessageJobData;

      // 필수 필드 검증
      if (!data.message) {
        throw new Error('Log message is required');
      }

      if (!data.level) {
        throw new Error('Log level is required');
      }

      // 유효한 로그 레벨 검증
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(data.level)) {
        throw new Error(
          `Invalid log level: ${data.level}. Valid levels are: ${validLevels.join(', ')}`
        );
      }

      // 로그 메타데이터 구성
      const logMetadata: Record<string, any> = {
        jobId: this.context.jobId,
        jobName: this.context.jobName,
        executionId: this.context.executionId,
        category: data.category || 'job',
      };

      // 사용자 정의 메타데이터 추가
      if (data.metadata && typeof data.metadata === 'object') {
        Object.assign(logMetadata, data.metadata);
      }

      // 로그 레벨에 따라 로그 기록
      switch (data.level) {
        case 'debug':
          logger.debug(data.message, logMetadata);
          break;
        case 'info':
          logger.info(data.message, logMetadata);
          break;
        case 'warn':
          logger.warn(data.message, logMetadata);
          break;
        case 'error':
          logger.error(data.message, logMetadata);
          break;
      }

      logger.info(`Log message job completed successfully`, {
        jobId: this.context.jobId,
        jobName: this.context.jobName,
        executionId: this.context.executionId,
        logLevel: data.level,
        messageLength: data.message.length,
      });

      return {
        success: true,
        data: {
          message: 'Log message recorded successfully',
          logLevel: data.level,
          messageLength: data.message.length,
          category: data.category || 'job',
          timestamp: new Date().toISOString(),
        },
        executionTimeMs: 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Log message job failed`, {
        jobId: this.context.jobId,
        jobName: this.context.jobName,
        executionId: this.context.executionId,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: 0,
      };
    }
  }
}
