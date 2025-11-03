/**
 * Migration 032: Remove permissions column from g_api_access_tokens table
 *
 * This migration removes the permissions column as token permissions are now determined by token type.
 * Also updates token type enum to remove 'admin' type.
 */

exports.up = async function(connection) {
  console.log('Removing permissions column from g_api_access_tokens table...');

  try {
    // Check if permissions column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_api_access_tokens'
      AND COLUMN_NAME = 'permissions'
    `);

    if (columns.length > 0) {
      await connection.execute('ALTER TABLE g_api_access_tokens DROP COLUMN permissions');
      console.log('✅ permissions column removed from g_api_access_tokens table');
    } else {
      console.log('✅ permissions column does not exist in g_api_access_tokens table');
    }

    // Update token type enum to remove 'admin' type
    await connection.execute(`
      ALTER TABLE g_api_access_tokens 
      MODIFY COLUMN tokenType ENUM('client', 'server') NOT NULL
    `);
    console.log('✅ tokenType enum updated to remove admin type');
  } catch (error) {
    console.log('⚠️ Error during migration:', error.message);
  }
};

exports.down = async function(connection) {
  console.log('Reverting: Cannot restore dropped column in down migration');
  console.log('⚠️ This migration cannot be fully reverted as the column structure is not preserved');
};

