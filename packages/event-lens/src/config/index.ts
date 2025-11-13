import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '5200', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // ClickHouse
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
    database: process.env.CLICKHOUSE_DATABASE || 'event_lens',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
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

  // Worker
  worker: {
    batchSize: parseInt(process.env.WORKER_BATCH_SIZE || '1000', 10),
    batchTimeout: parseInt(process.env.WORKER_BATCH_TIMEOUT || '5000', 10),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
  },

  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
  },

  // GeoIP
  geoip: {
    databasePath: process.env.GEOIP_DATABASE_PATH || './data/GeoLite2-City.mmdb',
  },

  // Monitoring
  monitoring: {
    enabled: String(process.env.MONITORING_ENABLED || '').toLowerCase() === 'true',
    metricsPath: process.env.METRICS_PATH || '/metrics',
  },
};

export default config;

