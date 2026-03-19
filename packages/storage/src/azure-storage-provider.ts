/**
 * Azure Blob Storage Provider
 */
import {
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  SASProtocol,
} from '@azure/storage-blob';
import { StorageProvider, StorageFileInfo } from './storage-provider';
import { StorageLogger, defaultLogger } from './logger';

export interface AzureStorageConfig {
  connectionString: string;
  container: string;
  prefix?: string;
  logger?: StorageLogger;
}

export class AzureStorageProvider implements StorageProvider {
  private containerClient: ContainerClient;
  private blobServiceClient: BlobServiceClient;
  private containerName: string;
  private prefix: string;
  private connectionString: string;
  private logger: StorageLogger;

  constructor(config: AzureStorageConfig) {
    this.containerName = config.container;
    this.prefix = config.prefix || '';
    this.connectionString = config.connectionString;
    this.logger = config.logger || defaultLogger;
    this.blobServiceClient = BlobServiceClient.fromConnectionString(config.connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(config.container);
  }

  async upload(key: string, data: Buffer | string, contentType?: string): Promise<string> {
    const fullKey = this.getFullKey(key);
    const body = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const blockBlobClient = this.containerClient.getBlockBlobClient(fullKey);

    await blockBlobClient.upload(body, body.length, {
      blobHTTPHeaders: {
        blobContentType: contentType || 'application/octet-stream',
      },
    });

    this.logger.debug('File uploaded to Azure Blob', { key: fullKey });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);
    const blobClient = this.containerClient.getBlobClient(fullKey);
    return await blobClient.downloadToBuffer();
  }

  async downloadAsString(key: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const buffer = await this.download(key);
    return buffer.toString(encoding);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    const blobClient = this.containerClient.getBlobClient(fullKey);
    await blobClient.deleteIfExists();
    this.logger.debug('File deleted from Azure Blob', { key: fullKey });
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const files = await this.listByPrefix(prefix);
    let deleted = 0;

    for (const file of files) {
      try {
        await this.delete(file.key);
        deleted++;
      } catch (err: unknown) {
        this.logger.warn('Failed to delete blob', { key: file.key, error: String(err) });
      }
    }

    this.logger.info('Files deleted by prefix from Azure Blob', { prefix, deleted });
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const blobClient = this.containerClient.getBlobClient(fullKey);
    return await blobClient.exists();
  }

  async listByPrefix(prefix: string, maxResults: number = 1000): Promise<StorageFileInfo[]> {
    const fullPrefix = this.getFullKey(prefix);
    const results: StorageFileInfo[] = [];

    const iter = this.containerClient.listBlobsFlat({ prefix: fullPrefix });
    for await (const blob of iter) {
      if (results.length >= maxResults) break;
      results.push({
        key: this.stripPrefix(blob.name),
        size: blob.properties.contentLength || 0,
        lastModified: blob.properties.lastModified || new Date(),
      });
    }

    return results;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    const blobClient = this.containerClient.getBlobClient(fullKey);

    try {
      const credential = this.extractCredential();
      if (credential) {
        const expiryDate = new Date(Date.now() + expiresIn * 1000);
        const sasToken = generateBlobSASQueryParameters({
          containerName: this.containerName,
          blobName: fullKey,
          permissions: BlobSASPermissions.parse('r'),
          expiresOn: expiryDate,
          protocol: SASProtocol.HttpsAndHttp,
        }, credential).toString();

        return `${blobClient.url}?${sasToken}`;
      }
    } catch (err: unknown) {
      this.logger.warn('Failed to generate SAS URL, falling back to blob URL', { error: String(err) });
    }

    return blobClient.url;
  }

  async getSignedUploadUrl(key: string, _contentType?: string, expiresIn: number = 3600): Promise<string> {
    const fullKey = this.getFullKey(key);
    const blobClient = this.containerClient.getBlobClient(fullKey);

    try {
      const credential = this.extractCredential();
      if (credential) {
        const expiryDate = new Date(Date.now() + expiresIn * 1000);
        const sasToken = generateBlobSASQueryParameters({
          containerName: this.containerName,
          blobName: fullKey,
          permissions: BlobSASPermissions.parse('cw'),
          expiresOn: expiryDate,
          protocol: SASProtocol.HttpsAndHttp,
        }, credential).toString();

        return `${blobClient.url}?${sasToken}`;
      }
    } catch (err: unknown) {
      this.logger.warn('Failed to generate SAS upload URL', { error: String(err) });
    }

    return blobClient.url;
  }

  private extractCredential(): StorageSharedKeyCredential | null {
    try {
      const accountName = this.connectionString.match(/AccountName=([^;]+)/)?.[1];
      const accountKey = this.connectionString.match(/AccountKey=([^;]+)/)?.[1];
      if (accountName && accountKey) {
        return new StorageSharedKeyCredential(accountName, accountKey);
      }
    } catch {
      // Ignore
    }
    return null;
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
