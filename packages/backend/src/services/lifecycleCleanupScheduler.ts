import config from '../config';
import ServerLifecycleEvent from '../models/ServerLifecycleEvent';
import logger from '../config/logger';

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the lifecycle event cleanup scheduler
 * Runs once per day to delete old lifecycle events
 */
export function startLifecycleCleanupScheduler(): void {
    const retentionDays = config.serviceDiscovery.lifecycleEventRetentionDays;

    logger.info(`Starting lifecycle event cleanup scheduler (retention: ${retentionDays} days)`);

    // Run cleanup immediately on startup
    runCleanup(retentionDays);

    // Schedule cleanup to run once per day (24 hours)
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    cleanupInterval = setInterval(() => {
        runCleanup(retentionDays);
    }, ONE_DAY_MS);
}

/**
 * Stop the lifecycle event cleanup scheduler
 */
export function stopLifecycleCleanupScheduler(): void {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        logger.info('Stopped lifecycle event cleanup scheduler');
    }
}

/**
 * Run the cleanup operation
 */
async function runCleanup(retentionDays: number): Promise<void> {
    try {
        const deletedCount = await ServerLifecycleEvent.deleteOldEvents(retentionDays);
        if (deletedCount > 0) {
            logger.info(`Deleted ${deletedCount} lifecycle events older than ${retentionDays} days`);
        }
    } catch (error) {
        logger.error('Failed to cleanup old lifecycle events:', error);
    }
}
