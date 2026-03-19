/**
 * Storage Provider Interface
 *
 * Abstract interface for file storage operations.
 * Supports local filesystem, S3-compatible, Tencent COS, Aliyun OSS,
 * Azure Blob Storage, and Google Cloud Storage.
 */

export interface StorageFileInfo {
  key: string;
  size: number;
  lastModified: Date;
}

export interface StorageProvider {
  /**
   * Upload a file to storage
   * @param key - Storage key (path-like, e.g. "crashes/logs/2026/03/18/abc.txt")
   * @param data - File content as Buffer or string
   * @param contentType - Optional MIME type
   * @returns The stored key
   */
  upload(
    key: string,
    data: Buffer | string,
    contentType?: string
  ): Promise<string>;

  /**
   * Download a file as Buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Download a file as string
   */
  downloadAsString(key: string, encoding?: BufferEncoding): Promise<string>;

  /**
   * Delete a single file
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all files matching a prefix
   * @returns Number of files deleted
   */
  deleteByPrefix(prefix: string): Promise<number>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * List files matching a prefix
   */
  listByPrefix(prefix: string, maxResults?: number): Promise<StorageFileInfo[]>;

  /**
   * Generate a presigned download URL
   * @param key - Storage key
   * @param expiresIn - Expiration in seconds (default: 3600)
   * @returns Presigned URL string
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Generate a presigned upload URL
   * @param key - Storage key
   * @param contentType - Expected content type
   * @param expiresIn - Expiration in seconds (default: 3600)
   * @returns Presigned URL string
   */
  getSignedUploadUrl(
    key: string,
    contentType?: string,
    expiresIn?: number
  ): Promise<string>;
}
