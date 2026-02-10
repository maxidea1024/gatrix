/**
 * Add enabledValue and disabledValue columns to g_feature_flags table
 * These columns store the default values when flag evaluates to true or false
 */

exports.up = async function (connection) {
  console.log('Adding enabledValue and disabledValue columns to g_feature_flags table...');

  await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN enabledValue JSON NULL COMMENT 'Value when flag evaluates to true',
    ADD COLUMN disabledValue JSON NULL COMMENT 'Value when flag evaluates to false'
  `);

  console.log('✓ enabledValue and disabledValue columns added to g_feature_flags table');
};

exports.down = async function (connection) {
  console.log('Removing enabledValue and disabledValue columns from g_feature_flags table...');

  await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN enabledValue,
    DROP COLUMN disabledValue
  `);

  console.log('✓ enabledValue and disabledValue columns removed from g_feature_flags table');
};
