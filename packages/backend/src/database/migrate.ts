#!/usr/bin/env ts-node

import { config } from '../config';
import logger from '../config/logger';
import migration from './Migration';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    // Get migration status
    const status = await migration.getStatus();
    
    if (status.pending.length === 0) {
      logger.info('No pending migrations found');
      return;
    }
    
    logger.info(`Found ${status.pending.length} pending migrations:`);
    status.pending.forEach(id => logger.info(`  - ${id}`));
    
    // Run migrations
    await migration.runMigrations();
    
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

async function showStatus() {
  try {
    const status = await migration.getStatus();
    
    logger.info('\n=== Migration Status ===');
    logger.info(`Executed migrations: ${status.executed.length}`);
    status.executed.forEach(id => logger.info(`  ✓ ${id}`));

    logger.info(`\nPending migrations: ${status.pending.length}`);
    status.pending.forEach(id => logger.info(`  ○ ${id}`));
    logger.info('');
  } catch (error) {
    logger.error('Failed to get migration status:', error);
    process.exit(1);
  }
}

async function rollback(migrationId?: string) {
  try {
    if (!migrationId) {
      logger.error('Migration ID is required for rollback');
      process.exit(1);
    }
    
    logger.info(`Rolling back migration: ${migrationId}`);
    await migration.rollbackMigration(migrationId);
    logger.info('Migration rollback completed successfully');
  } catch (error) {
    logger.error('Migration rollback failed:', error);
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
      console.log('  npm run migrate up|run     - Run pending migrations');
      console.log('  npm run migrate status     - Show migration status');
      console.log('  npm run migrate rollback <id> - Rollback specific migration');
      process.exit(1);
  }
  
  process.exit(0);
}

// Export functions for use by other modules
export { runMigrations, showStatus, rollback };

if (require.main === module) {
  main().catch(error => {
    logger.error('Migration script failed:', error);
    process.exit(1);
  });
}
