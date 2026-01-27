/**
 * Add variantType column to g_feature_flags table
 * This column determines the type of variant payloads (string, number, json)
 */

exports.up = async function (connection) {
    console.log('Adding variantType column to g_feature_flags table...');

    await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN variantType ENUM('string', 'number', 'json') NOT NULL DEFAULT 'string'
    COMMENT 'Type of variant payload data' AFTER tags
  `);

    console.log('✓ variantType column added to g_feature_flags table');
};

exports.down = async function (connection) {
    console.log('Removing variantType column from g_feature_flags table...');

    await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN variantType
  `);

    console.log('✓ variantType column removed from g_feature_flags table');
};
