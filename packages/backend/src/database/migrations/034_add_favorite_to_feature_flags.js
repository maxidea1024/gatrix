/**
 * Migration: Add isFavorite column to feature flags
 * Allows users to mark feature flags as favorites for quick access
 */

exports.up = async function (connection) {
  console.log('Adding isFavorite column to g_feature_flags table...');

  // Check if isFavorite column already exists
  const [columns] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_feature_flags' 
        AND COLUMN_NAME = 'isFavorite'
    `);

  if (columns.length === 0) {
    // Add isFavorite column to g_feature_flags table
    await connection.execute(`
            ALTER TABLE g_feature_flags 
            ADD COLUMN isFavorite TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether the flag is marked as favorite' AFTER isArchived
        `);
    console.log('✓ isFavorite column added to g_feature_flags');

    // Add index for faster sorting by favorite
    await connection.execute(`
            ALTER TABLE g_feature_flags ADD INDEX idx_is_favorite (isFavorite)
        `);
    console.log('✓ isFavorite index added to g_feature_flags');
  } else {
    console.log('✓ isFavorite column already exists in g_feature_flags');
  }

  console.log('🎉 Migration completed: isFavorite support added to feature flags');
};

exports.down = async function (connection) {
  console.log('Removing isFavorite column from g_feature_flags table...');

  // Drop index first
  try {
    await connection.execute(`
            ALTER TABLE g_feature_flags DROP INDEX idx_is_favorite
        `);
  } catch (e) {
    console.log('Note: idx_is_favorite index may not exist, continuing...');
  }

  // Drop column
  await connection.execute(`
        ALTER TABLE g_feature_flags DROP COLUMN isFavorite
    `);
  console.log('✓ isFavorite column removed from g_feature_flags');

  console.log('✓ Rollback completed');
};
