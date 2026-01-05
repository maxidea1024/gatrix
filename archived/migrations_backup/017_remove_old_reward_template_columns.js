/**
 * Remove old reward templates columns
 * Remove nameKey and descriptionKey columns that are no longer used
 */

exports.up = async function(connection) {
  console.log('Removing old reward templates columns...');

  // Check if nameKey column exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_reward_templates'
    AND COLUMN_NAME = 'nameKey'
  `);

  if (columns.length > 0) {
    // Drop old columns one by one
    try {
      await connection.execute(`
        ALTER TABLE g_reward_templates
        DROP COLUMN nameKey
      `);
    } catch (e) {
      console.log('nameKey column already dropped or does not exist');
    }

    try {
      await connection.execute(`
        ALTER TABLE g_reward_templates
        DROP COLUMN descriptionKey
      `);
    } catch (e) {
      console.log('descriptionKey column already dropped or does not exist');
    }

    console.log('✅ Old reward templates columns removed successfully');
  } else {
    console.log('✅ Old reward templates columns already removed');
  }
};

exports.down = async function(connection) {
  console.log('Restoring old reward templates columns...');

  // Check if nameKey column exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_reward_templates'
    AND COLUMN_NAME = 'nameKey'
  `);

  if (columns.length === 0) {
    // Add back old columns
    await connection.execute(`
      ALTER TABLE g_reward_templates
      ADD COLUMN nameKey VARCHAR(128) NULL AFTER updatedBy,
      ADD COLUMN descriptionKey VARCHAR(128) NULL AFTER nameKey
    `);

    console.log('✅ Old reward templates columns restored successfully');
  }
};

