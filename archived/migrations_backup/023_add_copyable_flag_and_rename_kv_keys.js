/**
 * Migration: Add isCopyable flag to g_vars and rename KV keys
 *
 * Purpose: Ensure g_vars table has isCopyable and valueType columns
 * This migration adds these columns if they don't already exist.
 */

exports.up = async function (connection) {
  try {
    // Check if isCopyable column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_vars'
      AND COLUMN_NAME IN ('isCopyable', 'valueType', 'isSystemDefined')
    `);

    const existingColumns = columns.map((col) => col.COLUMN_NAME);

    // Add isCopyable if it doesn't exist
    if (!existingColumns.includes('isCopyable')) {
      console.log('Adding isCopyable column to g_vars table...');
      await connection.execute(`
        ALTER TABLE g_vars
        ADD COLUMN isCopyable BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether this variable can be copied'
      `);
      console.log('✓ Successfully added isCopyable column');
    } else {
      console.log('✓ isCopyable column already exists');
    }

    // Add valueType if it doesn't exist
    if (!existingColumns.includes('valueType')) {
      console.log('Adding valueType column to g_vars table...');
      await connection.execute(`
        ALTER TABLE g_vars
        ADD COLUMN valueType VARCHAR(50) NOT NULL DEFAULT 'string' COMMENT 'Type of value: string, number, boolean, color, object, array'
      `);
      console.log('✓ Successfully added valueType column');
    } else {
      console.log('✓ valueType column already exists');
    }

    // Add isSystemDefined if it doesn't exist
    if (!existingColumns.includes('isSystemDefined')) {
      console.log('Adding isSystemDefined column to g_vars table...');
      await connection.execute(`
        ALTER TABLE g_vars
        ADD COLUMN isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this is a system-defined variable'
      `);
      console.log('✓ Successfully added isSystemDefined column');
    } else {
      console.log('✓ isSystemDefined column already exists');
    }
  } catch (error) {
    console.error('Error in migration 023_add_copyable_flag_and_rename_kv_keys:', error);
    throw error;
  }
};

exports.down = async function (connection) {
  try {
    // Check if columns exist before dropping
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_vars'
      AND COLUMN_NAME IN ('isCopyable', 'valueType', 'isSystemDefined')
    `);

    const existingColumns = columns.map((col) => col.COLUMN_NAME);

    if (existingColumns.includes('isCopyable')) {
      console.log('Removing isCopyable column from g_vars table...');
      await connection.execute(`ALTER TABLE g_vars DROP COLUMN isCopyable`);
      console.log('✓ Successfully removed isCopyable column');
    }

    if (existingColumns.includes('valueType')) {
      console.log('Removing valueType column from g_vars table...');
      await connection.execute(`ALTER TABLE g_vars DROP COLUMN valueType`);
      console.log('✓ Successfully removed valueType column');
    }

    if (existingColumns.includes('isSystemDefined')) {
      console.log('Removing isSystemDefined column from g_vars table...');
      await connection.execute(`ALTER TABLE g_vars DROP COLUMN isSystemDefined`);
      console.log('✓ Successfully removed isSystemDefined column');
    }
  } catch (error) {
    console.error('Error rolling back migration 023_add_copyable_flag_and_rename_kv_keys:', error);
    throw error;
  }
};
