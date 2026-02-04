/**
 * Migration 029: Add createdBy/updatedBy to feature flag sub-tables
 *
 * Adds missing audit columns to:
 * - g_feature_flag_environments
 * - g_feature_variants
 */

exports.up = async function (connection) {
  console.log('Adding createdBy/updatedBy columns to feature flag sub-tables...');

  // g_feature_flag_environments
  const [envCols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flag_environments' AND COLUMN_NAME = 'createdBy'"
  );

  if (envCols.length === 0) {
    await connection.execute(`
            ALTER TABLE g_feature_flag_environments
            ADD COLUMN createdBy INT NULL AFTER lastSeenAt,
            ADD COLUMN updatedBy INT NULL AFTER createdBy
        `);
    console.log('✓ Added createdBy/updatedBy to g_feature_flag_environments');
  } else {
    console.log('  g_feature_flag_environments already has createdBy column');
  }

  // g_feature_variants
  const [varCols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_variants' AND COLUMN_NAME = 'createdBy'"
  );

  if (varCols.length === 0) {
    await connection.execute(`
            ALTER TABLE g_feature_variants
            ADD COLUMN createdBy INT NULL AFTER payloadType,
            ADD COLUMN updatedBy INT NULL AFTER createdBy
        `);
    console.log('✓ Added createdBy/updatedBy to g_feature_variants');
  } else {
    console.log('  g_feature_variants already has createdBy column');
  }

  console.log('Done!');
};

exports.down = async function (connection) {
  console.log('Removing createdBy/updatedBy from feature flag sub-tables...');

  // g_feature_flag_environments
  const [envCols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flag_environments' AND COLUMN_NAME = 'createdBy'"
  );

  if (envCols.length > 0) {
    await connection.execute(`
            ALTER TABLE g_feature_flag_environments
            DROP COLUMN createdBy,
            DROP COLUMN updatedBy
        `);
    console.log('✓ Removed createdBy/updatedBy from g_feature_flag_environments');
  }

  // g_feature_variants
  const [varCols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_variants' AND COLUMN_NAME = 'createdBy'"
  );

  if (varCols.length > 0) {
    await connection.execute(`
            ALTER TABLE g_feature_variants
            DROP COLUMN createdBy,
            DROP COLUMN updatedBy
        `);
    console.log('✓ Removed createdBy/updatedBy from g_feature_variants');
  }

  console.log('Rollback complete.');
};
