/**
 * Add tags column to g_feature_context_fields table
 * Allows categorizing context fields with tags for easier management
 */

exports.name = 'add_tags_to_context_fields';

exports.up = async function (connection) {
    console.log('Adding tags column to g_feature_context_fields...');

    await connection.execute(`
    ALTER TABLE g_feature_context_fields 
    ADD COLUMN tags JSON NULL COMMENT 'Tags array for categorization'
    AFTER legalValues
  `);

    console.log('✓ tags column added to g_feature_context_fields');
};

exports.down = async function (connection) {
    console.log('Removing tags column from g_feature_context_fields...');

    await connection.execute(`
    ALTER TABLE g_feature_context_fields 
    DROP COLUMN tags
  `);

    console.log('✓ tags column removed from g_feature_context_fields');
};
