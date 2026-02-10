/**
 * Add weightLock column to g_feature_variants table
 * This column stores whether the weight is fixed or auto-distributed
 */

exports.up = async function (connection) {
  console.log('Adding weightLock column to g_feature_variants table...');

  // Check if column exists
  const [cols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_variants' AND COLUMN_NAME = 'weightLock'"
  );

  if (cols.length > 0) {
    console.log('weightLock column already exists (likely from 021_feature_flags_system). Skipping.');
    return;
  }

  await connection.execute(`
    ALTER TABLE g_feature_variants
    ADD COLUMN weightLock BOOLEAN NOT NULL DEFAULT FALSE 
    COMMENT 'Whether weight is fixed (not auto-distributed)' AFTER stickiness
  `);

  console.log('✓ weightLock column added to g_feature_variants');
};

exports.down = async function (connection) {
  console.log('Removing weightLock column from g_feature_variants table...');

  // Check if column exists before dropping
  const [cols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_variants' AND COLUMN_NAME = 'weightLock'"
  );

  if (cols.length === 0) {
    console.log('weightLock column does not exist. Skipping.');
    return;
  }

  await connection.execute(`
    ALTER TABLE g_feature_variants
    DROP COLUMN weightLock
  `);

  console.log('✓ weightLock column removed from g_feature_variants');
};
