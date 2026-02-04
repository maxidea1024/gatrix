/**
 * Migration to add 'conflict' status to change_requests
 */

exports.up = async function (connection) {
  console.log('Adding conflict status to change_requests...');

  // Alter the status ENUM to include 'conflict'
  await connection.execute(`
    ALTER TABLE g_change_requests 
    MODIFY COLUMN status ENUM('draft', 'open', 'approved', 'applied', 'rejected', 'conflict') NOT NULL DEFAULT 'draft'
  `);

  console.log('conflict status added successfully');
};

exports.down = async function (connection) {
  console.log('Removing conflict status from change_requests...');

  // First, update any 'conflict' status to 'rejected' to avoid data loss
  await connection.execute(`
    UPDATE g_change_requests SET status = 'rejected' WHERE status = 'conflict'
  `);

  // Then revert the ENUM
  await connection.execute(`
    ALTER TABLE g_change_requests 
    MODIFY COLUMN status ENUM('draft', 'open', 'approved', 'applied', 'rejected') NOT NULL DEFAULT 'draft'
  `);

  console.log('conflict status removed successfully');
};
