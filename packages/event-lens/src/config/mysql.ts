import mysql from 'mysql2/promise';
import { config } from './index';
import logger from '../utils/logger';

let pool: mysql.Pool | null = null;

export function getMySQLPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(config.mysql);

    // Note: mysql2/promise Pool doesn't have 'connection' or 'error' events
    // Error handling is done through try/catch in queries
  }

  return pool;
}

export const mysqlPool = getMySQLPool();

// 연결 테스트
export async function testMySQLConnection(): Promise<boolean> {
  try {
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('✅ MySQL connected successfully');
    return true;
  } catch (error) {
    logger.error('❌ MySQL connection failed', { error });
    return false;
  }
}

export default mysqlPool;
