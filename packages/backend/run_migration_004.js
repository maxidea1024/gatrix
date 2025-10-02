const migration = require('./src/database/migrations/004_remote_config_final_system.js');

async function runMigration() {
  try {
    console.log('Running migration 004...');
    await migration.up();
    console.log('Migration 004 completed successfully!');
  } catch (error) {
    console.error('Migration 004 failed:', error);
  }
}

runMigration();
