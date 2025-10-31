module.exports = {
  async up(connection) {
    console.log('Making startDate nullable in g_service_notices table...');

    // Check if startDate column is already nullable
    const [result] = await connection.execute(`
      SELECT COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_service_notices' 
      AND COLUMN_NAME = 'startDate'
    `);

    if (result.length > 0 && result[0].IS_NULLABLE === 'NO') {
      // Make startDate nullable
      await connection.execute(`
        ALTER TABLE g_service_notices
        MODIFY COLUMN startDate DATETIME NULL COMMENT 'Start date/time (optional, starts immediately if null)'
      `);

      console.log('✅ Made startDate nullable in g_service_notices');
    } else {
      console.log('⚠️  startDate is already nullable or column not found, skipping...');
    }
  },

  async down(connection) {
    console.log('Reverting startDate to NOT NULL in g_service_notices table...');

    // Check if startDate column exists
    const [result] = await connection.execute(`
      SELECT COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_service_notices' 
      AND COLUMN_NAME = 'startDate'
    `);

    if (result.length > 0 && result[0].IS_NULLABLE === 'YES') {
      await connection.execute(`
        ALTER TABLE g_service_notices
        MODIFY COLUMN startDate DATETIME NOT NULL COMMENT 'Start date/time (UTC)'
      `);

      console.log('✅ Reverted startDate to NOT NULL in g_service_notices');
    } else {
      console.log('⚠️  startDate is already NOT NULL or column not found, skipping...');
    }
  }
};

