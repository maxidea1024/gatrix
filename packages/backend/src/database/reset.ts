#!/usr/bin/env ts-node

import database from '../config/database';

/**
 * Database Reset Script
 * Drops all tables and recreates them using migrations
 */

async function dropAllTables() {
  try {
    console.log('Starting database reset...');

    // Disable foreign key checks
    await database.query('SET FOREIGN_KEY_CHECKS = 0');

    // Get all tables in the current database
    const [tables] = await database.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
    `);

    if (Array.isArray(tables) && tables.length > 0) {
      console.log(`Found ${tables.length} tables to drop`);

      // Drop each table
      for (const table of tables) {
        const tableName = table.TABLE_NAME;
        console.log(`Dropping table: ${tableName}`);
        await database.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
    } else {
      console.log('No tables found to drop');
    }

    // Re-enable foreign key checks
    await database.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✓ All tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  }
}

async function runMigrations() {
  try {
    console.log('Running migrations...');

    // Import and run migrations
    const { runMigrations: runMigrationsFunc } = await import('./migrate');
    await runMigrationsFunc();

    console.log('✓ Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

async function resetDatabase() {
  try {
    await dropAllTables();
    await runMigrations();

    console.log('🎉 Database reset completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database reset failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetDatabase();
}

export { resetDatabase, dropAllTables, runMigrations };
