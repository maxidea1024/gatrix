const { createClient } = require('@clickhouse/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = createClient({
  host: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.CLICKHOUSE_DATABASE || 'event_lens',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

async function migrate() {
  try {
    console.log('🚀 Starting ClickHouse migrations...');

    // 데이터베이스 생성
    await client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${process.env.CLICKHOUSE_DATABASE || 'event_lens'}`,
    });
    console.log('✅ Database created');

    // 마이그레이션 파일 읽기
    const migrationsDir = path.join(__dirname, '../migrations/clickhouse');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      // SQL 문을 세미콜론으로 분리
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await client.exec({ query: statement });
      }

      console.log(`✅ ${file} completed`);
    }

    console.log('✅ All ClickHouse migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

