/**
 * Add totalCount column to g_coupon_settings table
 * This column is used for async coupon code generation progress tracking
 */
module.exports = {
  name: 'add_totalcount_to_coupon_settings',
  async up(connection) {
    // Check if column exists
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_coupon_settings' 
      AND COLUMN_NAME = 'totalCount'
    `);

    if (rows[0].count === 0) {
      // Add totalCount column after generatedCount
      await connection.query(`
        ALTER TABLE g_coupon_settings 
        ADD COLUMN totalCount BIGINT NULL AFTER generatedCount
      `);
      console.log('✓ Added totalCount column to g_coupon_settings');
    } else {
      console.log('✓ totalCount column already exists in g_coupon_settings');
    }
  },
  async down(connection) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_coupon_settings' 
      AND COLUMN_NAME = 'totalCount'
    `);

    if (rows[0].count > 0) {
      await connection.query('ALTER TABLE g_coupon_settings DROP COLUMN totalCount');
      console.log('✓ Removed totalCount column from g_coupon_settings');
    }
  },
};
