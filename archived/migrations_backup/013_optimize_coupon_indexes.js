/**
 * Migration: Optimize coupon system indexes for performance
 *
 * Changes:
 * 1. Add createdAt index to g_coupon_settings for sorting optimization
 * 2. Add settingId index to g_coupon_uses for faster aggregation
 * 3. Add composite index (settingId, status) to g_coupons for better query performance
 */

exports.up = async function(connection) {
  console.log('Optimizing coupon system indexes...');

  try {
    // 1. Add createdAt index to g_coupon_settings for sorting
    await connection.execute(`
      ALTER TABLE g_coupon_settings 
      ADD INDEX idx_coupon_settings_createdAt (createdAt DESC)
    `).catch(err => {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('Index idx_coupon_settings_createdAt already exists');
      } else {
        throw err;
      }
    });

    // 2. Add settingId index to g_coupon_uses for faster aggregation
    await connection.execute(`
      ALTER TABLE g_coupon_uses 
      ADD INDEX idx_coupon_uses_settingId (settingId)
    `).catch(err => {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('Index idx_coupon_uses_settingId already exists');
      } else {
        throw err;
      }
    });

    // 3. Ensure composite index on g_coupons (settingId, status) exists
    // This index should already exist from migration 012, but we verify it
    const [indexes] = await connection.execute(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_NAME = 'g_coupons' AND COLUMN_NAME = 'settingId'
    `);
    
    if (indexes.length === 0) {
      await connection.execute(`
        ALTER TABLE g_coupons 
        ADD INDEX idx_setting_status (settingId, status)
      `);
    }

    console.log('Coupon system indexes optimized successfully');
  } catch (error) {
    console.error('Error optimizing coupon indexes:', error);
    throw error;
  }
};

exports.down = async function(connection) {
  console.log('Rolling back coupon system index optimizations...');

  try {
    await connection.execute(`
      ALTER TABLE g_coupon_settings 
      DROP INDEX IF EXISTS idx_coupon_settings_createdAt
    `);

    await connection.execute(`
      ALTER TABLE g_coupon_uses 
      DROP INDEX IF EXISTS idx_coupon_uses_settingId
    `);

    console.log('Coupon system index optimizations rolled back');
  } catch (error) {
    console.error('Error rolling back coupon indexes:', error);
    throw error;
  }
};

