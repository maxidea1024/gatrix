/**
 * Make email field optional in g_invitations table
 * This allows creating invitations without specifying an email address
 */

exports.up = async function (connection) {
  // Connection is provided by the migration system
  console.log('Making email field optional in g_invitations table...');

  await connection.execute(`
    ALTER TABLE g_invitations
    MODIFY COLUMN email VARCHAR(255) NULL COMMENT 'Email address of the invitee (optional)'
  `);

  console.log('✓ Email field in g_invitations table is now optional');
};

exports.down = async function (connection) {
  // Connection is provided by the migration system
  console.log('Making email field required in g_invitations table...');

  // Note: This rollback might fail if there are NULL email values in the table
  await connection.execute(`
    ALTER TABLE g_invitations
    MODIFY COLUMN email VARCHAR(255) NOT NULL COMMENT 'Email address of the invitee'
  `);

  console.log('✓ Email field in g_invitations table is now required');
};
