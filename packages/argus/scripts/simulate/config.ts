/**
 * Simulate Data — Shared Configuration
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// ═══════════════════ DB CONFIG ═══════════════════

export const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  database: process.env.MYSQL_DATABASE || 'gatrix',
  user: process.env.MYSQL_USER || 'gatrix_user',
  password: process.env.MYSQL_PASSWORD || 'gatrix_password',
};

export const CH_CONFIG = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

// ═══════════════════ SCALE CONSTANTS ═══════════════════

export const PROJECT_ID = '01KVVVJEGKQ10X59AZW7P0ASCH';
export const DAYS_BACK = 14;
export const NOW = new Date();

export const TOTAL_ERROR_EVENTS = 600_000;
export const TOTAL_TRANSACTIONS = 400_000;
export const TOTAL_SESSIONS = 200_000;
export const TOTAL_FEEDBACK = 5_000;
export const USER_POOL_SIZE = 40_000;
export const CHUNK_SIZE = 5_000;
