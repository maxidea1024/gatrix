/**
 * Migration: Add coupon generation status tracking
 * 
 * Adds columns to track async coupon code generation for NORMAL type coupons
 * - generationStatus: PENDING, IN_PROGRESS, COMPLETED, FAILED
 * - generatedCount: Number of codes generated so far
 * - totalCount: Total number of codes to generate
 * - generationJobId: BullMQ job ID for tracking
 */

exports.up = async function(connection) {
  console.log('Adding coupon generation status columns...');

  // Add columns to g_coupon_settings table
  await connection.execute(`
    ALTER TABLE g_coupon_settings
    ADD COLUMN generationStatus ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED') DEFAULT 'COMPLETED' COMMENT 'Status of async coupon code generation',
    ADD COLUMN generatedCount BIGINT DEFAULT 0 COMMENT 'Number of codes generated so far',
    ADD COLUMN totalCount BIGINT DEFAULT 0 COMMENT 'Total number of codes to generate',
    ADD COLUMN generationJobId VARCHAR(64) NULL COMMENT 'BullMQ job ID for tracking',
    ADD INDEX idx_coupon_settings_generation_status (generationStatus)
  `);

  console.log('✅ Coupon generation status columns added successfully');
};

exports.down = async function(connection) {
  console.log('Removing coupon generation status columns...');

  await connection.execute(`
    ALTER TABLE g_coupon_settings
    DROP COLUMN IF EXISTS generationStatus,
    DROP COLUMN IF EXISTS generatedCount,
    DROP COLUMN IF EXISTS totalCount,
    DROP COLUMN IF EXISTS generationJobId,
    DROP INDEX IF EXISTS idx_coupon_settings_generation_status
  `);

  console.log('✅ Coupon generation status columns removed successfully');
};

