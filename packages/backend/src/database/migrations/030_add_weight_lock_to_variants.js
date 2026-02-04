/**
 * Add weightLock column to g_feature_variants table
 * This column stores whether the weight is fixed or auto-distributed
 */

exports.up = async function (connection) {
  console.log('Adding weightLock column to g_feature_variants table...');

  await connection.execute(`
    ALTER TABLE g_feature_variants
    ADD COLUMN weightLock BOOLEAN NOT NULL DEFAULT FALSE 
    COMMENT 'Whether weight is fixed (not auto-distributed)' AFTER stickiness
  `);

  console.log('✓ weightLock column added to g_feature_variants');
};

exports.down = async function (connection) {
  console.log('Removing weightLock column from g_feature_variants table...');

  await connection.execute(`
    ALTER TABLE g_feature_variants
    DROP COLUMN weightLock
  `);

  console.log('✓ weightLock column removed from g_feature_variants');
};
