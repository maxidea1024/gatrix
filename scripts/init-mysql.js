#!/usr/bin/env node

/**
 * Gatrix MySQL Database Initialization Script
 *
 * Creates databases and users required by the Gatrix application.
 * This script is intended for environments where MySQL is NOT managed
 * by Docker (e.g., AWS RDS, GCP Cloud SQL, Azure Database for MySQL).
 *
 * When using Docker, the docker/mysql/init/01-init.sql script handles
 * this automatically on first container startup.
 *
 * Usage:
 *   node scripts/init-mysql.js [OPTIONS]
 *
 * Options:
 *   --host <address>     MySQL host (default: from .env or localhost)
 *   --port <port>        MySQL port (default: from .env or 3306)
 *   --root-user <user>   Admin user with CREATE DATABASE privileges (default: root)
 *   --root-password <pw> Admin user password (prompted if not provided)
 *   --config <path>      JSON5 config file path (default: ./gatrix.config.json5)
 *   --skip-backend       Skip backend database creation
 *   --skip-chat          Skip chat database creation
 *   --skip-crash         Skip crash database creation
 *   --dry-run            Print SQL statements without executing
 *   --help               Show this help message
 *
 * Examples:
 *   node scripts/init-mysql.js --host rds-instance.amazonaws.com --root-user admin --root-password secret
 *   node scripts/init-mysql.js --dry-run
 *   node scripts/init-mysql.js --skip-crash
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================
// CLI argument parsing
// ============================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    host: null,
    port: null,
    rootUser: 'root',
    rootPassword: null,
    configPath: null,
    skipBackend: false,
    skipChat: false,
    skipCrash: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--host':
        opts.host = args[++i];
        break;
      case '--port':
        opts.port = parseInt(args[++i], 10);
        break;
      case '--root-user':
        opts.rootUser = args[++i];
        break;
      case '--root-password':
        opts.rootPassword = args[++i];
        break;
      case '--config':
        opts.configPath = args[++i];
        break;
      case '--skip-backend':
        opts.skipBackend = true;
        break;
      case '--skip-chat':
        opts.skipChat = true;
        break;
      case '--skip-crash':
        opts.skipCrash = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--help':
        console.log(
          fs
            .readFileSync(__filename, 'utf8')
            .match(/\/\*\*([\s\S]*?)\*\//)[0]
        );
        process.exit(0);
    }
  }

  return opts;
}

// ============================================================
// Load configuration from JSON5 or .env fallback
// ============================================================
function loadDatabaseConfig(opts) {
  const projectRoot = path.resolve(__dirname, '..');

  // Try JSON5 config first
  const configPath =
    opts.configPath || path.join(projectRoot, 'gatrix.config.json5');

  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      const JSON5 = require('json5');
      const raw = fs.readFileSync(configPath, 'utf8');
      cfg = JSON5.parse(raw);
      console.log(`[INFO] Loaded config from: ${configPath}`);
    } catch (e) {
      console.warn(`[WARN] Failed to parse JSON5 config: ${e.message}`);
    }
  }

  // Fallback to .env
  try {
    require('dotenv').config({ path: path.join(projectRoot, '.env') });
  } catch (e) {
    // dotenv not available, skip
  }

  const svc = cfg.services || {};

  return {
    // Connection settings (CLI args take priority)
    host:
      opts.host || process.env.DB_HOST || 'localhost',
    port:
      opts.port ||
      parseInt(process.env.DB_PORT || '3306', 10),

    // Backend database
    backend: {
      name: svc.backend?.db?.name || process.env.DB_NAME || 'gatrix',
      user:
        svc.backend?.db?.user || process.env.DB_USER || 'gatrix_user',
      password:
        svc.backend?.db?.password ||
        process.env.DB_PASSWORD ||
        'gatrix_password',
    },

    // Chat database
    chat: {
      name:
        svc.chatServer?.db?.name ||
        process.env.CHAT_DB_NAME ||
        'gatrix_chat',
      user:
        svc.chatServer?.db?.user ||
        process.env.CHAT_DB_USER ||
        'gatrix_user',
      password:
        svc.chatServer?.db?.password ||
        process.env.CHAT_DB_PASSWORD ||
        'gatrix_password',
    },

    // Crash database
    crash: {
      name:
        svc.crashDb?.name || process.env.CRASH_DB_NAME || 'gatrix_crash',
      user:
        svc.crashDb?.user || process.env.CRASH_DB_USER || 'gatrix_user',
      password:
        svc.crashDb?.password ||
        process.env.CRASH_DB_PASSWORD ||
        'gatrix_password',
    },
  };
}

// ============================================================
// Prompt for password if not provided
// ============================================================
function promptPassword(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // Hide input for password
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ============================================================
// Generate SQL statements
// ============================================================
function generateSQL(dbConfig, opts) {
  const statements = [];

  statements.push('-- Gatrix MySQL Database Initialization');
  statements.push(`-- Generated at: ${new Date().toISOString()}`);
  statements.push('');

  // Backend database
  if (!opts.skipBackend) {
    const b = dbConfig.backend;
    statements.push('-- ======================================');
    statements.push('-- Backend Database (main)');
    statements.push('-- ======================================');
    statements.push(
      `CREATE DATABASE IF NOT EXISTS \`${b.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    statements.push(
      `CREATE USER IF NOT EXISTS '${b.user}'@'%' IDENTIFIED BY '${b.password}';`
    );
    statements.push(
      `GRANT ALL PRIVILEGES ON \`${b.name}\`.* TO '${b.user}'@'%';`
    );

    // Test database
    statements.push('');
    statements.push(
      `CREATE DATABASE IF NOT EXISTS \`${b.name}_test\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    statements.push(
      `GRANT ALL PRIVILEGES ON \`${b.name}_test\`.* TO '${b.user}'@'%';`
    );
    statements.push('');
  }

  // Chat database
  if (!opts.skipChat) {
    const c = dbConfig.chat;
    statements.push('-- ======================================');
    statements.push('-- Chat Database');
    statements.push('-- ======================================');
    statements.push(
      `CREATE DATABASE IF NOT EXISTS \`${c.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    // Only create user if different from backend user
    if (
      c.user !== dbConfig.backend.user ||
      c.password !== dbConfig.backend.password
    ) {
      statements.push(
        `CREATE USER IF NOT EXISTS '${c.user}'@'%' IDENTIFIED BY '${c.password}';`
      );
    }
    statements.push(
      `GRANT ALL PRIVILEGES ON \`${c.name}\`.* TO '${c.user}'@'%';`
    );
    statements.push('');
  }

  // Crash database
  if (!opts.skipCrash) {
    const cr = dbConfig.crash;
    statements.push('-- ======================================');
    statements.push('-- Crash Database (separated for load isolation)');
    statements.push('-- ======================================');
    statements.push(
      `CREATE DATABASE IF NOT EXISTS \`${cr.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    // Only create user if different from backend user
    if (
      cr.user !== dbConfig.backend.user ||
      cr.password !== dbConfig.backend.password
    ) {
      statements.push(
        `CREATE USER IF NOT EXISTS '${cr.user}'@'%' IDENTIFIED BY '${cr.password}';`
      );
    }
    statements.push(
      `GRANT ALL PRIVILEGES ON \`${cr.name}\`.* TO '${cr.user}'@'%';`
    );
    statements.push('');
  }

  statements.push('FLUSH PRIVILEGES;');
  statements.push('');
  statements.push(
    "SELECT 'Gatrix database initialization completed' AS message;"
  );

  return statements;
}

// ============================================================
// Execute SQL via mysql2
// ============================================================
async function executeSQL(statements, connectionConfig) {
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch (e) {
    console.error(
      '[ERROR] mysql2 package not found. Install it with: yarn add mysql2'
    );
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: connectionConfig.host,
    port: connectionConfig.port,
    user: connectionConfig.user,
    password: connectionConfig.password,
    multipleStatements: true,
  });

  console.log(
    `[INFO] Connected to MySQL at ${connectionConfig.host}:${connectionConfig.port}`
  );

  for (const stmt of statements) {
    // Skip comments and empty lines
    if (stmt.startsWith('--') || stmt.trim() === '') continue;

    try {
      await connection.query(stmt);
      console.log(`[OK] ${stmt.substring(0, 80)}${stmt.length > 80 ? '...' : ''}`);
    } catch (error) {
      console.error(`[ERROR] ${stmt}`);
      console.error(`        ${error.message}`);
    }
  }

  await connection.end();
  console.log('[INFO] Connection closed');
}

// ============================================================
// Main
// ============================================================
async function main() {
  const opts = parseArgs();
  const dbConfig = loadDatabaseConfig(opts);

  console.log('[INFO] Gatrix MySQL Database Initialization');
  console.log(`[INFO] Target: ${dbConfig.host}:${dbConfig.port}`);

  if (!opts.skipBackend) {
    console.log(`[INFO] Backend DB: ${dbConfig.backend.name} (user: ${dbConfig.backend.user})`);
  }
  if (!opts.skipChat) {
    console.log(`[INFO] Chat DB:    ${dbConfig.chat.name} (user: ${dbConfig.chat.user})`);
  }
  if (!opts.skipCrash) {
    console.log(`[INFO] Crash DB:   ${dbConfig.crash.name} (user: ${dbConfig.crash.user})`);
  }

  const statements = generateSQL(dbConfig, opts);

  if (opts.dryRun) {
    console.log('\n--- DRY RUN (SQL to execute) ---\n');
    console.log(statements.join('\n'));
    return;
  }

  // Prompt for root password if not provided
  if (!opts.rootPassword) {
    opts.rootPassword = await promptPassword(
      `Enter MySQL admin password for '${opts.rootUser}': `
    );
  }

  await executeSQL(statements, {
    host: dbConfig.host,
    port: dbConfig.port,
    user: opts.rootUser,
    password: opts.rootPassword,
  });

  console.log('[OK] Database initialization completed successfully');
}

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
