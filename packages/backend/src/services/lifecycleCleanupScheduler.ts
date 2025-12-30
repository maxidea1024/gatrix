import { config } from '../config';
import ServerLifecycleEvent from '../models/ServerLifecycleEvent';
import logger from '../config/logger';
import redisClient from '../config/redis';

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// Lock key for distributed cleanup
const CLEANUP_LOCK_KEY = 'gatrix:lifecycle-cleanup:lock';
// Lock TTL in seconds (5 minutes to allow for long-running cleanup operations)
const LOCK_TTL_SECONDS = 300;

/**
 * Start the lifecycle event cleanup scheduler
 * Runs periodically to delete old lifecycle events
 * Uses distributed locking via Redis to prevent multiple backend instances from running cleanup simultaneously
 */
export function startLifecycleCleanupScheduler(): void {
    const retentionDays = config.serviceDiscovery?.lifecycleEventRetentionDays ?? 14;

    logger.info(`Starting lifecycle event cleanup scheduler (retention: ${retentionDays} days)`);

    // Run cleanup immediately on startup (with lock)
    runCleanupWithLock(retentionDays);

    // Schedule cleanup to run every hour (to check if cleanup is needed)
    // The actual cleanup will only run once per day due to the lock mechanism
    const ONE_HOUR_MS = 60 * 60 * 1000;
    cleanupInterval = setInterval(() => {
        runCleanupWithLock(retentionDays);
    }, ONE_HOUR_MS);
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
 * Run the cleanup operation with distributed locking
 * Only one backend instance will run the cleanup at a time
 */
async function runCleanupWithLock(retentionDays: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyLockKey = `${CLEANUP_LOCK_KEY}:${today}`;

    try {
        // Try to acquire the daily lock
        // If we get the lock, no other instance has run cleanup today
        const acquired = await redisClient.acquireLock(dailyLockKey, LOCK_TTL_SECONDS);

        if (!acquired) {
            logger.debug('Lifecycle cleanup already running or completed today by another instance');
            return;
        }

        logger.info('Acquired lifecycle cleanup lock, running cleanup...');

        // Run the actual cleanup
        const deletedCount = await ServerLifecycleEvent.deleteOldEvents(retentionDays);
        if (deletedCount > 0) {
            logger.info(`Deleted ${deletedCount} lifecycle events older than ${retentionDays} days`);
        } else {
            logger.debug('No old lifecycle events to delete');
        }

        // Keep the lock until end of day to prevent other instances from running
        // The lock will auto-expire after LOCK_TTL_SECONDS if not released
        // We intentionally don't release it to prevent re-runs within the same day
    } catch (error) {
        logger.error('Failed to run lifecycle cleanup with lock:', error);
        // Release the lock on error so another instance can try
        try {
            await redisClient.releaseLock(dailyLockKey);
        } catch (releaseError) {
            logger.error('Failed to release cleanup lock:', releaseError);
        }
    }
}
