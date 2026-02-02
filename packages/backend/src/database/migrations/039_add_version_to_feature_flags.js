/**
 * Migration: Add version column to feature flags
 * This version increments each time the flag is modified
 */

exports.up = async function (connection) {
    // Add version column to g_feature_flags table
    await connection.query(`
    ALTER TABLE g_feature_flags
    ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER stale;
  `);

    // Add version column to g_feature_flag_environments table (for environment-specific version tracking)
    await connection.query(`
    ALTER TABLE g_feature_flag_environments
    ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER lastSeenAt;
  `);
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
