/**
 * Media Asset GC Scheduler
 *
 * Registers a daily repeatable job to garbage-collect unreferenced
 * media assets whose grace period has expired.
 */
import { createLogger } from '../config/logger';

const logger = createLogger('mediaAssetGcScheduler');
import { queueService } from './queue-service';

/**
 * Initialize media asset GC job
 * Registers a daily repeatable job in BullMQ scheduler queue
 */
export async function initializeMediaAssetGcJob(): Promise<void> {
  logger.info('Initializing media asset GC job');

  try {
    const repeatables = await queueService.listRepeatable('scheduler');
    const exists = repeatables.some((r) => r.name === 'media-assets:gc');

    if (!exists) {
      await queueService.addJob(
        'scheduler',
        'media-assets:gc',
        {},
        {
          repeat: { pattern: '0 5 * * *' }, // Every day at 5:00 AM
        }
      );
      logger.info(
        'Registered repeatable job: media-assets:gc (daily at 5:00 AM)'
      );
    } else {
      logger.info('Repeatable job already exists: media-assets:gc');
    }
  } catch (error) {
    logger.error('Failed to register media asset GC job:', error);
  }
}

/**
 * Process the media asset GC job
 */
export async function processMediaAssetGcJob(): Promise<number> {
  const { MediaAssetService } = await import('./media-asset-service');
  return MediaAssetService.runGarbageCollection();
}
