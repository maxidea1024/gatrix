/**
 * Migration 036: Make endDate nullable in g_service_notices
 * 
 * This allows service notices to have no end date (permanent notices)
 */

async function up(connection) {
  console.log('Making endDate nullable in g_service_notices...');

  try {
    // Check if endDate column exists and is NOT NULL
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_service_notices'
      AND COLUMN_NAME = 'endDate'
    `);

    if (columns.length > 0) {
      const column = columns[0];
      if (column.IS_NULLABLE === 'NO') {
        // Make endDate nullable
        await connection.execute(`
          ALTER TABLE g_service_notices
          MODIFY COLUMN endDate DATETIME NULL COMMENT 'End date/time (UTC) - optional, null means no end date'
        `);
        console.log('✅ endDate column made nullable');
      } else {
        console.log('✅ endDate column is already nullable');
      }
    } else {
      console.log('⚠️ endDate column not found');
    }
  } catch (error) {
    console.error('Error making endDate nullable:', error);
    throw error;
  }
}

async function down(connection) {
  console.log('Reverting endDate to NOT NULL...');

  try {
    // Set any NULL endDate values to a far future date before making it NOT NULL
    await connection.execute(`
      UPDATE g_service_notices
      SET endDate = '2099-12-31 23:59:59'
      WHERE endDate IS NULL
    `);

    await connection.execute(`
      ALTER TABLE g_service_notices
      MODIFY COLUMN endDate DATETIME NOT NULL COMMENT 'End date/time (UTC)'
    `);
    console.log('✅ endDate column reverted to NOT NULL');
  } catch (error) {
    console.error('Error reverting endDate:', error);
    throw error;
  }
}

module.exports = { up, down };

