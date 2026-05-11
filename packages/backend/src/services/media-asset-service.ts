/**
 * Media Asset Service
 *
 * Handles image upload to S3/storage, SHA-256 hash-based deduplication,
 * magic-bytes format detection, reference counting, and garbage collection.
 */
import { createHash } from 'crypto';
import { ulid } from 'ulid';
import { MediaAssetModel, MediaAssetAttributes } from '../models/media-asset';
import { getStorageProvider } from './storage';
import { config } from '../config';
import { createLogger } from '../config/logger';
import { GatrixError } from '../middleware/error-handler';
import db from '../config/knex';

const logger = createLogger('MediaAssetService');

// ─── Magic Bytes Signatures ───────────────────────────────────────────────────
interface FormatDetection {
  mimeType: string;
  extension: string;
}

/**
 * Detect the actual file format from magic bytes (file header).
 * This ensures the correct extension is used regardless of what the user named the file.
 *
 * Ported from FrameEditor's detectFrameTypeFromHeader() to server-side.
 */
function detectFormatFromBuffer(buffer: Buffer): FormatDetection | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  // GIF: 47 49 46 38 (GIF87a or GIF89a)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { mimeType: 'image/gif', extension: 'gif' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  // MP4: ftyp signature at offset 4
  if (buffer.length >= 8) {
    const ftyp = buffer.slice(4, 8).toString('ascii');
    if (ftyp === 'ftyp') {
      return { mimeType: 'video/mp4', extension: 'mp4' };
    }
  }

  // SVG: starts with < and contains <svg (check first 256 bytes)
  if (buffer[0] === 0x3c) {
    const head = buffer
      .slice(0, Math.min(buffer.length, 256))
      .toString('utf8')
      .toLowerCase();
    if (head.includes('<svg')) {
      return { mimeType: 'image/svg+xml', extension: 'svg' };
    }
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { mimeType: 'image/bmp', extension: 'bmp' };
  }

  return null;
}

/**
 * Get extension from the user-provided filename as a fallback
 */
function getExtensionFromFilename(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop()!.toLowerCase();
  }
  return 'bin';
}

/**
 * Map known MIME types to extensions (fallback for when magic bytes detection fails)
 */
function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
  };
  return map[mimeType] || 'bin';
}

// ─── Upload Response ──────────────────────────────────────────────────────────
export interface UploadResult {
  id: string;
  cdnUrl: string;
  hash: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  isDuplicate: boolean;
}

