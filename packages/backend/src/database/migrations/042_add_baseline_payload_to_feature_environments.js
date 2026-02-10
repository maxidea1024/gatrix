/**
 * Add enabledValue and disabledValue to g_feature_flag_environments table
 */

exports.up = async function (connection) {
  console.log('Adding enabledValue and disabledValue to g_feature_flag_environments table...');
  await connection.execute(`
    ALTER TABLE g_feature_flag_environments
    ADD COLUMN enabledValue JSON NULL COMMENT 'Environment override for enabled value',
    ADD COLUMN disabledValue JSON NULL COMMENT 'Environment override for disabled value'
  `);
  console.log('✓ enabledValue and disabledValue columns added to g_feature_flag_environments');
};

exports.down = async function (connection) {
  console.log('Removing enabledValue and disabledValue from g_feature_flag_environments table...');
  await connection.execute(`
    ALTER TABLE g_feature_flag_environments
    DROP COLUMN enabledValue,
    DROP COLUMN disabledValue
  `);
  console.log('✓ enabledValue and disabledValue columns removed from g_feature_flag_environments');
};
