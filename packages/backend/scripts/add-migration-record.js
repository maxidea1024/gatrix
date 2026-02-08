const mysql = require('mysql2/promise');

async function addMigrationRecord() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'gatrix_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'gatrix',
  });

  try {
    console.log('🔍 Checking migration record...\n');

    const [existing] = await connection.execute('SELECT * FROM g_migrations WHERE name = ?', [
      '009_create_api_access_tokens',
    ]);

    if (existing.length > 0) {
      console.log('✅ Migration record already exists');
      console.log(`   Executed at: ${existing[0].executedAt}\n`);
    } else {
      console.log('⚠️  Migration record does not exist. Adding...\n');

      // Check table structure first
      const [columns] = await connection.execute('DESCRIBE g_migrations');
      const hasAutoIncrement = columns.some(
        (col) => col.Field === 'id' && col.Extra.includes('auto_increment')
      );

      if (hasAutoIncrement) {
        await connection.execute('INSERT INTO g_migrations (name, executedAt) VALUES (?, NOW())', [
          '009_create_api_access_tokens',
        ]);
      } else {
        // Get next ID
        const [maxId] = await connection.execute(
          'SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM g_migrations'
        );
        await connection.execute(
          'INSERT INTO g_migrations (id, name, executedAt) VALUES (?, ?, NOW())',
          [maxId[0].nextId, '009_create_api_access_tokens']
        );
      }

      console.log('✅ Migration record added\n');
    }

    const [migrations] = await connection.execute(
      'SELECT * FROM g_migrations ORDER BY executedAt DESC LIMIT 5'
    );

    console.log('📋 Recent migrations:');
    migrations.forEach((m) => {
      console.log(`   ${m.name} - ${m.executedAt}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addMigrationRecord();
