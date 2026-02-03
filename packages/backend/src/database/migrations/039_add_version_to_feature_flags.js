/**
 * Migration: Add version column to feature flags
 * This version increments each time the flag is modified
 */

exports.up = async function (connection) {
  // Check if version column exists in g_feature_flags
  const [flagCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flags' AND COLUMN_NAME = 'version'
    `);

  if (flagCols.length === 0) {
    // Add version column to g_feature_flags table
    await connection.query(`
          ALTER TABLE g_feature_flags
          ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER stale;
        `);
  }

  // Check if version column exists in g_feature_flag_environments
  const [envCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flag_environments' AND COLUMN_NAME = 'version'
    `);

  if (envCols.length === 0) {
    // Add version column to g_feature_flag_environments table (for environment-specific version tracking)
    await connection.query(`
          ALTER TABLE g_feature_flag_environments
          ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER lastSeenAt;
        `);
  }
};

exports.down = async function (connection) {
  await connection.query(`
    ALTER TABLE g_feature_flags
    DROP COLUMN version;
  `);

  await connection.query(`
    ALTER TABLE g_feature_flag_environments
    DROP COLUMN version;
  `);
};
