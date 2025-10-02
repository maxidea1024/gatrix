import knex from 'knex';
import { Model } from 'objection';
import dotenv from 'dotenv';
import { config } from './index';

dotenv.config();

const knexConfig = {
  client: 'mysql2',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    charset: 'utf8mb4',
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
};

// Knex 인스턴스 생성
const db = knex(knexConfig);

// Objection.js 초기화
Model.knex(db);

export default db;
export { knexConfig };
