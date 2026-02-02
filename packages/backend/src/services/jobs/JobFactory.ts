import logger from "../../config/logger";

// Job 실행 결과 인터페이스
export interface JobExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs: number;
}

// Job 실행 컨텍스트
export interface JobExecutionContext {
  jobId: number;
  jobName: string;
  jobType: string;
  jobDataMap: any;
  executionId: number;
  retryAttempt: number;
  maxRetryCount: number;
  timeoutSeconds: number;
}

// 기본 Job 인터페이스
export abstract class BaseJob {
  protected context: JobExecutionContext;

  constructor(context: JobExecutionContext) {
    this.context = context;
  }

  abstract execute(): Promise<JobExecutionResult>;

  public async executeWithTimeout(): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<JobExecutionResult>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Job execution timeout after ${this.context.timeoutSeconds} seconds`,
            ),
          );
        }, this.context.timeoutSeconds * 1000);
      });

      const executionPromise = this.execute();
      const result = await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;
      return {
        ...result,
        executionTimeMs: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Job execution failed: ${errorMessage}`, {
        jobId: this.context.jobId,
        jobType: this.context.jobType,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: executionTime,
      };
    }
  }

  protected validateRequiredFields(fields: string[]): void {
    const missing = fields.filter((field) => !this.context.jobDataMap[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }
  }
}

// Job Factory
export class JobFactory {
  private static jobTypes: Map<
    string,
    new (context: JobExecutionContext) => BaseJob
  > = new Map();

  static registerJobType(
    typeName: string,
    jobClass: new (context: JobExecutionContext) => BaseJob,
  ): void {
    this.jobTypes.set(typeName, jobClass);
    logger.info(`Registered job type: ${typeName}`);
  }

  static createJob(context: JobExecutionContext): BaseJob {
    const JobClass = this.jobTypes.get(context.jobType);
    if (!JobClass) {
      throw new Error(`Unknown job type: ${context.jobType}`);
    }

    return new JobClass(context);
  }

  static getRegisteredJobTypes(): string[] {
    return Array.from(this.jobTypes.keys());
  }

  static isJobTypeRegistered(typeName: string): boolean {
    return this.jobTypes.has(typeName);
  }
}

// Job 실행기
export class JobExecutor {
  static async executeJob(
    context: JobExecutionContext,
  ): Promise<JobExecutionResult> {
    try {
      logger.info(`Starting job execution`, {
        jobId: context.jobId,
        jobName: context.jobName,
        jobType: context.jobType,
        executionId: context.executionId,
        retryAttempt: context.retryAttempt,
      });

      const job = JobFactory.createJob(context);
      const result = await job.executeWithTimeout();

      logger.info(`Job execution completed`, {
        jobId: context.jobId,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Job execution failed`, {
        jobId: context.jobId,
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
