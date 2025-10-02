/**
 * Make email field optional in g_invitations table
 * This allows creating invitations without specifying an email address
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Making email field optional in g_invitations table...');

  await connection.execute(`
    ALTER TABLE g_invitations 
    MODIFY COLUMN email VARCHAR(255) NULL COMMENT 'Email address of the invitee (optional)'
  `);

  console.log('✓ Email field in g_invitations table is now optional');

  await connection.end();
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Making email field required in g_invitations table...');

  // Note: This rollback might fail if there are NULL email values in the table
  await connection.execute(`
    ALTER TABLE g_invitations 
    MODIFY COLUMN email VARCHAR(255) NOT NULL COMMENT 'Email address of the invitee'
  `);

  console.log('✓ Email field in g_invitations table is now required');

  await connection.end();
};
