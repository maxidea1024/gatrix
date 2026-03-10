#!/usr/bin/env ts-node

import logger from '../config/logger';
import crashMigration from './crash-migration';

async function runMigrations() {
  try {
    logger.info('Starting crash database migrations...');

    const status = await crashMigration.getStatus();

    if (status.pending.length === 0) {
      logger.info('No pending crash migrations found');
      return;
    }

    logger.info(`Found ${status.pending.length} pending crash migrations:`);
    status.pending.forEach((id) => logger.info(`  - ${id}`));

    await crashMigration.runMigrations();

    logger.info('Crash database migrations completed successfully');
  } catch (error) {
    logger.error('Crash migration failed:', error);
    process.exit(1);
  }
}

async function showStatus() {
  try {
    const status = await crashMigration.getStatus();

    logger.info('\n=== Crash Migration Status ===');
    logger.info(`Executed migrations: ${status.executed.length}`);
    status.executed.forEach((id) => logger.info(`  [done] ${id}`));

    logger.info(`\nPending migrations: ${status.pending.length}`);
    status.pending.forEach((id) => logger.info(`  [pending] ${id}`));
    logger.info('');
  } catch (error) {
    logger.error('Failed to get crash migration status:', error);
    process.exit(1);
  }
}

async function rollback(migrationId?: string) {
  try {
    if (!migrationId) {
      logger.error('Migration ID is required for rollback');
      process.exit(1);
    }

    logger.info(`Rolling back crash migration: ${migrationId}`);
    await crashMigration.rollbackMigration(migrationId);
    logger.info('Crash migration rollback completed successfully');
  } catch (error) {
    logger.error('Crash migration rollback failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];
const migrationId = process.argv[3];

async function main() {
  switch (command) {
    case 'up':
    case 'run':
      await runMigrations();
      break;
    case 'status':
      await showStatus();
      break;
    case 'rollback':
    case 'down':
      await rollback(migrationId);
      break;
    default:
      console.log('Usage:');
      console.log(
        '  yarn migrate:crash up|run     - Run pending crash migrations'
      );
      console.log(
        '  yarn migrate:crash status     - Show crash migration status'
      );
      console.log(
        '  yarn migrate:crash rollback <id> - Rollback specific crash migration'
      );
      process.exit(1);
  }

  process.exit(0);
}

// Export functions for use by other modules
export { runMigrations, showStatus, rollback };

if (require.main === module) {
  main().catch((error) => {
    logger.error('Crash migration script failed:', error);
    process.exit(1);
  });
}
