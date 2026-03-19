/**
 * @gatrix/storage — Pluggable File Storage Abstraction
 *
 * Supported providers:
 * - local:  Local filesystem
 * - s3:    S3-compatible (AWS S3, MinIO, Cloudflare R2, Oracle Cloud, DO Spaces, etc.)
 * - cos:   Tencent Cloud Object Storage
 * - oss:   Alibaba Cloud OSS
 * - azure: Azure Blob Storage
 * - gcs:   Google Cloud Storage
 */

// Interface & types
export type { StorageProvider, StorageFileInfo } from './storage-provider';
export type { StorageLogger } from './logger';
export { defaultLogger } from './logger';

// Provider implementations (re-export for consumers)
export { LocalStorageProvider } from './local-storage-provider';
export { S3StorageProvider } from './s3-storage-provider';
export type { S3StorageConfig } from './s3-storage-provider';
export { COSStorageProvider } from './cos-storage-provider';
export type { COSStorageConfig } from './cos-storage-provider';
export { OSSStorageProvider } from './oss-storage-provider';
export type { OSSStorageConfig } from './oss-storage-provider';
export { AzureStorageProvider } from './azure-storage-provider';
export type { AzureStorageConfig } from './azure-storage-provider';
export { GCSStorageProvider } from './gcs-storage-provider';
export type { GCSStorageConfig } from './gcs-storage-provider';

// Local imports for factory function
import { LocalStorageProvider } from './local-storage-provider';
import { S3StorageProvider } from './s3-storage-provider';
import { COSStorageProvider } from './cos-storage-provider';
import { OSSStorageProvider } from './oss-storage-provider';
import { AzureStorageProvider } from './azure-storage-provider';
import { GCSStorageProvider } from './gcs-storage-provider';
import type { StorageProvider } from './storage-provider';
import type { StorageLogger } from './logger';

/**
 * Factory: create a StorageProvider from environment variables
 */
export type StorageProviderType =
  | 'local'
  | 's3'
  | 'cos'
  | 'oss'
  | 'azure'
  | 'gcs';

export interface CreateStorageOptions {
  provider?: StorageProviderType;
  localPath?: string;
  apiBaseUrl?: string;
  logger?: StorageLogger;
}

export function createStorageProvider(
  options: CreateStorageOptions = {}
): StorageProvider {
  const provider =
    options.provider ||
    (process.env.FILE_STORAGE_PROVIDER as StorageProviderType) ||
    'local';
  const logger = options.logger;

  switch (provider) {
    case 'local': {
      const dataRoot = process.env.DATA_ROOT || './data/gatrix-storage-root';
      const basePath =
        options.localPath ||
        process.env.FILE_STORAGE_LOCAL_PATH ||
        `${dataRoot}/file-storage`;
      return new LocalStorageProvider(basePath, options.apiBaseUrl, logger);
    }
    case 's3': {
      const bucket = process.env.FILE_STORAGE_S3_BUCKET;
      if (!bucket)
        throw new Error('FILE_STORAGE_S3_BUCKET is required for S3 provider');
      return new S3StorageProvider({
        bucket,
        region: process.env.FILE_STORAGE_S3_REGION || 'us-east-1',
        accessKeyId: process.env.FILE_STORAGE_S3_ACCESS_KEY || '',
        secretAccessKey: process.env.FILE_STORAGE_S3_SECRET_KEY || '',
        endpoint: process.env.FILE_STORAGE_S3_ENDPOINT || undefined,
        forcePathStyle: process.env.FILE_STORAGE_S3_FORCE_PATH_STYLE === 'true',
        prefix: process.env.FILE_STORAGE_S3_PREFIX || '',
        logger,
      });
    }
    case 'cos': {
      const bucket = process.env.FILE_STORAGE_COS_BUCKET;
      if (!bucket)
        throw new Error('FILE_STORAGE_COS_BUCKET is required for COS provider');
      return new COSStorageProvider({
        secretId: process.env.FILE_STORAGE_COS_SECRET_ID || '',
        secretKey: process.env.FILE_STORAGE_COS_SECRET_KEY || '',
        bucket,
        region: process.env.FILE_STORAGE_COS_REGION || '',
        prefix: process.env.FILE_STORAGE_COS_PREFIX || '',
        logger,
      });
    }
    case 'oss': {
      const bucket = process.env.FILE_STORAGE_OSS_BUCKET;
      if (!bucket)
        throw new Error('FILE_STORAGE_OSS_BUCKET is required for OSS provider');
      return new OSSStorageProvider({
        bucket,
        region: process.env.FILE_STORAGE_OSS_REGION || '',
        accessKeyId: process.env.FILE_STORAGE_OSS_ACCESS_KEY_ID || '',
        accessKeySecret: process.env.FILE_STORAGE_OSS_ACCESS_KEY_SECRET || '',
        endpoint: process.env.FILE_STORAGE_OSS_ENDPOINT || undefined,
        prefix: process.env.FILE_STORAGE_OSS_PREFIX || '',
        logger,
      });
    }
    case 'azure': {
      const connectionString = process.env.FILE_STORAGE_AZURE_CONNECTION_STRING;
      if (!connectionString)
        throw new Error(
          'FILE_STORAGE_AZURE_CONNECTION_STRING is required for Azure provider'
        );
      return new AzureStorageProvider({
        connectionString,
        container: process.env.FILE_STORAGE_AZURE_CONTAINER || 'gatrix-files',
        prefix: process.env.FILE_STORAGE_AZURE_PREFIX || '',
        logger,
      });
    }
    case 'gcs': {
      const bucket = process.env.FILE_STORAGE_GCS_BUCKET;
      if (!bucket)
        throw new Error('FILE_STORAGE_GCS_BUCKET is required for GCS provider');
      return new GCSStorageProvider({
        bucket,
        projectId: process.env.FILE_STORAGE_GCS_PROJECT_ID || undefined,
        keyFilePath: process.env.FILE_STORAGE_GCS_KEY_FILE || undefined,
        prefix: process.env.FILE_STORAGE_GCS_PREFIX || '',
        logger,
      });
    }
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
}
