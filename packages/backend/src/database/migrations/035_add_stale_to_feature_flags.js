/**
 * Migration: Add stale column to feature flags
 * Allows manually marking flags as stale
 */

exports.up = async function (connection) {
  console.log('Adding stale column to g_feature_flags table...');

  // Check if stale column already exists
  const [columns] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_feature_flags' 
        AND COLUMN_NAME = 'stale'
    `);

  if (columns.length === 0) {
    // Add stale column to g_feature_flags table
    await connection.execute(`
            ALTER TABLE g_feature_flags 
            ADD COLUMN stale TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether the flag is manually marked as stale' AFTER staleAfterDays
        `);
    console.log('✓ stale column added to g_feature_flags');

    // Add index
    await connection.execute(`
            ALTER TABLE g_feature_flags ADD INDEX idx_stale (stale)
        `);
    console.log('✓ stale index added to g_feature_flags');
  } else {
    console.log('✓ stale column already exists in g_feature_flags');
  }

  console.log('🎉 Migration completed: stale support added to feature flags');
};

exports.down = async function (connection) {
  console.log('Removing stale column from g_feature_flags table...');

  // Drop index first
  try {
    await connection.execute(`
            ALTER TABLE g_feature_flags DROP INDEX idx_stale
        `);
  } catch (e) {
    console.log('Note: idx_stale index may not exist, continuing...');
  }

  // Drop column
  await connection.execute(`
        ALTER TABLE g_feature_flags DROP COLUMN stale
    `);
  console.log('✓ stale column removed from g_feature_flags');

  console.log('✓ Rollback completed');
};