// ─── Referencing Banner Info ──────────────────────────────────────────────────
export interface ReferencingBanner {
  bannerId: string;
  name: string;
  environmentId: string;
  status: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────
export class MediaAssetService {
  /**
   * Derive a public URL for a storage key based on the active storage provider.
   * Used when CDN_BASE_URL is not explicitly configured.
   */
  static derivePublicUrl(storageKey: string): string {
    const provider = process.env.FILE_STORAGE_PROVIDER || 'local';
    const prefix = (() => {
      switch (provider) {
        case 'cos': return process.env.FILE_STORAGE_COS_PREFIX || '';
        case 's3': return process.env.FILE_STORAGE_S3_PREFIX || '';
        case 'oss': return process.env.FILE_STORAGE_OSS_PREFIX || '';
        case 'gcs': return process.env.FILE_STORAGE_GCS_PREFIX || '';
        case 'azure': return process.env.FILE_STORAGE_AZURE_PREFIX || '';
        default: return '';
      }
    })();
    const fullKey = prefix
      ? `${prefix}/${storageKey}`.replace(/\/+/g, '/')
      : storageKey;

    switch (provider) {
      case 'cos': {
        const bucket = process.env.FILE_STORAGE_COS_BUCKET || '';
        const region = process.env.FILE_STORAGE_COS_REGION || '';
        return `https://${bucket}.cos.${region}.myqcloud.com/${fullKey}`;
      }
      case 's3': {
        // S3 + CloudFront: bucket is typically private.
        // CDN_BASE_URL (CloudFront domain) MUST be set for public access.
        // Falling back to S3 direct URL, but it will likely fail with AccessDenied.
        const bucket = process.env.FILE_STORAGE_S3_BUCKET || '';
        const region = process.env.FILE_STORAGE_S3_REGION || 'us-east-1';
        const endpoint = process.env.FILE_STORAGE_S3_ENDPOINT;
        logger.warn(
          '[MediaAssetService] CDN_BASE_URL is not set. ' +
          'S3 buckets with CloudFront OAC are private — direct S3 URLs will return AccessDenied. ' +
          'Set CDN_BASE_URL to your CloudFront domain (e.g. https://d1234.cloudfront.net).',
          { bucket, region }
        );
        if (endpoint) {
          return `${endpoint.replace(/\/$/, '')}/${bucket}/${fullKey}`;
        }
        return `https://${bucket}.s3.${region}.amazonaws.com/${fullKey}`;
      }
      case 'oss': {
        const bucket = process.env.FILE_STORAGE_OSS_BUCKET || '';
        const endpoint =
          process.env.FILE_STORAGE_OSS_ENDPOINT ||
          `${process.env.FILE_STORAGE_OSS_REGION || ''}.aliyuncs.com`;
        return `https://${bucket}.${endpoint}/${fullKey}`;
      }
      case 'gcs': {
        const bucket = process.env.FILE_STORAGE_GCS_BUCKET || '';
        return `https://storage.googleapis.com/${bucket}/${fullKey}`;
      }
      case 'azure': {
        const connStr = process.env.FILE_STORAGE_AZURE_CONNECTION_STRING || '';
        const accountMatch = connStr.match(/AccountName=([^;]+)/i);
        const account = accountMatch?.[1] || 'unknown';
        const container =
          process.env.FILE_STORAGE_AZURE_CONTAINER || 'gatrix-files';
        return `https://${account}.blob.core.windows.net/${container}/${fullKey}`;
      }
      default: {
        return `/api/v1/admin/file-storage/download?key=${encodeURIComponent(storageKey)}`;
      }
    }
  }

  /**
   * Upload an image file.
   *
   * Flow:
   * 1. Compute SHA-256 hash from raw bytes (extension-independent)
   * 2. Detect actual format via magic bytes
   * 3. Check for duplicate by hash
   * 4. If duplicate, return existing asset's cdnUrl (no re-upload)
   * 5. If new, upload to storage and create DB record
   */
  static async uploadImage(
    fileBuffer: Buffer,
    originalFilename: string,
    uploadedBy?: string
  ): Promise<UploadResult> {
    // ── Validate file size ──────────────────────────────────────────────
    const maxSizeBytes =
      (config.mediaAssets?.maxUploadSizeMB ?? 50) * 1024 * 1024;
    if (fileBuffer.length > maxSizeBytes) {
      throw new GatrixError(
        `File exceeds maximum upload size of ${config.mediaAssets?.maxUploadSizeMB ?? 50}MB`,
        400,
        true,
        'FILE_TOO_LARGE'
      );
    }

    // ── Validate minimum size (not empty) ───────────────────────────────
    if (fileBuffer.length === 0) {
      throw new GatrixError(
        'Uploaded file is empty',
        400,
        true,
        'EMPTY_FILE'
      );
    }

    // ── Detect actual format via magic bytes ─────────────────────────────
    const detected = detectFormatFromBuffer(fileBuffer);
    let contentType: string;
    let extension: string;

    if (detected) {
      contentType = detected.mimeType;
      extension = detected.extension;
    } else {
      // Fallback: use file extension from original filename
      extension = getExtensionFromFilename(originalFilename);
      contentType = `image/${extension}`;
      logger.warn(
        'Magic bytes detection failed, falling back to filename extension',
        { originalFilename, extension }
      );
    }

    // ── Validate MIME type ───────────────────────────────────────────────
    const allowedMimeTypes = config.mediaAssets?.allowedMimeTypes || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
    ];
    if (!allowedMimeTypes.includes(contentType)) {
      throw new GatrixError(
        `Unsupported file type: ${contentType}. Allowed types: ${allowedMimeTypes.join(', ')}`,
        400,
        true,
        'INVALID_FILE_TYPE'
      );
    }

