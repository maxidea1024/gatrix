import knex from 'knex';
import { config } from './index';
import { createLogger } from '../utils/logger';

const logger = createLogger('knex');

const knexConfig = {
  client: 'mysql2',
  connection: {
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    charset: 'utf8mb4',
    timezone: 'Z',
  },
  pool: {
    min: 2,
    max: config.mysql.connectionLimit || 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  // Convert Date objects to ISO strings in query results
  // Note: db.raw() returns [rows, fields] from mysql2 driver.
  // We must NOT process the fields array, only the rows.
  postProcessResponse: (result: any) => {
    if (result === null || result === undefined) return result;
    // Detect db.raw() tuple: [RowDataPacket[], FieldPacket[]]
    // FieldPacket objects have a 'columnLength' property that normal row objects don't
    if (
      Array.isArray(result) &&
      result.length === 2 &&
      Array.isArray(result[0]) &&
      Array.isArray(result[1]) &&
      result[1][0]?.constructor?.name?.includes('ColumnDefinition')
    ) {
      // Only process the rows, leave fields untouched
      return [result[0].map(convertRow), result[1]];
    }
    if (Array.isArray(result)) return result.map(convertRow);
    if (typeof result === 'object' && !(result instanceof Buffer))
      return convertRow(result);
    return result;
  },
  log: {
    warn(msg: string) {
      logger.warn(msg);
    },
    error(msg: string) {
      logger.error(msg);
    },
    deprecate(msg: string) {
      logger.warn(`[DEPRECATED] ${msg}`);
    },
    debug(msg: string) {
      logger.debug(msg);
    },
  },
};

/**
 * Convert Date objects in a row to ISO strings for JSON serialisation.
 */
function convertRow(row: any): any {
  if (row === null || row === undefined) return row;
  if (row instanceof Date) return row.toISOString();
  if (row instanceof Buffer) return row;

  if (typeof row === 'object') {
    const out: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) {
        out[key] = isNaN(value.getTime()) ? null : value.toISOString();
      } else if (value instanceof Buffer) {
        out[key] = value;
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return row;
}

const db = knex(knexConfig);

export default db;
export { knexConfig };
