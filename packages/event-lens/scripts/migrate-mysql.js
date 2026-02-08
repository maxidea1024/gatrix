const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LOCK_NAME = 'gatrix_event_lens_mysql_migration_lock';
const LOCK_TIMEOUT = 300; // 5 minutes in seconds

async function acquireLock(connection) {
  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?, ?) as lockResult', [
      LOCK_NAME,
      LOCK_TIMEOUT,
    ]);
    const lockResult = rows[0]?.lockResult;

    if (lockResult === 1) {
      console.log(`✅ Migration lock acquired: ${LOCK_NAME}`);
      return true;
    } else if (lockResult === 0) {
      console.log(`⚠️  Failed to acquire lock - another process is running migrations`);
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
      console.log(`✅ Migration lock released: ${LOCK_NAME}`);
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
  let connection;

  try {
    console.log('🚀 Starting Event Lens MySQL migrations...');

    // MySQL 연결
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'gatrix_user',
      password: process.env.MYSQL_PASSWORD || 'gatrix_password',
      database: process.env.MYSQL_DATABASE || 'gatrix',
      multipleStatements: true,
    });

    console.log('✅ MySQL connected');

    // Acquire distributed lock
    const lockAcquired = await acquireLock(connection);

    if (!lockAcquired) {
      console.log('⏭️  Skipping migrations - another process is already running them');
      process.exit(0);
    }

    try {
      // 마이그레이션 파일 읽기
      const migrationsDir = path.join(__dirname, '../migrations/mysql');
      const files = fs.readdirSync(migrationsDir).sort();

      for (const file of files) {
        if (!file.endsWith('.sql')) continue;

        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        await connection.query(sql);
        console.log(`✅ ${file} completed`);
      }

      console.log('✅ All Event Lens MySQL migrations completed successfully');
    } finally {
      // Always release the lock
      await releaseLock(connection);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
