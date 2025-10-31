module.exports = {
  async up(connection) {
    console.log('Adding channel column to g_coupon_target_subchannels table...');

    // Check if channel column already exists
    const [result] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_coupon_target_subchannels' 
      AND COLUMN_NAME = 'channel'
    `);

    if (result[0].count === 0) {
      // Add channel column
      await connection.execute(`
        ALTER TABLE g_coupon_target_subchannels
        ADD COLUMN channel VARCHAR(255) NULL 
          COMMENT 'Channel name for subchannel targeting'
          AFTER subchannel
      `);

      console.log('✅ Added channel column to g_coupon_target_subchannels');
    } else {
      console.log('⚠️  Channel column already exists, skipping...');
    }
  },

  async down(connection) {
    console.log('Removing channel column from g_coupon_target_subchannels table...');

    // Check if channel column exists
    const [result] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_coupon_target_subchannels' 
      AND COLUMN_NAME = 'channel'
    `);

    if (result[0].count > 0) {
      await connection.execute(`
        ALTER TABLE g_coupon_target_subchannels
        DROP COLUMN channel
      `);

      console.log('✅ Removed channel column from g_coupon_target_subchannels');
    } else {
      console.log('⚠️  Channel column does not exist, skipping...');
    }
  }
};

