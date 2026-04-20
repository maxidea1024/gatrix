/**
 * Scheduler Job Handlers
 *
 * Registers all scheduler job handlers with QueueService.
 * Each handler is isolated and imported dynamically to avoid circular dependencies.
 */
import { Job } from 'bullmq';
import { createLogger } from '../config/logger';

const logger = createLogger('schedulerJobs');
import { CouponSettingsService } from './coupon-settings-service';

export interface QueueJobData {
  type: string;
  payload: any;
  timestamp: number;
}

export type SchedulerJobHandler = (job: Job<QueueJobData>) => Promise<void>;

/**
 * All scheduler job handlers.
 * Key = job name (matches the repeatable job name registered in QueueService.initialize()).
 */
export function getSchedulerHandlers(): Record<string, SchedulerJobHandler> {
  return {
    'coupon:expire': async (job) => {
      const affected = await CouponSettingsService.disableExpiredCoupons();
      logger.info('coupon:expire completed', { jobId: job.id, affected });
    },

    'lifecycle:cleanup': async (job) => {
      const { processLifecycleCleanupJob } =
        await import('./lifecycle-cleanup-scheduler');
      const retentionDays = job.data?.payload?.retentionDays ?? 14;
      const deleted = await processLifecycleCleanupJob(retentionDays);
      logger.info('lifecycle:cleanup completed', { jobId: job.id, deleted });
    },

    'planning:cleanup': async (job) => {
      const { PlanningDataService } = await import('./planning-data-service');
      const result = await PlanningDataService.cleanupAllEnvironments();
      logger.info('planning:cleanup completed', { jobId: job.id, ...result });
    },

    'change-request:cleanup': async (job) => {
      const { ChangeRequestService } = await import('./change-request-service');
      const retentionDays = parseInt(
        process.env.CHANGE_REQUEST_REJECTION_RETENTION_DAYS || '14',
        10
      );
      const deleted = await ChangeRequestService.cleanupRejected(retentionDays);
      logger.info('change-request:cleanup completed', {
        jobId: job.id,
        deleted,
        retentionDays,
      });
    },

    'outbox:process': async (job) => {
      const { processOutboxJob } = await import('./outbox-scheduler');
      const batchSize = job.data?.payload?.batchSize ?? 20;
      const processed = await processOutboxJob(batchSize);
      logger.info('outbox:process completed', { jobId: job.id, processed });
    },

    'outbox:cleanup': async (job) => {
      const { cleanupOutboxJob } = await import('./outbox-scheduler');
      const outboxRetentionDays = job.data?.payload?.retentionDays ?? 7;
      const outboxDeleted = await cleanupOutboxJob(outboxRetentionDays);
      logger.info('outbox:cleanup completed', {
        jobId: job.id,
        deleted: outboxDeleted,
      });
    },

    'lock:cleanup': async (job) => {
      const { cleanupLocksJob } = await import('./outbox-scheduler');
      const locksDeleted = await cleanupLocksJob();
      logger.info('lock:cleanup completed', {
        jobId: job.id,
        deleted: locksDeleted,
      });
    },

    'unknown-flags:flush': async (job) => {
      const { processUnknownFlagsFlushJob } =
        await import('./unknown-flag-service');
      const result = await processUnknownFlagsFlushJob();
      if (result.flushed > 0 || result.errors > 0) {
        logger.info('unknown-flags:flush completed', {
          jobId: job.id,
          ...result,
        });
      }
    },

    'release-flow:milestone-progression': async (job) => {
      const planId = job.data?.payload?.planId;
      if (!planId) {
        logger.warn('release-flow:milestone-progression missing planId', {
          jobId: job.id,
        });
        return;
      }
      const { releaseFlowService } = await import('./release-flow-service');
      const { safeguardService } = await import('./safeguard-service');
      const { ReleaseFlowModel } = await import('../models/release-flow');

      const plan = await ReleaseFlowModel.findById(planId);
      if (!plan || plan.status !== 'active' || plan.discriminator !== 'plan') {
        logger.info(
          'release-flow:milestone-progression skipped (plan not active)',
          {
            jobId: job.id,
            planId,
            status: plan?.status,
          }
        );
        return;
      }

      // Evaluate safeguards before progression
      if (plan.activeMilestoneId) {
        const { anyTriggered, results } =
          await safeguardService.evaluateMilestoneSafeguards(
            plan.activeMilestoneId
          );
        if (anyTriggered) {
          const triggeredNames = results
            .filter((r) => r.triggered)
            .map((r) => r.metricName)
            .join(', ');
          logger.warn(
            `release-flow:milestone-progression safeguard triggered (${triggeredNames}), pausing plan ${planId}`
          );
          await releaseFlowService.pausePlan(planId, '');
          return;
        }
      }

      logger.info(
        `release-flow:milestone-progression progressing plan ${planId}`
      );
      await releaseFlowService.progressToNextMilestone(planId);
    },

    'release-flow:progression-check': async (job) => {
      const { ReleaseFlowScheduler } = await import('./release-flow-scheduler');
      await ReleaseFlowScheduler.getInstance().checkAndProgressMilestones();
      logger.info('release-flow:progression-check completed', {
        jobId: job.id,
      });
    },

    'signal:process': async (job) => {
      const { ActionExecutionService } =
        await import('./action-execution-service');
      const signalResult =
        await ActionExecutionService.processUnprocessedSignals();
      if (signalResult.processed > 0 || signalResult.errors > 0) {
        logger.info('signal:process completed', {
          jobId: job.id,
          ...signalResult,
        });
      }
    },

    'file-storage:cleanup': async (job) => {
      const { processFileStorageCleanupJob } =
        await import('./file-storage-cleanup-scheduler');
      const retentionDays = job.data?.payload?.retentionDays ?? 30;
      const deleted = await processFileStorageCleanupJob(retentionDays);
      logger.info('file-storage:cleanup completed', { jobId: job.id, deleted });
    },

    'ccu:poll': async (job) => {
      const { ccuPollingService } = await import('./ccu-polling-service');
      await ccuPollingService.pollAll();
      logger.info('ccu:poll completed', { jobId: job.id });
    },
  };
}
