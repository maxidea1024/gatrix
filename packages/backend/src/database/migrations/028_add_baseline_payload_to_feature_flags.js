/**
 * Add baselinePayload column to g_feature_flags table
 * This column stores the default payload value when flag evaluates to false
 */

exports.up = async function (connection) {
  console.log('Adding baselinePayload column to g_feature_flags table...');

  await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN baselinePayload JSON NULL
    COMMENT 'Default payload value when flag evaluates to false' AFTER variantType
  `);

  console.log('✓ baselinePayload column added to g_feature_flags table');
};

exports.down = async function (connection) {
  console.log('Removing baselinePayload column from g_feature_flags table...');

  await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN baselinePayload
  `);

  console.log('✓ baselinePayload column removed from g_feature_flags table');
};
