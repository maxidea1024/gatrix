/**
 * Migration: Add afterData and beforeData columns to g_change_items
 *
 * These columns store the full entity snapshot before and after the change.
 */

exports.up = async function (connection) {
  console.log('Adding afterData and beforeData columns to g_change_items...');

  // Check and add afterData column
  const [afterDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'afterData'
  `);

  if (afterDataCols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_change_items 
      ADD COLUMN afterData JSON NULL AFTER targetId
    `);
    console.log('afterData column added');
  } else {
    console.log('afterData column already exists, skipping...');
  }

  // Check and add beforeData column
  const [beforeDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'beforeData'
  `);

  if (beforeDataCols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_change_items 
      ADD COLUMN beforeData JSON NULL AFTER afterData
    `);
    console.log('beforeData column added');
  } else {
    console.log('beforeData column already exists, skipping...');
  }

  console.log('Migration completed successfully');
};

exports.down = async function (connection) {
  console.log('Removing afterData and beforeData columns from g_change_items...');

  const [afterDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'afterData'
  `);

  if (afterDataCols.length > 0) {
    await connection.execute(`ALTER TABLE g_change_items DROP COLUMN afterData`);
    console.log('afterData column removed');
  }

  const [beforeDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'beforeData'
  `);

  if (beforeDataCols.length > 0) {
    await connection.execute(`ALTER TABLE g_change_items DROP COLUMN beforeData`);
    console.log('beforeData column removed');
  }

  console.log('Columns removed successfully');
};
