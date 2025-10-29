/**
 * Migration: Add coupon code pattern support
 * 
 * Adds codePattern column to g_coupon_settings table to support different code generation patterns:
 * - ALPHANUMERIC_8: 8-character alphanumeric code (default)
 * - ALPHANUMERIC_16: 16-character alphanumeric code
 * - ALPHANUMERIC_16_HYPHEN: 16-character alphanumeric code with hyphens every 4 characters
 */

exports.up = async function(connection) {
  console.log('Adding coupon code pattern column...');

  // Add codePattern column to g_coupon_settings table
  await connection.execute(`
    ALTER TABLE g_coupon_settings
    ADD COLUMN codePattern ENUM('ALPHANUMERIC_8', 'ALPHANUMERIC_16', 'ALPHANUMERIC_16_HYPHEN') 
      NOT NULL DEFAULT 'ALPHANUMERIC_8' 
      COMMENT 'Coupon code generation pattern'
  `);

  console.log('✅ Coupon code pattern column added successfully');
};

exports.down = async function(connection) {
  console.log('Removing coupon code pattern column...');

  await connection.execute(`
    ALTER TABLE g_coupon_settings
    DROP COLUMN codePattern
  `);

  console.log('✅ Coupon code pattern column removed successfully');
};

