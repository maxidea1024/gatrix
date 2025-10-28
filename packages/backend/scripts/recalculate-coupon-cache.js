/**
 * Script to recalculate coupon cache counts
 * Usage: node scripts/recalculate-coupon-cache.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function recalculateCouponCache() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    console.log('Starting coupon cache recalculation...');

    // Get all coupon settings
    const [settings] = await connection.execute(
      'SELECT id, code, issuedCount, usedCount FROM g_coupon_settings WHERE status != ?',
      ['DELETED']
    );

    console.log(`Found ${settings.length} coupon settings to process`);

    let updated = 0;
    let errors = 0;

    for (const setting of settings) {
      try {
        // Get actual issued count
        const [issuedRows] = await connection.execute(
          'SELECT COUNT(*) as count FROM g_coupons WHERE settingId = ?',
          [setting.id]
        );
        const actualIssued = issuedRows[0].count;

        // Get actual used count
        const [usedRows] = await connection.execute(
          'SELECT COUNT(*) as count FROM g_coupon_uses WHERE settingId = ?',
          [setting.id]
        );
        const actualUsed = usedRows[0].count;

        // Check if cache is different
        if (setting.issuedCount !== actualIssued || setting.usedCount !== actualUsed) {
          console.log(
            `[${setting.code || 'N/A'}] Updating cache: issued ${setting.issuedCount} -> ${actualIssued}, used ${setting.usedCount} -> ${actualUsed}`
          );

          // Update cache
          await connection.execute(
            'UPDATE g_coupon_settings SET issuedCount = ?, usedCount = ? WHERE id = ?',
            [actualIssued, actualUsed, setting.id]
          );

          updated++;
        } else {
          console.log(
            `[${setting.code || 'N/A'}] Cache is correct: issued=${actualIssued}, used=${actualUsed}`
          );
        }
      } catch (error) {
        console.error(`Error processing setting ${setting.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\nRecalculation complete:`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Errors: ${errors}`);
    console.log(`- Total: ${settings.length}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

recalculateCouponCache();

