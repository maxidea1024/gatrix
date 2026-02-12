/**
 * Add displayName column to g_feature_context_fields table
 * This column allows users to set a human-readable display name
 * for context fields, separate from the field identifier (fieldName).
 */

exports.up = async function (connection) {
    console.log('Adding displayName column to g_feature_context_fields...');

    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    ADD COLUMN displayName VARCHAR(500) NULL COMMENT 'Human-readable display name'
    AFTER fieldName
  `);

    console.log('✓ displayName column added to g_feature_context_fields');
};

exports.down = async function (connection) {
    console.log('Removing displayName column from g_feature_context_fields...');

    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    DROP COLUMN displayName
  `);

    console.log('✓ displayName column removed from g_feature_context_fields');
};
