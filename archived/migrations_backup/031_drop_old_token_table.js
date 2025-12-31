/**
 * Migration 031: Drop old g_remote_config_api_tokens table
 *
 * This migration drops the old g_remote_config_api_tokens table as it's no longer used.
 * All API tokens are now managed through g_api_access_tokens table.
 */

exports.up = async function(connection) {
  console.log('Dropping old g_remote_config_api_tokens table...');

  try {
    await connection.execute('DROP TABLE IF EXISTS g_remote_config_api_tokens');
    console.log('✅ Old g_remote_config_api_tokens table dropped successfully');
  } catch (error) {
    console.log('⚠️ Could not drop g_remote_config_api_tokens table:', error.message);
  }
};

exports.down = async function(connection) {
  console.log('Reverting: Cannot restore dropped table in down migration');
  console.log('⚠️ This migration cannot be reverted as the table structure is not preserved');
};

