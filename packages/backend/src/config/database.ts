import mysql from 'mysql2/promise';
import { config } from './index';
import logger from './logger';

export class Database {
  private static instance: Database;
  private pool: mysql.Pool;

  private constructor() {
    this.pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      supportBigNumbers: true,
      bigNumberStrings: false,
      decimalNumbers: true,
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getPool(): mysql.Pool {
    return this.pool;
  }

  public async query(sql: string, params?: any[]): Promise<any> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error: any) {
      // Don't log migrations table not found errors as they are handled gracefully
      const isMigrationsTableError =
        error.code === 'ER_NO_SUCH_TABLE' &&
        error.sqlMessage?.includes('migrations') &&
        sql.includes('migrations');

      if (!isMigrationsTableError) {
        logger.error('Database query error:', error);
      }
      throw error;
    }
  }

  public async transaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      logger.error('Transaction error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.pool.execute('SELECT 1');
      logger.info('Database connection successful');
      return true;
    } catch (error) {
      logger.error('Database connection failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

export default Database.getInstance();
