/**
 * Migration: Add sdkVersion column to unknown_flags table
 */

exports.up = async function (connection) {
  // Check if column already exists (for cases where ALTER was done manually)
  const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'unknown_flags' 
        AND COLUMN_NAME = 'sdkVersion'
    `);

  if (columns.length === 0) {
    await connection.query(`
            ALTER TABLE unknown_flags 
            ADD COLUMN sdkVersion VARCHAR(50) NULL AFTER appName,
            ADD INDEX idx_app_sdk (appName, sdkVersion)
        `);
  }
};

exports.down = async function (connection) {
  await connection.query(`
        ALTER TABLE unknown_flags 
        DROP INDEX idx_app_sdk,
        DROP COLUMN sdkVersion
    `);
};
