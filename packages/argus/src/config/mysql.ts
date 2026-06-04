import mysql from 'mysql2/promise';
import { config } from './index';
import { createLogger } from '../utils/logger';

const logger = createLogger('mysql');

let pool: mysql.Pool | null = null;

export function getMySQLPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...config.mysql,
      timezone: '+00:00',
    });
  }

  return pool;
}

export const mysqlPool = getMySQLPool();

export async function testMySQLConnection(): Promise<boolean> {
  try {
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('MySQL connected successfully');
    return true;
  } catch (error) {
    logger.error('MySQL connection failed', { error });
    return false;
  }
}

export default mysqlPool;
