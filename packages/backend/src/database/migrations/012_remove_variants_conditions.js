const mysql = require('mysql2/promise');

/**
 * Remove conditions column from g_remote_config_variants table
 * Variants are for pure A/B testing with traffic split only, no conditions needed
 */
exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Removing conditions column from g_remote_config_variants table...');

  try {
    // Check if column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_remote_config_variants' 
        AND COLUMN_NAME = 'conditions'
    `);

    if (columns.length > 0) {
      // Remove conditions column
      await connection.execute(`
        ALTER TABLE g_remote_config_variants 
        DROP COLUMN conditions
      `);

      console.log('✓ conditions column removed from g_remote_config_variants');
    } else {
      console.log('✓ conditions column does not exist in g_remote_config_variants');
    }

  } catch (error) {
    console.error('Error removing conditions column:', error);
    throw error;
  }

  await connection.end();
};

/**
 * Add conditions column back to g_remote_config_variants table
 */
exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Adding conditions column back to g_remote_config_variants table...');

  try {
    // Add conditions column back
    await connection.execute(`
      ALTER TABLE g_remote_config_variants 
      ADD COLUMN conditions JSON NULL 
      AFTER trafficPercentage
    `);

    console.log('✓ conditions column added back to g_remote_config_variants');

  } catch (error) {
    console.error('Error adding conditions column back:', error);
    throw error;
  }

  await connection.end();
};
