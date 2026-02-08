require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix',
};

async function addUsageCountColumn() {
  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection(config);

    console.log('Connected to database');

    // Check if usageCount column already exists
    const [columns] = await connection.execute(
      `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_api_access_tokens' AND COLUMN_NAME = 'usageCount'
    `,
      [config.database]
    );

    if (columns.length > 0) {
      console.log('⚠️ usageCount column already exists');
      return;
    }

    // Add usageCount column
    await connection.execute(`
      ALTER TABLE g_api_access_tokens 
      ADD COLUMN usageCount BIGINT DEFAULT 0 NOT NULL AFTER lastUsedAt
    `);

    console.log('✅ Added usageCount column to g_api_access_tokens table');

    // Add index for performance
    await connection.execute(`
      CREATE INDEX idx_api_tokens_usage_count ON g_api_access_tokens(usageCount)
    `);

    console.log('✅ Added index on usageCount column');
  } catch (error) {
    console.error('❌ Error adding usageCount column:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
addUsageCountColumn()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
