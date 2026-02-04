/**
 * Add isEnabled column to g_feature_context_fields table
 * This allows hiding context fields from selection lists without deleting them
 */

exports.up = async function (connection) {
  console.log('Adding isEnabled column to g_feature_context_fields...');

  await connection.execute(`
    ALTER TABLE g_feature_context_fields
    ADD COLUMN isEnabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether field is enabled for use' AFTER legalValues,
    ADD INDEX idx_is_enabled (isEnabled)
  `);

  console.log('✓ isEnabled column added to g_feature_context_fields');
};

exports.down = async function (connection) {
  console.log('Removing isEnabled column from g_feature_context_fields...');

  await connection.execute(`
    ALTER TABLE g_feature_context_fields
    DROP INDEX idx_is_enabled,
    DROP COLUMN isEnabled
  `);

  console.log('✓ isEnabled column removed from g_feature_context_fields');
};
