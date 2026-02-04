/**
 * Migration: Add soft lock and hard lock settings to environments
 */
exports.up = async function (connection) {
  console.log('Adding enableSoftLock and enableHardLock columns to g_environments...');

  // Add columns for soft lock and hard lock enabled settings
  await connection.execute(`
    ALTER TABLE g_environments 
    ADD COLUMN enableSoftLock TINYINT(1) NOT NULL DEFAULT 0 AFTER strictConflictCheck,
    ADD COLUMN enableHardLock TINYINT(1) NOT NULL DEFAULT 0 AFTER enableSoftLock
  `);

  // Enable both for production environment by default
  await connection.execute(`
    UPDATE g_environments 
    SET enableSoftLock = 1, enableHardLock = 1 
    WHERE environment = 'production'
  `);

  console.log('Lock settings columns added successfully');
};

exports.down = async function (connection) {
  console.log('Removing enableSoftLock and enableHardLock columns from g_environments...');

  await connection.execute(`
    ALTER TABLE g_environments 
    DROP COLUMN enableSoftLock,
    DROP COLUMN enableHardLock
  `);

  console.log('Lock settings columns removed successfully');
};
