/**
 * Google Cloud Storage Provider
 */
import { Storage, Bucket } from '@google-cloud/storage';
import { StorageProvider, StorageFileInfo } from './storage-provider';
import { StorageLogger, defaultLogger } from './logger';

export interface GCSStorageConfig {
  bucket: string;
  projectId?: string;
  keyFilePath?: string;
  prefix?: string;
  logger?: StorageLogger;
}

export class GCSStorageProvider implements StorageProvider {
  private bucket: Bucket;
  private prefix: string;
  private logger: StorageLogger;

  constructor(config: GCSStorageConfig) {
    this.prefix = config.prefix || '';
    this.logger = config.logger || defaultLogger;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storageOptions: any = {};
    if (config.projectId) {
      storageOptions.projectId = config.projectId;
    }
    if (config.keyFilePath) {
      storageOptions.keyFilename = config.keyFilePath;
    }

    const storage = new Storage(storageOptions);
    this.bucket = storage.bucket(config.bucket);
  }

  async upload(
    key: string,
    data: Buffer | string,
    contentType?: string
  ): Promise<string> {
    const fullKey = this.getFullKey(key);
    const body = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const file = this.bucket.file(fullKey);

    await file.save(body, {
      contentType: contentType || 'application/octet-stream',
      resumable: false,
    });

    this.logger.debug('File uploaded to GCS', { key: fullKey });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);
    const file = this.bucket.file(fullKey);
    const [content] = await file.download();
    return content;
  }

  async downloadAsString(
    key: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<string> {
    const buffer = await this.download(key);
    return buffer.toString(encoding);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    const file = this.bucket.file(fullKey);
    try {
      await file.delete();
      this.logger.debug('File deleted from GCS', { key: fullKey });
    } catch (err: unknown) {
      if ((err as { code?: number }).code !== 404) {
        throw err;
      }
    }
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const fullPrefix = this.getFullKey(prefix);
    const [files] = await this.bucket.getFiles({ prefix: fullPrefix });

    let deleted = 0;
    for (const file of files) {
      try {
        await file.delete();
        deleted++;
      } catch (err: unknown) {
        this.logger.warn('Failed to delete file from GCS', {
          key: file.name,
          error: String(err),
        });
      }
    }

    this.logger.info('Files deleted by prefix from GCS', { prefix, deleted });
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const file = this.bucket.file(fullKey);
    const [exists] = await file.exists();
    return exists;
  }

  async listByPrefix(
    prefix: string,
    maxResults: number = 1000
  ): Promise<StorageFileInfo[]> {
    const fullPrefix = this.getFullKey(prefix);
    const [files] = await this.bucket.getFiles({
      prefix: fullPrefix,
      maxResults,
    });

    return files.map((file) => ({
      key: this.stripPrefix(file.name),
      size: parseInt(file.metadata.size as string, 10) || 0,
      lastModified: new Date(file.metadata.updated as string),
    }));
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    const file = this.bucket.file(fullKey);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });

    return url;
  }

  async getSignedUploadUrl(
    key: string,
    contentType?: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const fullKey = this.getFullKey(key);
    const file = this.bucket.file(fullKey);

    const [url] = await file.getSignedUrl({
      action: 'write',
      expires: Date.now() + expiresIn * 1000,
      contentType: contentType || 'application/octet-stream',
    });

    return url;
  }

  private getFullKey(key: string): string {
    if (this.prefix) {
      return `${this.prefix}/${key}`.replace(/\/+/g, '/');
    }
    return key;
  }

  private stripPrefix(fullKey: string): string {
    if (this.prefix && fullKey.startsWith(this.prefix)) {
      return fullKey.substring(this.prefix.length).replace(/^\//, '');
    }
    return fullKey;
  }
}
