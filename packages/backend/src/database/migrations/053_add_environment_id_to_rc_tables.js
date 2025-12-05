/**
 * Migration: Add environmentId to Remote Config tables
 *
 * This migration adds environmentId column (CHAR(26) ULID) to:
 * - g_remote_config_segments
 * - g_remote_config_context_fields
 * - g_remote_config_campaigns
 *
 * Existing data will be assigned to the default environment (development).
 */

const TABLES_REQUIRING_ENVIRONMENT = [
  'g_remote_config_segments',
  'g_remote_config_context_fields',
  'g_remote_config_campaigns'
];

module.exports = {
  id: '053_add_environment_id_to_rc_tables',

  async up(db) {
    // Get the default environment ID (development) - now a CHAR(26) ULID
    const [envRows] = await db.query(
      `SELECT id FROM g_remote_config_environments WHERE environmentName = 'development' LIMIT 1`
    );

    if (envRows.length === 0) {
      throw new Error('Development environment not found. Please run migration 048 first.');
    }

    const defaultEnvId = envRows[0].id;
    console.log(`Default environment ID: ${defaultEnvId}`);

    for (const tableName of TABLES_REQUIRING_ENVIRONMENT) {
      // Check if table exists
      const [tableExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );

      if (tableExists[0].cnt === 0) {
        console.log(`Table ${tableName} does not exist, skipping...`);
        continue;
      }

      // Check if environmentId column already exists
      const [colExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'`,
        [tableName]
      );

      if (colExists[0].cnt > 0) {
        console.log(`Column environmentId already exists in ${tableName}, skipping...`);
        continue;
      }

      // Get the first column (primary key) of the table
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION LIMIT 1`,
        [tableName]
      );
      const firstColumn = columns[0].COLUMN_NAME;

      console.log(`Adding environmentId (CHAR(26)) to ${tableName} after ${firstColumn}...`);

      // Add environmentId column with default value after the first column - using CHAR(26) for ULID
      await db.query(`
        ALTER TABLE ${tableName}
        ADD COLUMN environmentId CHAR(26) NOT NULL DEFAULT '${defaultEnvId}'
        AFTER ${firstColumn}
      `);

      // Remove the default after adding the column (default was only for existing rows)
      await db.query(`
        ALTER TABLE ${tableName}
        ALTER COLUMN environmentId DROP DEFAULT
      `);

      // Add foreign key constraint
      await db.query(`
        ALTER TABLE ${tableName}
        ADD CONSTRAINT fk_${tableName}_environment
        FOREIGN KEY (environmentId) REFERENCES g_remote_config_environments(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
      `);

      // Add index for better query performance
      await db.query(`
        CREATE INDEX idx_${tableName}_environmentId ON ${tableName}(environmentId)
      `);

      console.log(`Successfully added environmentId to ${tableName}`);
    }

    console.log('Migration 053 completed successfully');
  },

  async down(db) {
    for (const tableName of TABLES_REQUIRING_ENVIRONMENT.reverse()) {
      // Check if table exists
      const [tableExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );

      if (tableExists[0].cnt === 0) {
        continue;
      }

      // Check if environmentId column exists
      const [colExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'`,
        [tableName]
      );

      if (colExists[0].cnt === 0) {
        continue;
      }

      console.log(`Removing environmentId from ${tableName}...`);

      // Drop foreign key constraint
      try {
        await db.query(`
          ALTER TABLE ${tableName}
          DROP FOREIGN KEY fk_${tableName}_environment
        `);
      } catch (e) {
        console.log(`FK fk_${tableName}_environment may not exist, continuing...`);
      }

      // Drop index
      try {
        await db.query(`
          DROP INDEX idx_${tableName}_environmentId ON ${tableName}
        `);
      } catch (e) {
        console.log(`Index idx_${tableName}_environmentId may not exist, continuing...`);
      }

      // Drop column
      await db.query(`
        ALTER TABLE ${tableName}
        DROP COLUMN environmentId
      `);
    }
  }
};

