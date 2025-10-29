/**
 * Migration: Add reward email fields to g_coupon_settings
 * - rewardEmailTitle: Email title/subject for reward notification
 * - rewardEmailBody: Email body/content for reward notification
 */

exports.up = async function(connection) {
  console.log('Adding reward email fields to g_coupon_settings...');

  await connection.execute(`
    ALTER TABLE g_coupon_settings
    ADD COLUMN rewardEmailTitle VARCHAR(255) NULL COMMENT 'Email title/subject for reward notification',
    ADD COLUMN rewardEmailBody TEXT NULL COMMENT 'Email body/content for reward notification'
  `);

  console.log('✅ Reward email fields added successfully');
};

exports.down = async function(connection) {
  console.log('Removing reward email fields from g_coupon_settings...');

  await connection.execute(`
    ALTER TABLE g_coupon_settings
    DROP COLUMN IF EXISTS rewardEmailTitle,
    DROP COLUMN IF EXISTS rewardEmailBody
  `);

  console.log('✅ Reward email fields removed successfully');
};

