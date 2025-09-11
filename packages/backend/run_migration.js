require('dotenv').config();
const migration = require('./src/database/migrations/003_campaign_enhancements.js');

async function runMigration() {
  try {
    console.log('Running campaign enhancements migration...');
    await migration.up();
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
