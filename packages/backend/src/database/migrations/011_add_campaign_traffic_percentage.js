const mysql = require('mysql2/promise');

/**
 * Add trafficPercentage column to g_remote_config_campaigns table
 */
exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Adding trafficPercentage column to g_remote_config_campaigns table...');

  try {
    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_remote_config_campaigns' 
        AND COLUMN_NAME = 'trafficPercentage'
    `);

    if (columns.length === 0) {
      // Add trafficPercentage column after targetConditions
      await connection.execute(`
        ALTER TABLE g_remote_config_campaigns 
        ADD COLUMN trafficPercentage DECIMAL(5,2) NOT NULL DEFAULT 100.00 
        AFTER targetConditions
      `);

      // Add index for trafficPercentage
      await connection.execute(`
        ALTER TABLE g_remote_config_campaigns 
        ADD INDEX idx_traffic_percentage (trafficPercentage)
      `);

      console.log('✓ trafficPercentage column added to g_remote_config_campaigns');
    } else {
      console.log('✓ trafficPercentage column already exists in g_remote_config_campaigns');
    }

  } catch (error) {
    console.error('Error adding trafficPercentage column:', error);
    throw error;
  }

  await connection.end();
};

/**
 * Remove trafficPercentage column from g_remote_config_campaigns table
 */
exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Removing trafficPercentage column from g_remote_config_campaigns table...');

  try {
    // Drop index first
    await connection.execute(`
      ALTER TABLE g_remote_config_campaigns 
      DROP INDEX IF EXISTS idx_traffic_percentage
    `);

    // Drop column
    await connection.execute(`
      ALTER TABLE g_remote_config_campaigns 
      DROP COLUMN IF EXISTS trafficPercentage
    `);

    console.log('✓ trafficPercentage column removed from g_remote_config_campaigns');

  } catch (error) {
    console.error('Error removing trafficPercentage column:', error);
    throw error;
  }

  await connection.end();
};
