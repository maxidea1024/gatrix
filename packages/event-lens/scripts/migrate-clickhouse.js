const { createClient } = require('@clickhouse/client');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LOCK_NAME = 'gatrix_event_lens_clickhouse_migration_lock';
const LOCK_TIMEOUT = 300; // 5 minutes in seconds

const client = createClient({
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.CLICKHOUSE_DATABASE || 'event_lens',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

async function acquireLock(connection) {
  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?, ?) as lockResult', [LOCK_NAME, LOCK_TIMEOUT]);
    const lockResult = rows[0]?.lockResult;

    if (lockResult === 1) {
      console.log(`✅ ClickHouse migration lock acquired: ${LOCK_NAME}`);
      return true;
    } else if (lockResult === 0) {
      console.log(`⚠️  Failed to acquire lock - another process is running ClickHouse migrations`);
      return false;
    } else {
      console.error(`❌ Error acquiring lock - NULL returned`);
      return false;
    }
  } catch (error) {
    console.error('❌ Exception while acquiring lock:', error);
    return false;
  }
}

async function releaseLock(connection) {
  try {
    const [rows] = await connection.query('SELECT RELEASE_LOCK(?) as releaseResult', [LOCK_NAME]);
    const releaseResult = rows[0]?.releaseResult;

    if (releaseResult === 1) {
      console.log(`✅ ClickHouse migration lock released: ${LOCK_NAME}`);
    } else if (releaseResult === 0) {
      console.log(`⚠️  Lock was not established by this thread`);
    } else {
      console.log(`⚠️  Lock does not exist`);
    }
  } catch (error) {
    console.error('❌ Exception while releasing lock:', error);
  }
}

async function migrate() {
  let mysqlConnection;

  try {
    console.log('🚀 Starting ClickHouse migrations...');

    // MySQL 연결 (락 관리용)
    mysqlConnection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'gatrix_user',
      password: process.env.MYSQL_PASSWORD || 'gatrix_password',
      database: process.env.MYSQL_DATABASE || 'gatrix',
    });

    // Acquire distributed lock via MySQL
    const lockAcquired = await acquireLock(mysqlConnection);

    if (!lockAcquired) {
      console.log('⏭️  Skipping ClickHouse migrations - another process is already running them');
      process.exit(0);
    }

    try {
      // 데이터베이스 생성
      await client.exec({
        query: `CREATE DATABASE IF NOT EXISTS ${process.env.CLICKHOUSE_DATABASE || 'event_lens'}`,
      });
      console.log('✅ ClickHouse database created');

      // 마이그레이션 파일 읽기
      const migrationsDir = path.join(__dirname, '../migrations/clickhouse');
      const files = fs.readdirSync(migrationsDir).sort();

      for (const file of files) {
        if (!file.endsWith('.sql')) continue;

        console.log(`Running ClickHouse migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        // SQL 문을 세미콜론으로 분리
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

        for (const statement of statements) {
          if (statement) {
            await client.exec({ query: statement });
          }
        }

        console.log(`✅ ${file} completed`);
      }

      console.log('✅ All ClickHouse migrations completed successfully');
    } finally {
      // Always release the lock
      await releaseLock(mysqlConnection);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ ClickHouse migration failed:', error);
    process.exit(1);
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
  }
}

migrate();

