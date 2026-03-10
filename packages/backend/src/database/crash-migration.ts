import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger';
import crashDatabase from '../config/crash-database';

export interface CrashMigrationFile {
  id: string;
  name: string;
  filename: string;
  up: (connection: mysql.PoolConnection) => Promise<void>;
  down: (connection: mysql.PoolConnection) => Promise<void>;
}

export class CrashMigration {
  private migrationsPath: string;
  private lockName: string = 'gatrix_crash_migration_lock';
  private lockTimeout: number = 300; // 5 minutes in seconds

  constructor() {
    this.migrationsPath = path.join(__dirname, 'crash-migrations');
  }

  /**
   * Acquire a distributed lock using MySQL GET_LOCK()
   */
  private async acquireLock(
    connection: mysql.PoolConnection
  ): Promise<boolean> {
    try {
      const [rows] = (await connection.query(
        'SELECT GET_LOCK(?, ?) as lockResult',
        [this.lockName, this.lockTimeout]
      )) as any;

      const lockResult = rows[0]?.lockResult;

      if (lockResult === 1) {
        logger.info('Crash migration lock acquired successfully', {
          lockName: this.lockName,
          timeout: this.lockTimeout,
        });
        return true;
      } else if (lockResult === 0) {
        logger.warn(
          'Failed to acquire crash migration lock - another process is running migrations',
          {
            lockName: this.lockName,
            timeout: this.lockTimeout,
          }
        );
        return false;
      } else {
        logger.error('Error acquiring crash migration lock - NULL returned', {
          lockName: this.lockName,
        });
        return false;
      }
    } catch (error) {
      logger.error('Exception while acquiring crash migration lock:', error);
      return false;
    }
  }

  /**
   * Release the distributed lock using MySQL RELEASE_LOCK()
   */
  private async releaseLock(connection: mysql.PoolConnection): Promise<void> {
    try {
      const [rows] = (await connection.query(
        'SELECT RELEASE_LOCK(?) as releaseResult',
        [this.lockName]
      )) as any;

      const releaseResult = rows[0]?.releaseResult;

      if (releaseResult === 1) {
        logger.info('Crash migration lock released successfully', {
          lockName: this.lockName,
        });
      } else if (releaseResult === 0) {
        logger.warn('Lock was not established by this thread', {
          lockName: this.lockName,
        });
      } else {
        logger.warn('Lock does not exist', {
          lockName: this.lockName,
        });
      }
    } catch (error) {
      logger.error('Exception while releasing crash migration lock:', error);
    }
  }

  async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS g_crash_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await crashDatabase.query(sql);
    logger.info('Crash migrations table created or already exists');
  }

  async getExecutedMigrations(): Promise<string[]> {
    try {
      const rows = await crashDatabase.query(
        'SELECT id FROM g_crash_migrations ORDER BY executedAt ASC'
      );
      return rows.map((row: any) => row.id);
    } catch (error: any) {
      if (
        error.code === 'ER_NO_SUCH_TABLE' &&
        error.sqlMessage?.includes('g_crash_migrations')
      ) {
        logger.info(
          'Crash migrations table not found - this is normal for first-time setup'
        );
        return [];
      }
      logger.error('Error getting executed crash migrations:', error);
      return [];
    }
  }

  async getMigrationFiles(): Promise<CrashMigrationFile[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles: CrashMigrationFile[] = [];

      for (const file of files) {
        if (file.endsWith('.js')) {
          const filePath = path.join(this.migrationsPath, file);
          const migration = require(filePath);

          const id = file.replace(/\.js$/, '');
          migrationFiles.push({
            id,
            name: migration.name || id,
            filename: file,
            up: migration.up,
            down: migration.down,
          });
        }
      }

      return migrationFiles.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      logger.error('Error reading crash migration files:', error);
      return [];
    }
  }

  async runMigrations(): Promise<void> {
    const lockConnection = await crashDatabase.getPool().getConnection();

    try {
      const lockAcquired = await this.acquireLock(lockConnection);

      if (!lockAcquired) {
        logger.info(
          'Skipping crash migrations - another process is already running them'
        );
        return;
      }

      try {
        await this.createMigrationsTable();

        const executedMigrations = await this.getExecutedMigrations();
        const migrationFiles = await this.getMigrationFiles();

        const pendingMigrations = migrationFiles.filter(
          (migration) => !executedMigrations.includes(migration.id)
        );

        if (pendingMigrations.length === 0) {
          logger.info('No pending crash migrations');
          return;
        }

        logger.info(`Found ${pendingMigrations.length} pending crash migrations:`, {
          migrations: pendingMigrations.map((m) => m.id),
        });
        logger.info(`Running ${pendingMigrations.length} pending crash migrations`);

        for (const migration of pendingMigrations) {
          await this.runMigration(migration);
        }

        logger.info('All crash migrations completed successfully');
      } finally {
        await this.releaseLock(lockConnection);
      }
    } catch (error) {
      logger.error('Error running crash migrations:', error);
      throw error;
    } finally {
      lockConnection.release();
    }
  }

  async runMigration(migration: CrashMigrationFile): Promise<void> {
    const connection = await crashDatabase.getPool().getConnection();

    try {
      await connection.beginTransaction();

      logger.info(`Running crash migration: ${migration.name}`);
      await migration.up(connection);

      await connection.execute(
        'INSERT INTO g_crash_migrations (id, name) VALUES (?, ?)',
        [migration.id, migration.name]
      );

      await connection.commit();
      logger.info(`Crash migration completed: ${migration.name}`);
    } catch (error) {
      await connection.rollback();
      logger.error(`Crash migration failed: ${migration.name}`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async rollbackMigration(migrationId: string): Promise<void> {
    const connection = await crashDatabase.getPool().getConnection();

    try {
      const migrationFiles = await this.getMigrationFiles();
      const migration = migrationFiles.find((m) => m.id === migrationId);

      if (!migration) {
        throw new Error(`Crash migration not found: ${migrationId}`);
      }

      await connection.beginTransaction();

      logger.info(`Rolling back crash migration: ${migration.name}`);
      await migration.down(connection);

      await connection.execute('DELETE FROM g_crash_migrations WHERE id = ?', [
        migrationId,
      ]);

      await connection.commit();
      logger.info(`Crash migration rolled back: ${migration.name}`);
    } catch (error) {
      await connection.rollback();
      logger.error(`Crash migration rollback failed: ${migrationId}`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async getStatus(): Promise<{ executed: string[]; pending: string[] }> {
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    const allMigrations = migrationFiles.map((m) => m.id);
    const pendingMigrations = allMigrations.filter(
      (id) => !executedMigrations.includes(id)
    );

    return {
      executed: executedMigrations,
      pending: pendingMigrations,
    };
  }
}

export default new CrashMigration();
