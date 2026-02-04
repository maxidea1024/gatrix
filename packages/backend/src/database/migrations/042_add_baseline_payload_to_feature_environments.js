exports.up = async function (connection) {
  console.log('Adding baselinePayload to g_feature_flag_environments table...');
  await connection.execute(`
    ALTER TABLE g_feature_flag_environments
    ADD COLUMN baselinePayload JSON NULL COMMENT 'Environment-specific baseline payload';
  `);
  console.log('✓ baselinePayload column added to g_feature_flag_environments');
};

exports.down = async function (connection) {
  console.log('Removing baselinePayload from g_feature_flag_environments table...');
  await connection.execute(`
    ALTER TABLE g_feature_flag_environments
    DROP COLUMN baselinePayload;
  `);
  console.log('✓ baselinePayload column removed from g_feature_flag_environments');
};
