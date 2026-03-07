import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger';

/**
 * Interface for persisting cached data to a non-volatile storage.
 */
export interface CacheStorageProvider {
  save(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

/**
 * Basic file-based implementation of CacheStorageProvider.
 */
export class FileCacheStorageProvider implements CacheStorageProvider {
  private storageDir: string;

  constructor(
    private logger: Logger,
    storagePath?: string
  ) {
    this.storageDir = storagePath || path.join(process.cwd(), '.gatrix_cache');
    this.initDir();
  }

  private async initDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error: any) {
      this.logger.error('Failed to initialize cache storage directory', {
        path: this.storageDir,
        error: error.message,
      });
    }
  }

  async save(key: string, value: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.writeFile(filePath, value, 'utf8');
    } catch (error: any) {
      this.logger.error(`Failed to save cache key ${key} to file`, { error: error.message });
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(key);
      if (!(await this.exists(key))) return null;
      return await fs.readFile(filePath, 'utf8');
    } catch (error: any) {
      this.logger.error(`Failed to read cache key ${key} from file`, { error: error.message });
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.getFilePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      if (await this.exists(key)) {
        await fs.unlink(filePath);
      }
    } catch (error: any) {
      this.logger.error(`Failed to remove cache key ${key}`, { error: error.message });
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for filename
    const safeKey = key.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return path.join(this.storageDir, `${safeKey}.cache`);
  }
}
