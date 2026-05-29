import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(
    process.env.ARGUS_API_PORT || '45300',
    10
  ),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // ClickHouse
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
    database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.ARGUS_REDIS_DB || '2', 10),
  },

  // MySQL
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    database: process.env.MYSQL_DATABASE || 'gatrix',
    user: process.env.MYSQL_USER || 'gatrix_user',
    password: process.env.MYSQL_PASSWORD || 'gatrix_password',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },

  // MinIO / S3 Compatible Storage
  storage: {
    endpoint: process.env.ARGUS_STORAGE_ENDPOINT || 'http://localhost:9000',
    bucket: process.env.ARGUS_STORAGE_BUCKET || 'argus-storage',
    accessKey: process.env.ARGUS_STORAGE_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.ARGUS_STORAGE_SECRET_KEY || 'minioadmin',
    region: process.env.ARGUS_STORAGE_REGION || 'us-east-1',
    forcePathStyle:
      process.env.ARGUS_STORAGE_FORCE_PATH_STYLE !== 'false', // MinIO needs true
  },

  // Worker
  worker: {
    errorBatchSize: parseInt(
      process.env.ARGUS_WORKER_ERROR_BATCH_SIZE || '100',
      10
    ),
    transactionBatchSize: parseInt(
      process.env.ARGUS_WORKER_TXN_BATCH_SIZE || '200',
      10
    ),
    sessionBatchSize: parseInt(
      process.env.ARGUS_WORKER_SESSION_BATCH_SIZE || '500',
      10
    ),
    concurrency: parseInt(
      process.env.ARGUS_WORKER_CONCURRENCY || '5',
      10
    ),
  },

  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.ARGUS_RATE_LIMIT_MAX || '1000', 10),
    timeWindow: parseInt(
      process.env.ARGUS_RATE_LIMIT_WINDOW || '60000',
      10
    ),
  },

  // GeoIP
  geoip: {
    databasePath:
      process.env.GEOIP_DATABASE_PATH || './data/GeoLite2-City.mmdb',
  },

  // Retention
  retention: {
    errorDays: parseInt(process.env.ARGUS_RETENTION_ERROR_DAYS || '90', 10),
    transactionDays: parseInt(
      process.env.ARGUS_RETENTION_TXN_DAYS || '90',
      10
    ),
    sessionDays: parseInt(
      process.env.ARGUS_RETENTION_SESSION_DAYS || '90',
      10
    ),
    metricDays: parseInt(
      process.env.ARGUS_RETENTION_METRIC_DAYS || '90',
      10
    ),
  },
};

export default config;
