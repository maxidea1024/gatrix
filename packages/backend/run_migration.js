require('dotenv').config();
const migration = require('./migrations/20241212000000_create_context_fields.js');

async function runMigration() {
  try {
    console.log('Running context fields migration...');

    // Create a mock knex instance
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gatrix'
    });

    const mockKnex = {
      schema: {
        createTable: async (tableName, callback) => {
          console.log(`Creating table: ${tableName}`);

          // Build the SQL manually for context fields table
          const sql = `
            CREATE TABLE IF NOT EXISTS g_context_fields (
              id INT AUTO_INCREMENT PRIMARY KEY,
              \`key\` VARCHAR(100) NOT NULL UNIQUE,
              name VARCHAR(200) NOT NULL,
              description TEXT,
              type ENUM('string', 'number', 'boolean', 'array') NOT NULL,
              options JSON,
              defaultValue TEXT,
              validation JSON,
              isActive BOOLEAN DEFAULT TRUE,
              isSystem BOOLEAN DEFAULT FALSE,
              createdBy INT,
              updatedBy INT,
              createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

              INDEX idx_key (\`key\`),
              INDEX idx_type (type),
              INDEX idx_isActive (isActive),

              FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
              FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
            )
          `;

          await connection.execute(sql);
          console.log(`Table ${tableName} created successfully`);
        }
      }
    };

    await migration.up(mockKnex);
    await connection.end();
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
