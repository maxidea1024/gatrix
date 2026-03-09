import mysql from 'mysql2/promise';
import { config } from './index';
import logger from './logger';

export class CrashDatabase {
  private static instance: CrashDatabase;
  private pool: mysql.Pool;

  private constructor() {
    this.pool = mysql.createPool({
      host: config.crashDatabase.host,
      port: config.crashDatabase.port,
      user: config.crashDatabase.user,
      password: config.crashDatabase.password,
      database: config.crashDatabase.name,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      supportBigNumbers: true,
      bigNumberStrings: false,
      decimalNumbers: true,
    });
  }

  public static getInstance(): CrashDatabase {
    if (!CrashDatabase.instance) {
      CrashDatabase.instance = new CrashDatabase();
    }
    return CrashDatabase.instance;
  }

  public getPool(): mysql.Pool {
    return this.pool;
  }

  public async query(sql: string, params?: any[]): Promise<any> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error: any) {
      const isMigrationsTableError =
        error.code === 'ER_NO_SUCH_TABLE' &&
        error.sqlMessage?.includes('migrations') &&
        sql.includes('migrations');

      if (!isMigrationsTableError) {
        logger.error('Crash database query error:', error);
      }
      throw error;
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.pool.execute('SELECT 1');
      logger.info('Crash database connection successful');
      return true;
    } catch (error) {
      logger.error('Crash database connection failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('Crash database connection pool closed');
  }
}

export default CrashDatabase.getInstance();
