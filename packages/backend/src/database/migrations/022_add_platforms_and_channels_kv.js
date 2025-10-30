/**
 * Migration: Add platforms and channels system-defined KV items
 * - Add kv:platforms with platform definitions
 * - Add kv:channels with channel definitions
 */

exports.up = async function(connection) {
  console.log('Adding platforms and channels KV items...');

  // Insert system-defined platforms
  await connection.execute(`
    INSERT INTO g_vars (varKey, varValue, valueType, description, isSystemDefined, createdBy)
    VALUES (
      'kv:platforms',
      '[{"label":"PC","value":"pc"},{"label":"PC-WeGame","value":"pc-wegame"},{"label":"iOS","value":"ios"},{"label":"Android","value":"android"},{"label":"HarmonyOS","value":"harmonyos"}]',
      'array',
      '[elementType:object] Platform definitions with label and value. Used for platform selection in UI.',
      TRUE,
      1
    )
    ON DUPLICATE KEY UPDATE
      varValue = VALUES(varValue),
      valueType = VALUES(valueType),
      description = VALUES(description),
      isSystemDefined = VALUES(isSystemDefined)
  `);

  console.log('Platforms KV item added successfully');

  // Insert system-defined channels
  await connection.execute(`
    INSERT INTO g_vars (varKey, varValue, valueType, description, isSystemDefined, createdBy)
    VALUES (
      'kv:channels',
      '[{"label":"PC","value":"pc","subChannels":[{"label":"PC","value":"pc"}]},{"label":"iOS","value":"ios","subChannels":[{"label":"iOS","value":"ios"}]}]',
      'array',
      '[elementType:object] Channel definitions with label, value, and subChannels. Used for channel selection in UI.',
      TRUE,
      1
    )
    ON DUPLICATE KEY UPDATE
      varValue = VALUES(varValue),
      valueType = VALUES(valueType),
      description = VALUES(description),
      isSystemDefined = VALUES(isSystemDefined)
  `);

  console.log('Channels KV item added successfully');
};

exports.down = async function(connection) {
  console.log('Rolling back platforms and channels KV items...');

  // Remove system-defined platforms and channels
  await connection.execute(`
    DELETE FROM g_vars WHERE varKey IN ('kv:platforms', 'kv:channels')
  `);

  console.log('Rollback completed');
};

