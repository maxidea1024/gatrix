/**
 * 012 - Add totalCount column to g_coupon_settings
 * Required for async coupon generation progress tracking.
 * The code references totalCount when setting generation status to PENDING
 * and when reporting generation progress.
 */

exports.up = async function (connection) {
    console.log('[012] Adding totalCount column to g_coupon_settings...');

    await connection.execute(`
    ALTER TABLE g_coupon_settings
    ADD COLUMN totalCount INT NOT NULL DEFAULT 0 AFTER generatedCount
  `);

    console.log('[012] Done.');
};

exports.down = async function (connection) {
    await connection.execute(`
    ALTER TABLE g_coupon_settings
    DROP COLUMN totalCount
  `);
};
