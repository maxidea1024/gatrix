/**
 * Add valueType column to g_feature_flags table
 * This column determines the type of variant values (string, number, json)
 */

exports.up = async function (connection) {
  console.log('Adding valueType column to g_feature_flags table...');

  await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN valueType ENUM('boolean', 'string', 'number', 'json') NOT NULL DEFAULT 'boolean'
    COMMENT 'Type of variant value data' AFTER tags
  `);

  console.log('✓ valueType column added to g_feature_flags table');
};

exports.down = async function (connection) {
  console.log('Removing valueType column from g_feature_flags table...');

  await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN valueType
  `);

  console.log('✓ valueType column removed from g_feature_flags table');
};
