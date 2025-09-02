/**
 * Migration to add multi-language support flag to message templates
 */

const mysql = require('mysql2/promise');

async function up(connection) {
  console.log('Running migration: Add supportsMultiLanguage field to g_message_templates');

  try {
    // Check if the table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_message_templates'
    `);

    if (tables.length === 0) {
      console.log('g_message_templates table does not exist, skipping migration');
      return;
    }

    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_message_templates' 
        AND COLUMN_NAME = 'supportsMultiLanguage'
    `);

    if (columns.length > 0) {
      console.log('supportsMultiLanguage column already exists, skipping migration');
      return;
    }

    // Add supportsMultiLanguage column
    await connection.execute(`
      ALTER TABLE g_message_templates 
      ADD COLUMN supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE 
      AFTER isEnabled
    `);

    console.log('Successfully added supportsMultiLanguage column to g_message_templates');

  } catch (error) {
    console.error('Error adding supportsMultiLanguage column:', error);
    throw error;
  }
}

async function down(connection) {
  console.log('Rolling back migration: Remove supportsMultiLanguage field from g_message_templates');
  
  try {
    // Check if the table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_message_templates'
    `);

    if (tables.length === 0) {
      console.log('g_message_templates table does not exist, skipping rollback');
      return;
    }

    // Remove supportsMultiLanguage column
    await connection.execute(`
      ALTER TABLE g_message_templates 
      DROP COLUMN supportsMultiLanguage
    `);

    console.log('Successfully removed supportsMultiLanguage column from g_message_templates');

  } catch (error) {
    console.error('Error removing supportsMultiLanguage column:', error);
    throw error;
  }
}

module.exports = { up, down };

// 스크립트 직접 실행
if (require.main === module) {
  async function runMigration() {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gatrix'
    });

    try {
      await up(connection);
    } catch (error) {
      console.error('Migration failed:', error);
    } finally {
      await connection.end();
    }
  }

  runMigration().catch(console.error);
}
