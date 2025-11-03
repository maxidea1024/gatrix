require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Determine migration directory based on environment
const getMigrationDir = () => {
  // In production Docker, migrations are in dist/database/migrations
  // In development, they are in src/database/migrations
  const distPath = path.join(__dirname, 'dist', 'database', 'migrations');
  const srcPath = path.join(__dirname, 'src', 'database', 'migrations');

  if (fs.existsSync(distPath)) {
    return distPath;
  }
  return srcPath;
};

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'gatrix_chat',
      charset: 'utf8mb4',
      timezone: 'UTC',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: getMigrationDir(),
      tableName: 'chat_migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },

  staging: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      timezone: 'UTC',
    },
    pool: {
      min: 5,
      max: 30,
    },
    migrations: {
      directory: getMigrationDir(),
      tableName: 'chat_migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },

  production: {
    client: 'mysql2',
    connection: {
      host: process.env.CHAT_DB_HOST || process.env.DB_HOST,
      port: process.env.CHAT_DB_PORT || process.env.DB_PORT || 3306,
      user: process.env.CHAT_DB_USER || process.env.DB_USER,
      password: process.env.CHAT_DB_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.CHAT_DB_NAME || 'gatrix_chat',
      charset: 'utf8mb4',
      timezone: 'UTC',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: 10,
      max: 100, // High concurrency for production
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
    },
    migrations: {
      directory: getMigrationDir(),
      tableName: 'chat_migrations',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
};
