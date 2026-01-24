import knex from 'knex';
import { Model } from 'objection';
import dotenv from 'dotenv';
import { config } from './index';

dotenv.config();

// Helper function to convert MySQL BIT/TINYINT to boolean and Date to ISO string
const convertBitToBoolean = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(convertBitToBoolean);
  }

  // Convert Date objects to UTC ISO string
  // mysql2 returns DATETIME as Date interpreted as local time, but DB stores UTC
  // So we extract local time components and format them as UTC
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Skip Buffer objects
  if (obj instanceof Buffer) {
    return obj;
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert boolean field names from 0/1 to true/false
      // Pattern: fields starting with 'is' or other known boolean fields
      const isBooleanField = key.startsWith('is') ||
        key === 'supportsMultiLanguage' || key === 'emailVerified' ||
        key === 'showOnce' || key.endsWith('Inverted') ||
        key === 'allowAllEnvironments' || key === 'requiresApproval';
      if (isBooleanField && (value === 0 || value === 1)) {
        converted[key] = value === 1;
      } else if (value instanceof Buffer) {
        // Preserve Buffer objects as-is
        converted[key] = value;
      } else if (value instanceof Date) {
        // Convert Date to UTC ISO string with error handling
        if (isNaN(value.getTime())) {
          console.warn(`[knex] Invalid Date for key ${key}:`, value);
          converted[key] = null;
        } else {
          converted[key] = value.toISOString();
        }
      } else if (typeof value === 'object') {
        converted[key] = convertBitToBoolean(value);
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }

  return obj;
};

const knexConfig = {
  client: 'mysql2',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    charset: 'utf8mb4',
    timezone: 'Z',
  },
  debug: config.database.debug, // .env의 DB_DEBUG 설정으로 제어
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
  postProcessResponse: (result: any) => {
    return convertBitToBoolean(result);
  },
};

// Knex 인스턴스 생성
const db = knex(knexConfig);

// Objection.js 초기화
Model.knex(db);

export default db;
export { knexConfig };
