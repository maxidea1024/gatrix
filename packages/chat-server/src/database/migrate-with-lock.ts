#!/usr/bin/env ts-node

import knex from 'knex';
import path from 'path';
import logger from '../config/logger';

// Load knexfile from the correct location
const knexConfigPath = path.join(__dirname, '../../knexfile');
const knexConfig = require(knexConfigPath);

const LOCK_NAME = 'gatrix_chat_migration_lock';
const LOCK_TIMEOUT = 300; // 5 minutes in seconds

async function acquireLock(db: knex.Knex): Promise<boolean> {
  try {
    const result = await db.raw('SELECT GET_LOCK(?, ?) as lockResult', [LOCK_NAME, LOCK_TIMEOUT]);
    const lockResult = result[0][0]?.lockResult;

    if (lockResult === 1) {
      logger.info('Chat migration lock acquired successfully', {
        lockName: LOCK_NAME,
        timeout: LOCK_TIMEOUT,
      });
      return true;
    } else if (lockResult === 0) {
      logger.warn('Failed to acquire chat migration lock - another process is running migrations', {
        lockName: LOCK_NAME,
        timeout: LOCK_TIMEOUT,
      });
      return false;
    } else {
      logger.error('Error acquiring chat migration lock - NULL returned', {
        lockName: LOCK_NAME,
      });
      return false;
    }
  } catch (error) {
    logger.error('Exception while acquiring chat migration lock:', error);
    return false;
  }
}

async function releaseLock(db: knex.Knex): Promise<void> {
  try {
    const result = await db.raw('SELECT RELEASE_LOCK(?) as releaseResult', [LOCK_NAME]);
    const releaseResult = result[0][0]?.releaseResult;

    if (releaseResult === 1) {
      logger.info('Chat migration lock released successfully', {
        lockName: LOCK_NAME,
      });
    } else if (releaseResult === 0) {
      logger.warn('Lock was not established by this thread', {
        lockName: LOCK_NAME,
      });
    } else {
      logger.warn('Lock does not exist', {
        lockName: LOCK_NAME,
      });
    }
  } catch (error) {
    logger.error('Exception while releasing chat migration lock:', error);
  }
}

async function runMigrations() {
  const env = process.env.NODE_ENV || 'development';
  const config = knexConfig[env];

  if (!config) {
    logger.error(`No knex configuration found for environment: ${env}`);
    process.exit(1);
  }

  const db = knex(config);

  try {
    // Acquire distributed lock
    const lockAcquired = await acquireLock(db);

    if (!lockAcquired) {
      logger.info('Skipping chat migrations - another process is already running them');
      process.exit(0);
    }

    try {
      logger.info('Starting chat server database migrations...');

      // Run Knex migrations (Knex has its own lock mechanism too)
      const [batchNo, migrations] = await db.migrate.latest();

      if (migrations.length === 0) {
        logger.info('No pending chat migrations');
      } else {
        logger.info(`Batch ${batchNo} run: ${migrations.length} migrations`, {
          migrations: migrations,
        });
        migrations.forEach((migration: string) => {
          logger.info(`  - ${migration}`);
        });
      }

      logger.info('Chat server migrations completed successfully');
    } finally {
      // Always release the lock
      await releaseLock(db);
    }
  } catch (error) {
    logger.error('Chat migration failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// Run migrations
runMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
