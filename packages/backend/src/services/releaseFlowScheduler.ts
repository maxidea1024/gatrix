import logger from '../config/logger';
import { QueueService, queueService } from './QueueService';
import { ReleaseFlowMilestoneModel } from '../models/ReleaseFlow';
import { releaseFlowService } from './ReleaseFlowService';

/**
 * Scheduler for automating release flow milestone progressions.
 * Checks active plans every minute and progresses milestones when
 * their transition condition (intervalMinutes) has elapsed.
 */
export class ReleaseFlowScheduler {
    private static instance: ReleaseFlowScheduler;
    private queueService: QueueService;
    private isRunning = false;
    private checkInProgress = false;

    private constructor() {
        this.queueService = queueService;
    }

    public static getInstance(): ReleaseFlowScheduler {
        if (!ReleaseFlowScheduler.instance) {
            ReleaseFlowScheduler.instance = new ReleaseFlowScheduler();
        }
        return ReleaseFlowScheduler.instance;
    }

    /**
     * Start the release flow scheduler
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Release flow scheduler is already running');
            return;
        }

        logger.info('Starting release flow scheduler...');

        try {
            // Schedule periodic check every minute using QueueService
            const repeatables = await this.queueService.listRepeatable('scheduler');
            const exists = repeatables.some((j) => j.name === 'release-flow:progression-check');

            if (!exists) {
                await this.queueService.addJob(
                    'scheduler',
                    'release-flow:progression-check',
                    {},
                    {
                        repeat: { pattern: '* * * * *' }, // Every minute
                    }
                );
                logger.info('Scheduled release-flow:progression-check job');
            } else {
                logger.info('release-flow:progression-check job already scheduled');
            }

            this.isRunning = true;
            logger.info('Release flow scheduler started successfully');
        } catch (error) {
            logger.error('Error starting release flow scheduler:', error);
            throw error;
        }
    }

    /**
     * Stop the release flow scheduler
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Release flow scheduler is not running');
            return;
        }

        logger.info('Stopping release flow scheduler...');

        try {
            const repeatables = await this.queueService.listRepeatable('scheduler');
            for (const job of repeatables) {
                if (job.name === 'release-flow:progression-check') {
                    await this.queueService.removeRepeatable('scheduler', job.key);
                }
            }

            this.isRunning = false;
            logger.info('Release flow scheduler stopped successfully');
        } catch (error) {
            logger.error('Error stopping release flow scheduler:', error);
            this.isRunning = false;
        }
    }

    /**
     * Check all active plans and progress milestones when transition conditions are met.
     * This is the main scheduler loop called every minute.
     */
    public async checkAndProgressMilestones(): Promise<void> {
        if (this.checkInProgress) {
            logger.debug('Release flow progression check already in progress, skipping...');
            return;
        }

        this.checkInProgress = true;
        try {
            const activePlans = await ReleaseFlowMilestoneModel.findActivePlansWithTransitions();

            if (activePlans.length === 0) {
                return;
            }

            const now = new Date();
            let progressedCount = 0;

            for (const plan of activePlans) {
                try {
                    const { flowId, startedAt, transitionCondition } = plan;

                    if (!transitionCondition?.intervalMinutes || !startedAt) {
                        continue;
                    }

                    // Calculate if the wait time has elapsed
                    const elapsedMs = now.getTime() - new Date(startedAt).getTime();
                    const requiredMs = transitionCondition.intervalMinutes * 60 * 1000;

                    if (elapsedMs >= requiredMs) {
                        logger.info(`Release flow progression: plan ${flowId} milestone elapsed, progressing...`);
                        await releaseFlowService.progressToNextMilestone(flowId);
                        progressedCount++;
                    }
                } catch (error) {
                    logger.error(`Error progressing release flow plan ${plan.flowId}:`, error);
                    // Continue with other plans even if one fails
                }
            }

            if (progressedCount > 0) {
                logger.info(`Release flow scheduler: progressed ${progressedCount} milestone(s)`);
            }
        } catch (error) {
            logger.error('Error in checkAndProgressMilestones:', error);
        } finally {
            this.checkInProgress = false;
        }
    }
}
