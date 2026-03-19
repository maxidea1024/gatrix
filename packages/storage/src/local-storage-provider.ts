/**
 * Local File System Storage Provider
 */
import fs from 'fs/promises';
import path from 'path';
import { StorageProvider, StorageFileInfo } from './storage-provider';
import { StorageLogger, defaultLogger } from './logger';

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;
  private apiBaseUrl: string;
  private logger: StorageLogger;

  constructor(basePath: string, apiBaseUrl?: string, logger?: StorageLogger) {
    this.basePath = basePath;
    this.apiBaseUrl = apiBaseUrl || '/api/v1/admin/file-storage';
    this.logger = logger || defaultLogger;
  }

  async upload(key: string, data: Buffer | string, _contentType?: string): Promise<string> {
    const filePath = this.getFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    this.logger.debug('File uploaded locally', { key });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    return await fs.readFile(filePath);
  }

  async downloadAsString(key: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const filePath = this.getFilePath(key);
    return await fs.readFile(filePath, encoding);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);
      this.logger.debug('File deleted locally', { key });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const files = await this.listByPrefix(prefix);
    let deleted = 0;
    for (const file of files) {
      try {
        await this.delete(file.key);
        deleted++;
      } catch (err: unknown) {
        this.logger.warn('Failed to delete file during prefix cleanup', { key: file.key, error: String(err) });
      }
    }
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listByPrefix(prefix: string, maxResults: number = 1000): Promise<StorageFileInfo[]> {
    const dirPath = path.join(this.basePath, prefix);
    const results: StorageFileInfo[] = [];

    try {
      await this.walkDirectory(dirPath, prefix, results, maxResults);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    return results;
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    return `${this.apiBaseUrl}/download?key=${encodeURIComponent(key)}`;
  }

  async getSignedUploadUrl(key: string, _contentType?: string, _expiresIn?: number): Promise<string> {
    return `${this.apiBaseUrl}/upload?key=${encodeURIComponent(key)}`;
  }

  private getFilePath(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.basePath, normalized);
  }

  private async walkDirectory(
    dirPath: string,
    prefix: string,
    results: StorageFileInfo[],
    maxResults: number
  ): Promise<void> {
    if (results.length >= maxResults) return;

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subPrefix = prefix.endsWith('/')
          ? `${prefix}${entry.name}/`
          : `${prefix}/${entry.name}/`;
        await this.walkDirectory(fullPath, subPrefix, results, maxResults);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        const key = prefix.endsWith('/')
          ? `${prefix}${entry.name}`
          : `${prefix}/${entry.name}`;
        results.push({
          key,
          size: stat.size,
          lastModified: stat.mtime,
        });
      }
    }
  }
}
