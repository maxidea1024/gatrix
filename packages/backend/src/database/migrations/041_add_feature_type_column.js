/**
 * Add flagUsage column to g_feature_flags table
 * flagUsage: 'flag' or 'remoteConfig' (classification: Feature Flag vs Remote Config)
 * flagType remains unchanged: 'release', 'experiment', 'operational', 'killswitch', 'permission'
 */

exports.up = async function (connection) {
  console.log('Adding flagUsage column to g_feature_flags table...');

  // Add flagUsage column for classification (flag vs remoteConfig)
  await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN flagUsage ENUM('flag', 'remoteConfig') NOT NULL DEFAULT 'flag'
    COMMENT 'Usage classification: flag = Feature Flag, remoteConfig = Remote Config'
    AFTER flagType
  `);

  console.log('Adding index for flagUsage...');

  // Add index for flagUsage filtering
  await connection.execute(`
    CREATE INDEX idx_feature_flags_flag_usage ON g_feature_flags (flagUsage)
  `);

  console.log('✓ flagUsage column added successfully');
  console.log('  - flagType: Purpose (release, experiment, operational, killSwitch, permission)');
  console.log('  - flagUsage: Classification (flag = Feature Flag, remoteConfig = Remote Config)');
};

exports.down = async function (connection) {
  console.log('Removing flagUsage column from g_feature_flags table...');

  // Remove index
  await connection.execute(`
    DROP INDEX idx_feature_flags_flag_usage ON g_feature_flags
  `);

  // Remove column
  await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN flagUsage
  `);

  console.log('✓ flagUsage column removed successfully');
};
