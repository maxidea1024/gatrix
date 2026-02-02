#!/usr/bin/env ts-node

import database from "../config/database";

/**
 * Database Reset Script
 * Drops all tables and recreates them using migrations
 */

async function dropAllTables() {
  try {
    console.log("Starting database reset...");

    // Disable foreign key checks to allow dropping tables with dependencies
    await database.query("SET FOREIGN_KEY_CHECKS = 0");

    // Get all tables using SHOW TABLES
    const tables = (await database.query("SHOW TABLES")) as any;

    if (Array.isArray(tables) && tables.length > 0) {
      console.log(`Found ${tables.length} tables to drop`);

      // Drop each table
      for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0] as string;
        await database.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
    } else {
      console.log("No tables found to drop");
    }

    // Also drop migrations table to force re-run
    await database.query("DROP TABLE IF EXISTS `g_migrations`");

    // Re-enable foreign key checks
    await database.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("✓ All tables dropped successfully");
  } catch (error) {
    console.error("Error dropping tables:", error);
    throw error;
  }
}

async function runMigrations() {
  try {
    console.log("Running migrations...");

    // Import and run migrations
    const { runMigrations: runMigrationsFunc } = await import("./migrate");
    await runMigrationsFunc();

    console.log("✓ Migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    throw error;
  }
}

async function resetDatabase() {
  try {
    await dropAllTables();
    await runMigrations();

    console.log("🎉 Database reset completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Database reset failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetDatabase();
}

export { resetDatabase, dropAllTables, runMigrations };
