const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LOCK_NAME = 'gatrix_argus_mysql_migration_lock';
const LOCK_TIMEOUT = 300;

async function acquireLock(connection) {
  try {
    const [rows] = await connection.query('SELECT GET_LOCK(?, ?) as lockResult', [
      LOCK_NAME,
      LOCK_TIMEOUT,
    ]);
    const lockResult = rows[0]?.lockResult;

    if (lockResult === 1) {
      console.log(`[argus] MySQL migration lock acquired: ${LOCK_NAME}`);
      return true;
    } else if (lockResult === 0) {
      console.log('[argus] Failed to acquire lock - another process is running migrations');
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
      console.log(`[argus] MySQL migration lock released: ${LOCK_NAME}`);
    } else if (releaseResult === 0) {
      console.log('[argus] Lock was not established by this thread');
    } else {
      console.log('[argus] Lock does not exist');
    }
  } catch (error) {
    console.error('[argus] Exception while releasing lock:', error);
  }
}

function splitSql(sql) {
  const statements = [];
  let currentDelimiter = ';';
  let buffer = '';
  const lines = sql.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith('DELIMITER')) {
      if (buffer.trim()) {
        statements.push(buffer.trim());
        buffer = '';
      }
      const parts = trimmed.split(/\s+/);
      if (parts.length > 1) {
        currentDelimiter = parts[1];
      }
      continue;
    }

    if (buffer) {
      buffer += '\n';
    }
    buffer += line;

    if (buffer.trim().endsWith(currentDelimiter)) {
      let stmt = buffer.trim();
      stmt = stmt.slice(0, -currentDelimiter.length).trim();
      if (stmt) {
        statements.push(stmt);
      }
      buffer = '';
    }
  }

  if (buffer.trim()) {
    statements.push(buffer.trim());
  }

  return statements;
}

async function migrate() {
  let connection;

  try {
    console.log('[argus] Starting MySQL migrations...');

    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'gatrix_user',
      password: process.env.MYSQL_PASSWORD || 'gatrix_password',
      database: process.env.MYSQL_DATABASE || 'gatrix',
      multipleStatements: true,
    });

    console.log('[argus] MySQL connected');

    const lockAcquired = await acquireLock(connection);

    if (!lockAcquired) {
      console.log('[argus] Skipping migrations - another process is already running them');
      process.exit(0);
    }

    try {
      const migrationsDir = path.join(__dirname, '../migrations/mysql');
      const files = fs.readdirSync(migrationsDir).sort();

      for (const file of files) {
        if (!file.endsWith('.sql')) continue;

        console.log(`[argus] Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        const statements = splitSql(sql);
        for (const statement of statements) {
          await connection.query(statement);
        }
        console.log(`[argus] ${file} completed`);
      }

      console.log('[argus] All MySQL migrations completed successfully');
    } finally {
      await releaseLock(connection);
    }

    process.exit(0);
  } catch (error) {
    console.error('[argus] Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
