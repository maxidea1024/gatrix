import { config } from '../config';
import ServerLifecycleEvent from '../models/ServerLifecycleEvent';
import logger from '../config/logger';
import { queueService } from './QueueService';

/**
 * Initialize lifecycle cleanup job
 * Registers a daily repeatable job in BullMQ scheduler queue
 * This ensures only one instance runs the cleanup across all backend instances
 */
export async function initializeLifecycleCleanupJob(): Promise<void> {
  const retentionDays = config.serviceDiscovery?.lifecycleEventRetentionDays ?? 14;

  logger.info(`Initializing lifecycle event cleanup job (retention: ${retentionDays} days)`);

  try {
    // Check if job already exists
    const repeatables = await queueService.listRepeatable('scheduler');
    const exists = repeatables.some((r) => r.name === 'lifecycle:cleanup');

    if (!exists) {
      // Register daily cleanup job at 3:00 AM
      await queueService.addJob(
        'scheduler',
        'lifecycle:cleanup',
        { retentionDays },
        {
          repeat: { pattern: '0 3 * * *' }, // Every day at 3:00 AM
        }
      );
      logger.info('Registered repeatable job: lifecycle:cleanup (daily at 3:00 AM)');
    } else {
      logger.info('Repeatable job already exists: lifecycle:cleanup');
    }
  } catch (error) {
    logger.error('Failed to register lifecycle cleanup job:', error);
  }
}

/**
 * Process lifecycle cleanup job
 * Called by QueueService when the scheduled job runs
 */
export async function processLifecycleCleanupJob(retentionDays: number): Promise<number> {
  try {
    const deletedCount = await ServerLifecycleEvent.deleteOldEvents(retentionDays);
    if (deletedCount > 0) {
      logger.info(`Deleted ${deletedCount} lifecycle events older than ${retentionDays} days`);
    } else {
      logger.debug('No old lifecycle events to delete');
    }
    return deletedCount;
  } catch (error) {
    logger.error('Failed to run lifecycle cleanup:', error);
    throw error;
  }
}
