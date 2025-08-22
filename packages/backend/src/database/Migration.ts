import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger';
import database from '../config/database';

export interface MigrationFile {
  id: string;
  name: string;
  filename: string;
  up: (connection: mysql.PoolConnection) => Promise<void>;
  down: (connection: mysql.PoolConnection) => Promise<void>;
}

export class Migration {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS g_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await database.query(sql);
    logger.info('Migrations table created or already exists');
  }

  async getExecutedMigrations(): Promise<string[]> {
    try {
      const rows = await database.query('SELECT id FROM g_migrations ORDER BY executedAt ASC');
      return rows.map((row: any) => row.id);
    } catch (error: any) {
      // Check if the error is specifically about migrations table not existing
      if (error.code === 'ER_NO_SUCH_TABLE' && error.sqlMessage?.includes('g_migrations')) {
        logger.info('Migrations table not found - this is normal for first-time setup');
        return [];
      }
      // For other errors, still log as error
      logger.error('Error getting executed migrations:', error);
      return [];
    }
  }

  async getMigrationFiles(): Promise<MigrationFile[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles: MigrationFile[] = [];

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
      logger.error('Error reading migration files:', error);
      return [];
    }
  }

  async runMigrations(): Promise<void> {
    try {
      await this.createMigrationsTable();
      
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = await this.getMigrationFiles();
      
      const pendingMigrations = migrationFiles.filter(
        migration => !executedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Running ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Error running migrations:', error);
      throw error;
    }
  }

  async runMigration(migration: MigrationFile): Promise<void> {
    const connection = await database.getPool().getConnection();
    
    try {
      await connection.beginTransaction();
      
      logger.info(`Running migration: ${migration.name}`);
      await migration.up(connection);
      
      await connection.execute(
        'INSERT INTO g_migrations (id, name) VALUES (?, ?)',
        [migration.id, migration.name]
      );
      
      await connection.commit();
      logger.info(`Migration completed: ${migration.name}`);
    } catch (error) {
      await connection.rollback();
      logger.error(`Migration failed: ${migration.name}`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async rollbackMigration(migrationId: string): Promise<void> {
    const connection = await database.getPool().getConnection();
    
    try {
      const migrationFiles = await this.getMigrationFiles();
      const migration = migrationFiles.find(m => m.id === migrationId);
      
      if (!migration) {
        throw new Error(`Migration not found: ${migrationId}`);
      }

      await connection.beginTransaction();
      
      logger.info(`Rolling back migration: ${migration.name}`);
      await migration.down(connection);
      
      await connection.execute('DELETE FROM g_migrations WHERE id = ?', [migrationId]);
      
      await connection.commit();
      logger.info(`Migration rolled back: ${migration.name}`);
    } catch (error) {
      await connection.rollback();
      logger.error(`Migration rollback failed: ${migrationId}`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async getStatus(): Promise<{ executed: string[], pending: string[] }> {
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    const allMigrations = migrationFiles.map(m => m.id);
    const pendingMigrations = allMigrations.filter(id => !executedMigrations.includes(id));

    return {
      executed: executedMigrations,
      pending: pendingMigrations,
    };
  }
}

export default new Migration();
