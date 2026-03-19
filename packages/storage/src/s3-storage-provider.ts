/**
 * S3-Compatible Storage Provider
 *
 * Supports AWS S3, MinIO, Cloudflare R2, Oracle Cloud Object Storage,
 * DigitalOcean Spaces, Backblaze B2, Wasabi, and any S3-compatible service.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, StorageFileInfo } from './storage-provider';
import { StorageLogger, defaultLogger } from './logger';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  prefix?: string;
  logger?: StorageLogger;
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private prefix: string;
  private logger: StorageLogger;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
    this.logger = config.logger || defaultLogger;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientConfig: any = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    if (config.forcePathStyle) {
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
  }

  async upload(
    key: string,
    data: Buffer | string,
    contentType?: string
  ): Promise<string> {
    const fullKey = this.getFullKey(key);
    const body = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      })
    );

    this.logger.debug('File uploaded to S3', { key: fullKey });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      })
    );

    const stream = response.Body;
    if (!stream) {
      throw new Error(`Empty response body for key: ${fullKey}`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
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
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
      })
    );
    this.logger.debug('File deleted from S3', { key: fullKey });
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const files = await this.listByPrefix(prefix);
    if (files.length === 0) return 0;

    let deleted = 0;
    const batchSize = 1000;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const objects = batch.map((f) => ({ Key: this.getFullKey(f.key) }));

      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: objects },
        })
      );

      deleted += batch.length;
    }

    this.logger.info('Files deleted by prefix from S3', { prefix, deleted });
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: fullKey,
        })
      );
      return true;
    } catch (err: unknown) {
      const error = err as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  async listByPrefix(
    prefix: string,
    maxResults: number = 1000
  ): Promise<StorageFileInfo[]> {
    const fullPrefix = this.getFullKey(prefix);
    const results: StorageFileInfo[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: fullPrefix,
          MaxKeys: Math.min(maxResults - results.length, 1000),
          ContinuationToken: continuationToken,
        })
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (results.length >= maxResults) break;
          results.push({
            key: this.stripPrefix(obj.Key || ''),
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
          });
        }
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken && results.length < maxResults);

    return results;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });
    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async getSignedUploadUrl(
    key: string,
    contentType?: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const fullKey = this.getFullKey(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      ContentType: contentType || 'application/octet-stream',
    });
    return await getSignedUrl(this.client, command, { expiresIn });
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
