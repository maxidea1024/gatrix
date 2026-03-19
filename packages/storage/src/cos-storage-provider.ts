/**
 * Tencent COS Storage Provider
 */
import COS from 'cos-nodejs-sdk-v5';
import { StorageProvider, StorageFileInfo } from './storage-provider';
import { StorageLogger, defaultLogger } from './logger';

export interface COSStorageConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  prefix?: string;
  logger?: StorageLogger;
}

export class COSStorageProvider implements StorageProvider {
  private client: COS;
  private bucket: string;
  private region: string;
  private prefix: string;
  private logger: StorageLogger;

  constructor(config: COSStorageConfig) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.prefix = config.prefix || '';
    this.logger = config.logger || defaultLogger;

    this.client = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    });
  }

  async upload(key: string, data: Buffer | string, contentType?: string): Promise<string> {
    const fullKey = this.getFullKey(key);
    const body = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

    await this.client.putObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: fullKey,
      Body: body,
      ContentType: (contentType || 'application/octet-stream') as string,
    });

    this.logger.debug('File uploaded to COS', { key: fullKey });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);
    const result = await this.client.getObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: fullKey,
    });

    if (result.Body instanceof Buffer) {
      return result.Body;
    }
    return Buffer.from(result.Body as unknown as string, 'utf8');
  }

  async downloadAsString(key: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const buffer = await this.download(key);
    return buffer.toString(encoding);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.client.deleteObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: fullKey,
    });
    this.logger.debug('File deleted from COS', { key: fullKey });
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const files = await this.listByPrefix(prefix);
    if (files.length === 0) return 0;

    const objects = files.map(f => ({ Key: this.getFullKey(f.key) }));
    await this.client.deleteMultipleObject({
      Bucket: this.bucket,
      Region: this.region,
      Objects: objects,
    });

    this.logger.info('Files deleted by prefix from COS', { prefix, deleted: files.length });
    return files.length;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    try {
      await this.client.headObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: fullKey,
      });
      return true;
    } catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 404) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await this.client.getBucket({
        Bucket: this.bucket,
        Region: this.region,
        Prefix: fullPrefix,
        MaxKeys: Math.min(maxResults - results.length, 1000),
        Marker: marker || '',
      });

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (results.length >= maxResults) break;
          results.push({
            key: this.stripPrefix(obj.Key),
            size: parseInt(obj.Size, 10) || 0,
            lastModified: new Date(obj.LastModified),
          });
        }
      }

      marker = response.IsTruncated === 'true' ? response.NextMarker : undefined;
    } while (marker && results.length < maxResults);

    return results;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    const url = await new Promise<string>((resolve, reject) => {
      this.client.getObjectUrl({
        Bucket: this.bucket,
        Region: this.region,
        Key: fullKey,
        Sign: true,
        Expires: expiresIn,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data.Url);
      });
    });
    return url;
  }

  async getSignedUploadUrl(key: string, contentType?: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    const url = await new Promise<string>((resolve, reject) => {
      this.client.getObjectUrl({
        Bucket: this.bucket,
        Region: this.region,
        Key: fullKey,
        Method: 'PUT',
        Sign: true,
        Expires: expiresIn,
        Headers: contentType ? { 'Content-Type': contentType } : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data.Url);
      });
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
