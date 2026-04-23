import { queueService } from './queue-service';
import { JobModel } from '../models/job';
import { createLogger } from '../config/logger';

const logger = createLogger('JobSchedulerService');

export class JobSchedulerService {
  private static readonly QUEUE_NAME = 'scheduler';
  private static readonly JOB_TYPE_PREFIX = 'user-job:';

  /**
   * Syncs a Gatrix Job with BullMQ.
   * If the job has a cronExpression or triggerAt, it will be scheduled.
   * If it doesn't, or it's disabled, any existing schedules will be removed.
   */
  static async syncJob(jobId: string, environmentId: string): Promise<void> {
    try {
      const job = await JobModel.findById(jobId, environmentId);
      if (!job) {
        await this.unsyncJob(jobId);
        return;
      }

      await this.unsyncJob(jobId);

      if (!job.isEnabled) {
        logger.info(`Job ${jobId} is disabled. Skipping schedule sync.`);
        return;
      }

      const bullJobName = `${this.JOB_TYPE_PREFIX}${jobId}`;
      const payload = { jobId, environmentId };
      const options: any = { jobId: bullJobName };

      // Apply retry policy
      if (job.retryPolicy) {
        let retryPolicy;
        if (typeof job.retryPolicy === 'string') {
          try {
            retryPolicy = JSON.parse(job.retryPolicy);
          } catch (e) {}
        } else {
          retryPolicy = job.retryPolicy;
        }

        if (retryPolicy) {
          options.attempts = retryPolicy.maxRetries || 3;
          options.backoff = {
            type: 'fixed',
            delay: retryPolicy.backoffMs || 1000,
          };
        }
      }

      if (job.cronExpression) {
        options.repeat = {
          pattern: job.cronExpression,
          tz: job.timezone || 'Asia/Seoul',
        };
        await queueService.addJob(
          this.QUEUE_NAME,
          bullJobName,
          payload,
          options
        );
        logger.info(
          `Registered repeatable job for ${jobId} with cron ${job.cronExpression}`
        );
      } else if (job.triggerAt) {
        const triggerDate = new Date(job.triggerAt);
        const delay = triggerDate.getTime() - Date.now();
        if (delay > 0) {
          options.delay = delay;
          await queueService.addJob(
            this.QUEUE_NAME,
            bullJobName,
            payload,
            options
          );
          logger.info(
            `Registered delayed job for ${jobId} to trigger in ${delay}ms`
          );
        } else {
          logger.warn(`Job ${jobId} triggerAt is in the past. Not scheduling.`);
        }
      }
    } catch (error) {
      logger.error(`Failed to sync job ${jobId} with scheduler:`, error);
    }
  }

  /**
   * Removes any scheduled jobs (repeatable or delayed) for the given Gatrix Job ID.
   */
  static async unsyncJob(jobId: string): Promise<void> {
    try {
      const bullJobName = `${this.JOB_TYPE_PREFIX}${jobId}`;
      const repeatables = await queueService.listRepeatable(this.QUEUE_NAME);

      const repeatableJob = repeatables.find((r) => r.name === bullJobName);
      if (repeatableJob) {
        await queueService.removeRepeatable(this.QUEUE_NAME, repeatableJob.key);
        logger.info(`Removed repeatable job for ${jobId}`);
      }

      // Also try to find and remove delayed jobs with this custom jobId
      const queue = queueService.getQueue(this.QUEUE_NAME);
      if (queue) {
        const delayedJobs = await queue.getDelayed();
        const jobToRemove = delayedJobs.find(
          (j) => j.opts.jobId === bullJobName
        );
        if (jobToRemove) {
          await jobToRemove.remove();
          logger.info(`Removed delayed job for ${jobId}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to unsync job ${jobId}:`, error);
    }
  }
}
