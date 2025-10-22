/**
 * Migration: Add KV (Key-Value) support to g_vars table
 * - Add valueType column to store data type information
 * - Add isSystemDefined flag to protect system-defined keys
 * - Add system-defined market types
 */

exports.up = async function(connection) {
  console.log('Adding KV support to g_vars table...');

  // Add valueType and isSystemDefined columns
  await connection.execute(`
    ALTER TABLE g_vars
    ADD COLUMN valueType VARCHAR(50) NULL DEFAULT 'string' COMMENT 'Value type: string, number, boolean, color, object, array',
    ADD COLUMN isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'System-defined keys cannot be deleted or have type/name changed',
    ADD INDEX idx_system_defined (isSystemDefined)
  `);

  console.log('Columns added successfully');

  // Insert system-defined market types
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

  console.log('System-defined market types added successfully');
};

exports.down = async function(connection) {
  console.log('Rolling back KV support from g_vars table...');

  // Remove system-defined market types
  await connection.execute(`
    DELETE FROM g_vars WHERE varKey = 'kv:marketTypes'
  `);

  // Remove columns
  await connection.execute(`
    ALTER TABLE g_vars
    DROP INDEX idx_system_defined,
    DROP COLUMN isSystemDefined,
    DROP COLUMN valueType
  `);

  console.log('Rollback completed');
};

