/**
 * Make coupon startsAt nullable
 * Allow coupons to start immediately if startsAt is null
 */

exports.up = async function (connection) {
  console.log('Making coupon startsAt nullable...');

  try {
    // Check if startsAt column exists and is NOT NULL
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_coupon_settings'
      AND COLUMN_NAME = 'startsAt'
    `);

    if (columns.length > 0) {
      const column = columns[0];
      if (column.IS_NULLABLE === 'NO') {
        // Make startsAt nullable
        await connection.execute(`
          ALTER TABLE g_coupon_settings
          MODIFY COLUMN startsAt DATETIME NULL COMMENT 'Optional: if null, coupon starts immediately'
        `);
        console.log('✅ startsAt column made nullable');
      } else {
        console.log('✅ startsAt column is already nullable');
      }
    } else {
      console.log('⚠️ startsAt column not found');
    }
  } catch (error) {
    console.error('Error making startsAt nullable:', error);
    throw error;
  }
};

exports.down = async function (connection) {
  console.log('Reverting startsAt to NOT NULL...');

  try {
    await connection.execute(`
      ALTER TABLE g_coupon_settings
      MODIFY COLUMN startsAt DATETIME NOT NULL
    `);
    console.log('✅ startsAt column reverted to NOT NULL');
  } catch (error) {
    console.error('Error reverting startsAt:', error);
    throw error;
  }
};
