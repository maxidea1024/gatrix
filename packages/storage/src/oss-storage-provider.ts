/**
 * Alibaba Cloud OSS Storage Provider
 */
import OSS from 'ali-oss';
import { StorageProvider, StorageFileInfo } from './storage-provider';
import { StorageLogger, defaultLogger } from './logger';

export interface OSSStorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint?: string;
  prefix?: string;
  logger?: StorageLogger;
}

export class OSSStorageProvider implements StorageProvider {
  private client: OSS;
  private prefix: string;
  private logger: StorageLogger;

  constructor(config: OSSStorageConfig) {
    this.prefix = config.prefix || '';
    this.logger = config.logger || defaultLogger;

    const ossConfig: OSS.Options = {
      bucket: config.bucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    };

    if (config.endpoint) {
      ossConfig.endpoint = config.endpoint;
    }

    this.client = new OSS(ossConfig);
  }

  async upload(key: string, data: Buffer | string, contentType?: string): Promise<string> {
    const fullKey = this.getFullKey(key);
    const body = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

    const options: Record<string, unknown> = {};
    if (contentType) {
      options.headers = { 'Content-Type': contentType };
    }

    await this.client.put(fullKey, body, options);
    this.logger.debug('File uploaded to OSS', { key: fullKey });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);
    const result = await this.client.get(fullKey);

    if (result.content instanceof Buffer) {
      return result.content;
    }
    return Buffer.from(result.content as string);
  }

  async downloadAsString(key: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const buffer = await this.download(key);
    return buffer.toString(encoding);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.client.delete(fullKey);
    this.logger.debug('File deleted from OSS', { key: fullKey });
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const files = await this.listByPrefix(prefix);
    if (files.length === 0) return 0;

    const keys = files.map(f => this.getFullKey(f.key));
    await this.client.deleteMulti(keys);

    this.logger.info('Files deleted by prefix from OSS', { prefix, deleted: files.length });
    return files.length;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    try {
      await this.client.head(fullKey);
      return true;
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string };
      if (error.status === 404 || error.code === 'NoSuchKey') {
        return false;
      }
      throw err;
    }
  }

  async listByPrefix(prefix: string, maxResults: number = 1000): Promise<StorageFileInfo[]> {
    const fullPrefix = this.getFullKey(prefix);
    const results: StorageFileInfo[] = [];
    let marker: string | undefined;

    do {
      const response = await this.client.list({
        prefix: fullPrefix,
        'max-keys': Math.min(maxResults - results.length, 1000),
        marker: marker || '',
      }, {});

      if (response.objects) {
        for (const obj of response.objects) {
          if (results.length >= maxResults) break;
          results.push({
            key: this.stripPrefix(obj.name),
            size: obj.size || 0,
            lastModified: new Date(obj.lastModified),
          });
        }
      }

      marker = response.isTruncated ? response.nextMarker : undefined;
    } while (marker && results.length < maxResults);

    return results;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    return this.client.signatureUrl(fullKey, {
      expires: expiresIn,
      method: 'GET',
    });
  }

  async getSignedUploadUrl(key: string, contentType?: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    const options: Record<string, unknown> = {
      expires: expiresIn,
      method: 'PUT',
    };
    if (contentType) {
      options['content-type'] = contentType;
    }
    return this.client.signatureUrl(fullKey, options);
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
