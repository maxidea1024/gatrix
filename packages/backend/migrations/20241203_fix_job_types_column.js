const mysql = require('mysql2/promise');

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Fixing g_job_types column name from isActive to isEnabled...');

  // Check if isActive column exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'g_job_types' 
    AND COLUMN_NAME = 'isActive'
  `);

  if (columns.length > 0) {
    // Rename isActive to isEnabled
    await connection.execute(`
      ALTER TABLE g_job_types 
      CHANGE COLUMN isActive isEnabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
    console.log('Column renamed from isActive to isEnabled');
  } else {
    console.log('Column isActive not found, checking if isEnabled already exists...');
    
    const [enabledColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_job_types' 
      AND COLUMN_NAME = 'isEnabled'
    `);
    
    if (enabledColumns.length === 0) {
      // Add isEnabled column if it doesn't exist
      await connection.execute(`
        ALTER TABLE g_job_types 
        ADD COLUMN isEnabled BOOLEAN NOT NULL DEFAULT TRUE
      `);
      console.log('Added isEnabled column');
    } else {
      console.log('isEnabled column already exists');
    }
  }

  await connection.end();
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Rolling back: renaming isEnabled to isActive...');

  // Check if isEnabled column exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'g_job_types' 
    AND COLUMN_NAME = 'isEnabled'
  `);

  if (columns.length > 0) {
    // Rename isEnabled back to isActive
    await connection.execute(`
      ALTER TABLE g_job_types 
      CHANGE COLUMN isEnabled isActive BOOLEAN NOT NULL DEFAULT TRUE
    `);
    console.log('Column renamed back from isEnabled to isActive');
  }

  await connection.end();
};
