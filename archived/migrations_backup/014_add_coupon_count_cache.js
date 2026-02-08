/**
 * Migration: Add count cache columns to g_coupon_settings
 *
 * Changes:
 * 1. Add issuedCount column to cache issued coupon count
 * 2. Add usedCount column to cache used coupon count
 * 3. Initialize counts from existing data
 *
 * This eliminates expensive COUNT queries on large datasets
 */

exports.up = async function (connection) {
  console.log('Adding count cache columns to g_coupon_settings...');

  try {
    // 1. Add issuedCount column
    await connection
      .execute(
        `
      ALTER TABLE g_coupon_settings 
      ADD COLUMN issuedCount BIGINT NOT NULL DEFAULT 0 COMMENT 'Cached count of issued coupons'
    `
      )
      .catch((err) => {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('Column issuedCount already exists');
        } else {
          throw err;
        }
      });

    // 2. Add usedCount column
    await connection
      .execute(
        `
      ALTER TABLE g_coupon_settings 
      ADD COLUMN usedCount BIGINT NOT NULL DEFAULT 0 COMMENT 'Cached count of used coupons'
    `
      )
      .catch((err) => {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('Column usedCount already exists');
        } else {
          throw err;
        }
      });

    // 3. Initialize counts from existing data
    console.log('Initializing count cache from existing data...');

    // Update issuedCount from g_coupons
    await connection.execute(`
      UPDATE g_coupon_settings cs
      SET cs.issuedCount = (
        SELECT COUNT(*) FROM g_coupons c WHERE c.settingId = cs.id
      )
    `);

    // Update usedCount from g_coupon_uses
    await connection.execute(`
      UPDATE g_coupon_settings cs
      SET cs.usedCount = (
        SELECT COUNT(*) FROM g_coupon_uses cu WHERE cu.settingId = cs.id
      )
    `);

    console.log('Count cache columns added and initialized successfully');
  } catch (error) {
    console.error('Error adding count cache columns:', error);
    throw error;
  }
};

exports.down = async function (connection) {
  console.log('Rolling back count cache columns...');

  try {
    await connection.execute(`
      ALTER TABLE g_coupon_settings 
      DROP COLUMN IF EXISTS issuedCount
    `);

    await connection.execute(`
      ALTER TABLE g_coupon_settings 
      DROP COLUMN IF EXISTS usedCount
    `);

    console.log('Count cache columns rolled back');
  } catch (error) {
    console.error('Error rolling back count cache columns:', error);
    throw error;
  }
};
