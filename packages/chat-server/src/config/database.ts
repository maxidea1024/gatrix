import knex, { Knex } from 'knex';
import { config } from './index';
import { createLogger } from './logger';

const logger = createLogger('DatabaseManager');

class DatabaseManager {
  private static instance: DatabaseManager;
  private knexInstance: Knex | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const knexConfig: Knex.Config = {
        client: 'mysql2',
        connection: {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.name,
          charset: 'utf8mb4',
          timezone: '+00:00', // MySQL2에서 올바른 UTC 타임존 형식
        },
        pool: {
          min: 2,
          max: 10, // Reduced for development
          acquireTimeoutMillis: 10000,
          createTimeoutMillis: 10000,
          destroyTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 100,
          propagateCreateError: false,
        },
        migrations: {
          directory: './migrations',
          tableName: 'chat_migrations',
        },
        seeds: {
          directory: './seeds',
        },
        debug: false, // SQL 로그 출력 비활성화
        asyncStackTraces: config.isDevelopment,
      };

      this.knexInstance = knex(knexConfig);

      // Test connection
      await this.testConnection();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  public getKnex(): Knex {
    if (!this.knexInstance) {
      throw new Error('Database not initialized');
    }
    return this.knexInstance;
  }

  public async testConnection(): Promise<boolean> {
    try {
      if (!this.knexInstance) {
        throw new Error('Database not initialized');
      }

      // Use a timeout for the test query
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout')), 5000);
      });

      const testPromise = this.knexInstance.raw('SELECT 1');

      await Promise.race([testPromise, timeoutPromise]);
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error; // 실패 시 예외를 던져서 서버 시작을 중단
    }
  }

  public async close(): Promise<void> {
    if (this.knexInstance) {
      await this.knexInstance.destroy();
      this.knexInstance = null;
      logger.info('Database connection closed');
    }
  }

  // High-performance query helpers
  public async batchInsert<T extends Record<string, any>>(tableName: string, data: T[], batchSize = 1000): Promise<void> {
    if (!this.knexInstance) {
      throw new Error('Database not initialized');
    }

    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await this.knexInstance.batchInsert(tableName, batch as any, batchSize);
    }
  }

  public async batchUpdate<T>(
    tableName: string,
    updates: Array<{ where: any; update: T }>,
    batchSize = 100
  ): Promise<void> {
    if (!this.knexInstance) {
      throw new Error('Database not initialized');
    }

    const batches = [];
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const trx = await this.knexInstance.transaction();
      try {
        for (const { where, update } of batch) {
          await trx(tableName).where(where).update(update);
        }
        await trx.commit();
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    }
  }
}

export const databaseManager = DatabaseManager.getInstance();
export default databaseManager;
