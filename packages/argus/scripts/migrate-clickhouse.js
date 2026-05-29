const { createClient } = require('@clickhouse/client');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LOCK_NAME = 'gatrix_argus_clickhouse_migration_lock';
const LOCK_TIMEOUT = 300;

const client = createClient({
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

const targetDatabase = process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus';

async function acquireLock(connection) {
  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?, ?) as lockResult', [
      LOCK_NAME,
      LOCK_TIMEOUT,
    ]);
    const lockResult = rows[0]?.lockResult;

    if (lockResult === 1) {
      console.log(`[argus] ClickHouse migration lock acquired: ${LOCK_NAME}`);
      return true;
    } else if (lockResult === 0) {
      console.log('[argus] Failed to acquire lock - another process is running ClickHouse migrations');
      return false;
    } else {
      console.error('[argus] Error acquiring lock - NULL returned');
      return false;
    }
  } catch (error) {
    console.error('[argus] Exception while acquiring lock:', error);
    return false;
  }
}

async function releaseLock(connection) {
  try {
    const [rows] = await connection.query('SELECT RELEASE_LOCK(?) as releaseResult', [LOCK_NAME]);
    const releaseResult = rows[0]?.releaseResult;

    if (releaseResult === 1) {
      console.log(`[argus] ClickHouse migration lock released: ${LOCK_NAME}`);
    } else if (releaseResult === 0) {
      console.log('[argus] Lock was not established by this thread');
    } else {
      console.log('[argus] Lock does not exist');
    }
  } catch (error) {
    console.error('[argus] Exception while releasing lock:', error);
  }
}

async function migrate() {
  let mysqlConnection;

  try {
    console.log('[argus] Starting ClickHouse migrations...');

    mysqlConnection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'gatrix_user',
      password: process.env.MYSQL_PASSWORD || 'gatrix_password',
      database: process.env.MYSQL_DATABASE || 'gatrix',
    });

    const lockAcquired = await acquireLock(mysqlConnection);

    if (!lockAcquired) {
      console.log('[argus] Skipping ClickHouse migrations - another process is already running them');
      process.exit(0);
    }

    try {
      await client.exec({
        query: `CREATE DATABASE IF NOT EXISTS ${targetDatabase}`,
      });
      console.log(`[argus] ClickHouse database created: ${targetDatabase}`);

      const dbClient = createClient({
        url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
        database: targetDatabase,
        username: process.env.CLICKHOUSE_USERNAME || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
      });

      const migrationsDir = path.join(__dirname, '../migrations/clickhouse');
      const files = fs.readdirSync(migrationsDir).sort();

      for (const file of files) {
        if (!file.endsWith('.sql')) continue;

        console.log(`[argus] Running ClickHouse migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

        for (const statement of statements) {
          if (statement) {
            await dbClient.exec({ query: statement });
          }
        }

        console.log(`[argus] ${file} completed`);
      }

      console.log('[argus] All ClickHouse migrations completed successfully');
    } finally {
      await releaseLock(mysqlConnection);
    }

    process.exit(0);
  } catch (error) {
    console.error('[argus] ClickHouse migration failed:', error);
    process.exit(1);
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
  }
}

migrate();
