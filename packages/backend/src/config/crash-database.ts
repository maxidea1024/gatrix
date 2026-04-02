import mysql from 'mysql2/promise';
import { config } from './index';
import logger from './logger';

export class CrashDatabase {
  private static instance: CrashDatabase;
  private pool!: mysql.Pool;

  private constructor() {
    // Pool is created after ensureDatabase() is called
  }

  /**
   * Ensure the crash database exists, creating it if necessary.
   * Connects without a specific database to run CREATE DATABASE IF NOT EXISTS.
   */
  public static async ensureDatabase(): Promise<void> {
    const { host, port, user, password, name } = config.crashDatabase;
    let conn: mysql.Connection | undefined;
    try {
      conn = await mysql.createConnection({ host, port, user, password });
      await conn.execute(
        `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      logger.info(`Crash database '${name}' ensured`);
    } catch (error: any) {
      // If user doesn't have CREATE privilege, try to grant it or just warn
      if (error.code === 'ER_DBACCESS_DENIED_ERROR' || error.errno === 1044) {
        logger.warn(
          `Cannot create crash database '${name}' - insufficient privileges. ` +
            `Please create it manually: CREATE DATABASE IF NOT EXISTS \`${name}\``
        );
      } else {
        logger.warn(`Failed to ensure crash database '${name}':`, error);
      }
    } finally {
      if (conn) await conn.end();
    }
  }

  private initPool() {
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
      CrashDatabase.instance.initPool();
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
