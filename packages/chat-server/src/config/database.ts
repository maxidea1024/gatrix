import knex, { Knex } from 'knex';
import { config } from './index';
import logger from './logger';

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
          timezone: 'UTC',
        },
        pool: {
          min: 5,
          max: 50, // High concurrency pool
          acquireTimeoutMillis: 30000,
          createTimeoutMillis: 30000,
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
        debug: config.isDevelopment,
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
      await this.knexInstance.raw('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
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
  public async batchInsert<T>(tableName: string, data: T[], batchSize = 1000): Promise<void> {
    if (!this.knexInstance) {
      throw new Error('Database not initialized');
    }

    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await this.knexInstance.batchInsert(tableName, batch, batchSize);
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
