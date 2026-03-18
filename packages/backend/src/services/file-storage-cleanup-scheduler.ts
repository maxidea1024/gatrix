/**
 * File Storage Cleanup Scheduler
 *
 * Registers a daily repeatable job to clean up files older than
 * the configured retention period.
 */
import { config } from '../config';
import { createLogger } from '../config/logger';

const logger = createLogger('fileStorageCleanupScheduler');
import { queueService } from './queue-service';

/**
 * Initialize file storage cleanup job
 * Registers a daily repeatable job in BullMQ scheduler queue
 */
export async function initializeFileStorageCleanupJob(): Promise<void> {
  const retentionDays = config.fileStorage?.retentionDays ?? 30;

  logger.info(
    `Initializing file storage cleanup job (retention: ${retentionDays} days)`
  );

  try {
    const repeatables = await queueService.listRepeatable('scheduler');
    const exists = repeatables.some((r) => r.name === 'file-storage:cleanup');

    if (!exists) {
      await queueService.addJob(
        'scheduler',
        'file-storage:cleanup',
        { retentionDays },
        {
          repeat: { pattern: '30 4 * * *' }, // Every day at 4:30 AM
        }
      );
      logger.info(
        'Registered repeatable job: file-storage:cleanup (daily at 4:30 AM)'
      );
    } else {
      logger.info('Repeatable job already exists: file-storage:cleanup');
    }
  } catch (error) {
    logger.error('Failed to register file storage cleanup job:', error);
  }
}

/**
 * Process file storage cleanup job
 * Deletes crash log files older than the retention period
 */
export async function processFileStorageCleanupJob(
  retentionDays: number
): Promise<number> {
  try {
    const { getStorageProvider } = await import('./storage');
    const storage = getStorageProvider();

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // List all crash log files and delete those older than retention period
    const allFiles = await storage.listByPrefix('crashes/logs/');

    let deletedCount = 0;
    for (const file of allFiles) {
      if (file.lastModified < cutoffDate) {
        try {
          await storage.delete(file.key);
          deletedCount++;
        } catch (err) {
          logger.warn('Failed to delete expired file', { key: file.key, error: err });
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(
        `Deleted ${deletedCount} crash log files older than ${retentionDays} days`
      );
    } else {
      logger.debug('No expired crash log files to delete');
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to run file storage cleanup:', error);
    throw error;
  }
}
