import knex, { Knex } from "knex";
import path from "path";
import fs from "fs";
import { config } from "./index";
import { createLogger } from "./logger";

const logger = createLogger("DatabaseManager");

// Determine migration directory based on environment
const getMigrationDir = (): string => {
  // In production Docker, migrations are in dist/database/migrations
  // In development, they are in src/database/migrations
  // __dirname points to dist/config when compiled
  const distPath = path.join(__dirname, "..", "database", "migrations");

  if (fs.existsSync(distPath)) {
    return distPath;
  }

  // Fallback to src directory (for development)
  const srcPath = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "database",
    "migrations",
  );
  return srcPath;
};

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
      // First, create database if it doesn't exist
      await this.createDatabaseIfNotExists();

      const knexConfig: Knex.Config = {
        client: "mysql2",
        connection: {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.name,
          charset: "utf8mb4",
          timezone: "+00:00", // MySQL2?먯꽌 ?щ컮瑜?UTC ??꾩〈 ?뺤떇
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
          directory: getMigrationDir(),
          tableName: "chat_migrations",
        },
        seeds: {
          directory: "./seeds",
        },
        debug: config.database.debug, // .env??DB_DEBUG ?ㅼ젙?쇰줈 ?쒖뼱
        asyncStackTraces: config.isDevelopment,
      };

      this.knexInstance = knex(knexConfig);

      // Test connection
      await this.testConnection();
      logger.info("Database connection established successfully");

      // Run migrations automatically
      try {
        logger.info("Running database migrations...");
        const [executed] = await this.knexInstance.migrate.latest();
        if (executed.length > 0) {
          logger.info(`Executed ${executed.length} migrations:`, executed);
        } else {
          logger.info("No pending migrations");
        }
      } catch (error) {
        logger.error("Migration failed:", error);
        throw error;
      }
    } catch (error) {
      logger.error("Failed to initialize database:", error);
      throw error;
    }
  }

  private async createDatabaseIfNotExists(): Promise<void> {
    try {
      // Create a temporary connection without specifying database
      const tempKnex = knex({
        client: "mysql2",
        connection: {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          charset: "utf8mb4",
        },
      });

      try {
        // Create database if not exists
        await tempKnex.raw(
          `CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
          [config.database.name],
        );
        logger.info(
          `Database '${config.database.name}' created or already exists`,
        );
      } finally {
        await tempKnex.destroy();
      }
    } catch (error) {
      logger.error("Failed to create database:", error);
      throw error;
    }
  }

  public getKnex(): Knex {
    if (!this.knexInstance) {
      throw new Error("Database not initialized");
    }
    return this.knexInstance;
  }

  public async testConnection(): Promise<boolean> {
    try {
      if (!this.knexInstance) {
        throw new Error("Database not initialized");
      }

      // Use a timeout for the test query
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection test timeout")), 10000); // Increased to 10s
      });

      const testPromise = this.knexInstance.raw("SELECT 1");

      await Promise.race([testPromise, timeoutPromise]);
      return true;
    } catch (error) {
      logger.error("Database connection test failed:", error);
      throw error; // Throw exception to stop server startup on failure
    }
  }

  public getDatabase(): Knex {
    if (!this.knexInstance) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.knexInstance;
  }

  public async close(): Promise<void> {
    if (this.knexInstance) {
      await this.knexInstance.destroy();
      this.knexInstance = null;
      logger.info("Database connection closed");
    }
  }

  // High-performance query helpers
  public async batchInsert<T extends Record<string, any>>(
    tableName: string,
    data: T[],
    batchSize = 1000,
  ): Promise<void> {
    if (!this.knexInstance) {
      throw new Error("Database not initialized");
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
    batchSize = 100,
  ): Promise<void> {
    if (!this.knexInstance) {
      throw new Error("Database not initialized");
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