    // ── Compute SHA-256 hash (pure binary, extension-independent) ───────
    const hash = createHash('sha256').update(fileBuffer).digest('hex');

    // ── Check for duplicate by hash ─────────────────────────────────────
    const existing = await MediaAssetModel.findByHash(hash);
    if (existing) {
      logger.info('Duplicate image detected by hash', {
        hash,
        existingId: existing.id,
        originalFilename,
      });
      return {
        id: existing.id,
        cdnUrl: existing.cdnUrl,
        hash: existing.hash,
        fileName: existing.fileName,
        contentType: existing.contentType,
        size: existing.size,
        width: existing.width,
        height: existing.height,
        isDuplicate: true,
      };
    }

    // ── Upload to storage ───────────────────────────────────────────────
    const assetId = ulid();
    const storagePrefix = config.mediaAssets?.storagePrefix || 'media/banners';
    const storageKey = `${storagePrefix}/${assetId}.${extension}`;

    try {
      const storage = getStorageProvider();
      const acl = process.env.MEDIA_UPLOAD_ACL || undefined;
      await storage.upload(
        storageKey,
        fileBuffer,
        contentType,
        acl ? { acl: acl as 'public-read' | 'private' } : undefined
      );
    } catch (error) {
      logger.error('Failed to upload file to storage', {
        error,
        storageKey,
        size: fileBuffer.length,
      });
      throw new GatrixError(
        'Failed to upload file to storage. Please try again.',
        500,
        true,
        'STORAGE_UPLOAD_FAILED'
      );
    }

    // ── Build CDN URL ───────────────────────────────────────────────────
    const cdnBaseUrl = config.mediaAssets?.cdnBaseUrl;
    let cdnUrl: string;
    if (cdnBaseUrl) {
      // Explicit CDN configured (CloudFront, CDN custom domain, etc.)
      cdnUrl = `${cdnBaseUrl.replace(/\/$/, '')}/${storageKey}`;
    } else {
      // Auto-derive public URL from storage provider
      cdnUrl = MediaAssetService.derivePublicUrl(storageKey);
    }

    // ── Verify CDN URL is publicly accessible ───────────────────────────
    if (cdnUrl.startsWith('http')) {
      try {
        const resp = await fetch(cdnUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (!resp.ok) {
          logger.warn(
            `[MediaAssetService] Uploaded file is NOT publicly accessible (HTTP ${resp.status}). ` +
            'Check: 1) CDN_BASE_URL is correct, 2) MEDIA_UPLOAD_ACL=public-read is set, ' +
            '3) Bucket/CDN permissions allow public read.',
            { cdnUrl, status: resp.status }
          );
        }
      } catch (verifyErr) {
        logger.warn(
          '[MediaAssetService] Could not verify CDN URL accessibility.',
          { cdnUrl, error: (verifyErr as Error).message }
        );
      }
    }

    // ── Create DB record (with concurrent duplicate handling) ──────────
    let asset: MediaAssetAttributes;
    try {
      asset = await MediaAssetModel.create({
        id: assetId,
        hash,
        storageKey,
        cdnUrl,
        fileName: originalFilename,
        contentType,
        size: fileBuffer.length,
        width: null, // TODO: extract from image metadata if needed
        height: null,
        uploadedBy: uploadedBy ?? null,
      });
    } catch (error: any) {
      // ── Race condition: another concurrent upload with the same hash
      // won the insert. Clean up our orphaned S3 file and return the winner's asset.
      if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
        logger.info(
          'Concurrent duplicate upload detected (hash collision on insert), returning existing asset',
          { hash, storageKey }
        );
        // Clean up the file we just uploaded (the winner's file is canonical)
        try {
          const storage = getStorageProvider();
          await storage.delete(storageKey);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup orphaned storage file after race', {
            cleanupError,
            storageKey,
          });
        }
        // Return the winner's asset
        const winner = await MediaAssetModel.findByHash(hash);
        if (winner) {
          return {
            id: winner.id,
            cdnUrl: winner.cdnUrl,
            hash: winner.hash,
            fileName: winner.fileName,
            contentType: winner.contentType,
            size: winner.size,
            width: winner.width,
            height: winner.height,
            isDuplicate: true,
          };
        }
      }

