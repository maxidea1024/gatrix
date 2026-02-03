/**
 * Outbox Event Scheduler
 *
 * Schedules periodic processing of outbox events.
 * Uses BullMQ to ensure only one instance processes at a time across all backend instances.
 */
import logger from '../config/logger';
import { queueService } from './QueueService';
import { OutboxService } from './OutboxService';
import { LockService } from './LockService';

/**
 * Initialize outbox processing job
 * Registers a repeatable job in BullMQ scheduler queue
 */
export async function initializeOutboxProcessorJob(): Promise<void> {
  const batchSize = 20;
  const cleanupRetentionDays = 7;

  logger.info('Initializing outbox event processor job');

  try {
    // Check if job already exists
    const repeatables = await queueService.listRepeatable('scheduler');
    const processorExists = repeatables.some((r) => r.name === 'outbox:process');
    const cleanupExists = repeatables.some((r) => r.name === 'outbox:cleanup');
    const lockCleanupExists = repeatables.some((r) => r.name === 'lock:cleanup');

    // Register outbox processor job - runs every 30 seconds
    if (!processorExists) {
      await queueService.addJob(
        'scheduler',
        'outbox:process',
        { batchSize },
        {
          repeat: { pattern: '*/30 * * * * *' }, // Every 30 seconds
        }
      );
      logger.info('Registered repeatable job: outbox:process (every 30 seconds)');
    } else {
      logger.info('Repeatable job already exists: outbox:process');
    }

    // Register outbox cleanup job - runs daily at 4:00 AM
    if (!cleanupExists) {
      await queueService.addJob(
        'scheduler',
        'outbox:cleanup',
        { retentionDays: cleanupRetentionDays },
        {
          repeat: { pattern: '0 4 * * *' }, // Every day at 4:00 AM
        }
      );
      logger.info('Registered repeatable job: outbox:cleanup (daily at 4:00 AM)');
    } else {
      logger.info('Repeatable job already exists: outbox:cleanup');
    }

    // Register lock cleanup job - runs every 5 minutes
    if (!lockCleanupExists) {
      await queueService.addJob(
        'scheduler',
        'lock:cleanup',
        {},
        {
          repeat: { pattern: '*/5 * * * *' }, // Every 5 minutes
        }
      );
      logger.info('Registered repeatable job: lock:cleanup (every 5 minutes)');
    } else {
      logger.info('Repeatable job already exists: lock:cleanup');
    }
  } catch (error) {
    logger.error('Failed to register outbox processor jobs:', error);
  }
}

/**
 * Process outbox events job
 * Called by QueueService when the scheduled job runs
 */
export async function processOutboxJob(batchSize: number): Promise<number> {
  try {
    const processed = await OutboxService.processPendingEvents(batchSize);
    if (processed > 0) {
      logger.info(`Processed ${processed} outbox events`);
    }
    return processed;
  } catch (error) {
    logger.error('Failed to process outbox events:', error);
    throw error;
  }
}

/**
 * Cleanup old outbox events
 * Called by QueueService when the scheduled job runs
 */
export async function cleanupOutboxJob(retentionDays: number): Promise<number> {
  try {
    const deleted = await OutboxService.cleanupOldEvents(retentionDays);
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old outbox events`);
    }
    return deleted;
  } catch (error) {
    logger.error('Failed to cleanup outbox events:', error);
    throw error;
  }
}

/**
 * Cleanup expired entity locks
 * Called by QueueService when the scheduled job runs
 */
export async function cleanupLocksJob(): Promise<number> {
  try {
    const deleted = await LockService.cleanupExpiredLocks();
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired entity locks`);
    }
    return deleted;
  } catch (error) {
    logger.error('Failed to cleanup expired locks:', error);
    throw error;
  }
}
