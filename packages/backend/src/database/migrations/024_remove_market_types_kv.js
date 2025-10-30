/**
 * Migration: Remove marketTypes KV item
 * - Delete kv:marketTypes from g_vars table
 * - This KV item is no longer used in the system
 */

exports.up = async function(connection) {
  console.log('Removing marketTypes KV item...');

  // Delete kv:marketTypes
  await connection.execute(`
    DELETE FROM g_vars WHERE varKey = 'kv:marketTypes'
  `);

  console.log('marketTypes KV item removed successfully');
};

exports.down = async function(connection) {
  console.log('Restoring marketTypes KV item...');

  // Restore kv:marketTypes
  await connection.execute(`
    INSERT INTO g_vars (varKey, varValue, valueType, description, isSystemDefined, createdBy)
    VALUES (
      'kv:marketTypes',
      '["PC","A1"]',
      'array',
      'Market types for the system',
      TRUE,
      1
    )
    ON DUPLICATE KEY UPDATE
      varValue = VALUES(varValue),
      valueType = VALUES(valueType),
      isSystemDefined = VALUES(isSystemDefined)
  `);

  console.log('marketTypes KV item restored successfully');
};

