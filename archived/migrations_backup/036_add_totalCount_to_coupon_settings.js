/**
 * Migration: Add totalCount column to g_coupon_settings
 *
 * Changes:
 * 1. Add totalCount column to track total number of codes to generate
 *
 * This is needed for async coupon generation progress tracking
 */

exports.up = async function(connection) {
  console.log('Adding totalCount column to g_coupon_settings...');

  try {
    // Check if totalCount column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_coupon_settings'
      AND COLUMN_NAME = 'totalCount'
    `);

    if (columns.length > 0) {
      console.log('✅ totalCount column already exists');
      return;
    }

    // Add totalCount column after generatedCount
    await connection.execute(`
      ALTER TABLE g_coupon_settings 
      ADD COLUMN totalCount INT NOT NULL DEFAULT 0 COMMENT 'NORMAL only: total number of codes to generate'
      AFTER generatedCount
    `);

    console.log('✅ totalCount column added successfully');
  } catch (error) {
    console.error('❌ Error adding totalCount column:', error);
    throw error;
  }
};

exports.down = async function(connection) {
  console.log('Rolling back totalCount column...');

  try {
    await connection.execute(`
      ALTER TABLE g_coupon_settings 
      DROP COLUMN IF EXISTS totalCount
    `);

    console.log('✅ totalCount column rolled back');
  } catch (error) {
    console.error('❌ Error rolling back totalCount column:', error);
    throw error;
  }
};

