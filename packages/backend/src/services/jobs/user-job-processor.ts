import { Job as BullJob } from 'bullmq';
import { JobModel } from '../../models/job';
import { JobTypeModel } from '../../models/job-type';
import { JobExecutionModel, JobExecutionStatus } from '../../models/job-execution';
import { createLogger } from '../../config/logger';

const logger = createLogger('UserJobProcessor');
const jobLogger = createLogger('JobExecution');

export async function processUserJob(job: BullJob): Promise<void> {
  const { jobId, environmentId } = job.data?.payload || {};

  if (!jobId || !environmentId) {
    logger.error('Missing jobId or environmentId in scheduled job payload', { id: job.id });
    return;
  }

  logger.info(`Starting execution of user job ${jobId}`);

  try {
    // 1. Fetch job
    const userJob = await JobModel.findById(jobId, environmentId);
    if (!userJob) {
      logger.error(`Job ${jobId} not found, unsyncing from scheduler...`);
      const { JobSchedulerService } = await import('../job-scheduler-service');
      await JobSchedulerService.unsyncJob(jobId);
      return;
    }

    if (!userJob.isEnabled) {
      logger.info(`Job ${jobId} is disabled, skipping execution.`);
      return;
    }

    // 2. Create execution record
    const execution = await JobExecutionModel.create({
      jobId: jobId,
      status: JobExecutionStatus.PENDING,
      triggeredBy: 'schedule'
    });

    // 3. Mark running
    const startTime = Date.now();
    await JobExecutionModel.update(execution.id, {
      status: JobExecutionStatus.RUNNING,
      startedAt: new Date(),
    });

    // Update nextExecutionAt on the job model if repeatable
    // For single-fire jobs, nextExecutionAt can be cleared. BullMQ handles its own scheduling, but we can reflect it in DB.
    const now = new Date();
    await JobModel.update(jobId, { lastExecutedAt: now }, environmentId);

    // 4. Execute based on job type
    try {
      const jobType = await JobTypeModel.findById(userJob.jobTypeId, environmentId);
      const jobData = userJob.jobDataMap || {};
      let result: any = {};

      switch (jobType?.name) {
        case 'log_message':
          jobLogger.info(
            `[Job:${userJob.name}] ${jobData.message || '(no message)'}`,
            {
              level: jobData.level || 'info',
              category: jobData.category || 'job',
            }
          );
          result = { logged: true, message: jobData.message };
          break;

        case 'http_request':
          // TODO: Implement HTTP request execution
          result = { message: 'HTTP request execution not yet implemented' };
          break;

        case 'mailsend':
          // TODO: Implement mail sending
          result = { message: 'Mail sending not yet implemented' };
          break;

        case 'ssh_command':
          // TODO: Implement SSH command execution
          result = { message: 'SSH command execution not yet implemented' };
          break;

        default:
          result = { message: `Unknown job type: ${jobType?.name}` };
          break;
      }

      const executionTimeMs = Date.now() - startTime;
      await JobExecutionModel.update(execution.id, {
        status: JobExecutionStatus.COMPLETED,
        completedAt: new Date(),
        executionTimeMs,
        result,
      });

      logger.info(`Job ${jobId} executed successfully in ${executionTimeMs}ms`);
    } catch (execError: any) {
      const executionTimeMs = Date.now() - startTime;
      await JobExecutionModel.update(execution.id, {
        status: JobExecutionStatus.FAILED,
        completedAt: new Date(),
        executionTimeMs,
        errorMessage: execError.message || 'Unknown execution error',
      });
      
      logger.error(`Job ${jobId} execution failed:`, execError);
      throw execError; // Rethrow to let BullMQ handle retry policy
    }
  } catch (error) {
    logger.error(`Critical error processing user job ${jobId}:`, error);
    throw error;
  }
}