      // Other DB errors: cleanup and throw
      logger.error('Failed to create media asset record, cleaning up storage', {
        error,
        storageKey,
      });
      try {
        const storage = getStorageProvider();
        await storage.delete(storageKey);
      } catch (cleanupError) {
        logger.error('Failed to cleanup orphaned storage file', {
          cleanupError,
          storageKey,
        });
      }
      throw new GatrixError(
        'Failed to save image metadata. Please try again.',
        500,
        true,
        'DB_INSERT_FAILED'
      );
    }

    logger.info('Media asset uploaded successfully', {
      id: assetId,
      hash,
      storageKey,
      contentType,
      size: fileBuffer.length,
      originalFilename,
    });

    return {
      id: asset.id,
      cdnUrl: asset.cdnUrl,
      hash: asset.hash,
      fileName: asset.fileName,
      contentType: asset.contentType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      isDuplicate: false,
    };
  }

  /**
   * Synchronize banner image references after a banner create/update.
   *
   * Compares old vs new image URLs, incrementing/decrementing refCounts accordingly.
   * Only processes URLs that match assets in g_media_assets (external URLs are ignored).
   */
  static async syncBannerRefs(
    bannerId: string,
    oldImageUrls: string[],
    newImageUrls: string[]
  ): Promise<void> {
    try {
      const oldSet = new Set(oldImageUrls);
      const newSet = new Set(newImageUrls);

      // URLs removed (in old but not in new) → decrement
      const removedUrls = oldImageUrls.filter((url) => !newSet.has(url));
      // URLs added (in new but not in old) → increment
      const addedUrls = newImageUrls.filter((url) => !oldSet.has(url));

      const gracePeriodHours =
        config.mediaAssets?.gcGracePeriodHours ?? 24;

      // Process decrements
      for (const url of removedUrls) {
        const asset = await MediaAssetModel.findByCdnUrl(url);
        if (asset) {
          await MediaAssetModel.decrementRef(asset.id, gracePeriodHours);
          logger.debug('Decremented ref for media asset', {
            assetId: asset.id,
            bannerId,
            url,
          });
        }
      }

      // Process increments
      for (const url of addedUrls) {
        const asset = await MediaAssetModel.findByCdnUrl(url);
        if (asset) {
          await MediaAssetModel.incrementRef(asset.id);
          logger.debug('Incremented ref for media asset', {
            assetId: asset.id,
            bannerId,
            url,
          });
        }
      }
    } catch (error) {
      // Ref sync failures should not break the banner save operation
      logger.error('Failed to sync banner media refs (non-fatal)', {
        error,
        bannerId,
      });
    }
  }

  /**
   * Extract all image URLs from a banner's sequences.
   */
  static extractImageUrls(
    sequences: Array<{ frames?: Array<{ imageUrl?: string }> }>
  ): string[] {
    const urls: string[] = [];
    if (!sequences) return urls;

    for (const seq of sequences) {
      if (!seq.frames) continue;
      for (const frame of seq.frames) {
        if (frame.imageUrl) {
          urls.push(frame.imageUrl);
        }
      }
    }
    return urls;
  }

  /**
   * Run garbage collection: delete assets with refCount=0 whose grace period has expired.
   *
   * @returns Number of assets deleted
   */
  static async runGarbageCollection(): Promise<number> {
    try {
      const garbageAssets = await MediaAssetModel.findGarbageAssets();

      if (garbageAssets.length === 0) {
        logger.debug('No garbage media assets to collect');
        return 0;
      }

      let deletedCount = 0;
      const storage = getStorageProvider();

      for (const asset of garbageAssets) {
        try {
          // Delete from storage first
          try {
            await storage.delete(asset.storageKey);
          } catch (storageError) {
            // Storage deletion failure is non-fatal for the DB record
            // The file may have already been removed or the key may be invalid
            logger.warn('Failed to delete storage file during GC', {
              storageKey: asset.storageKey,
              assetId: asset.id,
              error: storageError,
            });
          }

          // Delete DB record
          await MediaAssetModel.delete(asset.id);
          deletedCount++;

          logger.debug('Garbage collected media asset', {
            id: asset.id,
            storageKey: asset.storageKey,
            hash: asset.hash,
          });
        } catch (error) {
          logger.error('Failed to GC individual media asset', {
            error,
            assetId: asset.id,
          });
          // Continue with next asset
        }
      }

      if (deletedCount > 0) {
        logger.info(
          `Media asset GC completed: ${deletedCount}/${garbageAssets.length} assets collected`
        );
      }

      return deletedCount;
    } catch (error) {
      logger.error('Media asset garbage collection failed', { error });
      throw error;
    }
  }

  /**
   * Find banners that reference a given CDN URL.
   * Scans g_banners sequences JSON for matching imageUrl values.
   */
  static async findReferencingBanners(
    cdnUrl: string
  ): Promise<ReferencingBanner[]> {
    try {
      // Use LIKE on the JSON-serialized sequences column
      const rows = await db('g_banners')
        .select('id as bannerId', 'name', 'environmentId', 'status')
        .where('sequences', 'like', `%${cdnUrl}%`);

      return rows.map((row: any) => ({
        bannerId: row.bannerId,
        name: row.name,
        environmentId: row.environmentId,
        status: row.status,
      }));
    } catch (error) {
      logger.error('Failed to find referencing banners', { error, cdnUrl });
      return [];
    }
  }

  /**
   * Force-delete a media asset (admin action).
   * Removes from both storage and database regardless of refCount.
   */
  static async forceDelete(id: string): Promise<void> {
    const asset = await MediaAssetModel.findById(id);
    if (!asset) {
      throw new GatrixError('Media asset not found', 404);
    }

    // Delete from storage
    try {
      const storage = getStorageProvider();
      await storage.delete(asset.storageKey);
    } catch (error) {
      logger.warn('Failed to delete storage file during force delete', {
        error,
        storageKey: asset.storageKey,
      });
      // Continue — still delete the DB record
    }

    // Delete DB record
    await MediaAssetModel.delete(id);

    logger.info('Media asset force-deleted', {
      id: asset.id,
      storageKey: asset.storageKey,
      refCount: asset.refCount,
    });
  }

  /**
   * Bulk-delete all unreferenced media assets (refCount = 0).
   * Returns the number of assets deleted.
   */
  static async bulkDeleteUnreferenced(): Promise<{ deleted: number }> {
    const unreferenced = await db('g_media_assets')
      .where({ refCount: 0 })
      .select('id', 'storageKey');

    if (unreferenced.length === 0) {
      return { deleted: 0 };
    }

    const storage = getStorageProvider();
    let deleted = 0;

    for (const asset of unreferenced) {
      try {
        await storage.delete(asset.storageKey);
      } catch (err) {
        logger.warn('Failed to delete storage file during bulk cleanup', {
          storageKey: asset.storageKey,
          error: (err as Error).message,
        });
      }
      await MediaAssetModel.delete(asset.id);
      deleted++;
    }

    logger.info('Bulk-deleted unreferenced media assets', {
      total: unreferenced.length,
      deleted,
    });

    return { deleted };
  }
}
