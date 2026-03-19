/**
 * File Storage Admin Controller
 *
 * Provides admin endpoints for browsing, downloading, and managing
 * files in the storage system.
 */
import { Response } from 'express';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import { getStorageProvider } from '../services/storage';
import { createLogger } from '../config/logger';

const logger = createLogger('FileStorageController');

export class FileStorageController {
  /**
   * List files by prefix
   * GET /admin/file-storage
   */
  static listFiles = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const prefix = (req.query.prefix as string) || '';
      const maxResults = parseInt(req.query.maxResults as string, 10) || 100;

      const storage = getStorageProvider();
      const files = await storage.listByPrefix(prefix, maxResults);

      res.json({
        success: true,
        data: {
          prefix,
          files,
          count: files.length,
        },
      });
    }
  );

  /**
   * Download a file (proxy)
   * GET /admin/file-storage/download
   */
  static downloadFile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const key = req.query.key as string;

      if (!key) {
        throw new GatrixError('File key is required', 400);
      }

      const storage = getStorageProvider();

      const fileExists = await storage.exists(key);
      if (!fileExists) {
        throw new GatrixError('File not found', 404);
      }

      const data = await storage.download(key);

      // Determine content type from extension
      const ext = key.split('.').pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        txt: 'text/plain',
        log: 'text/plain',
        json: 'application/json',
        xml: 'application/xml',
        csv: 'text/csv',
      };
      const contentType =
        contentTypeMap[ext || ''] || 'application/octet-stream';

      // Extract filename from key
      const filename = key.split('/').pop() || 'file';

      res.set('Content-Type', contentType);
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('Content-Length', data.length.toString());
      res.send(data);
    }
  );

  /**
   * Generate a presigned download URL
   * GET /admin/file-storage/signed-url
   */
  static getSignedUrl = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const key = req.query.key as string;
      const expiresIn = parseInt(req.query.expiresIn as string, 10) || 3600;

      if (!key) {
        throw new GatrixError('File key is required', 400);
      }

      const storage = getStorageProvider();
      const url = await storage.getSignedUrl(key, expiresIn);

      res.json({
        success: true,
        data: {
          url,
          key,
          expiresIn,
        },
      });
    }
  );

  /**
   * Generate a presigned upload URL
   * GET /admin/file-storage/signed-upload-url
   */
  static getSignedUploadUrl = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const key = req.query.key as string;
      const contentType = req.query.contentType as string;
      const expiresIn = parseInt(req.query.expiresIn as string, 10) || 3600;

      if (!key) {
        throw new GatrixError('File key is required', 400);
      }

      const storage = getStorageProvider();
      const url = await storage.getSignedUploadUrl(key, contentType, expiresIn);

      res.json({
        success: true,
        data: {
          url,
          key,
          contentType,
          expiresIn,
        },
      });
    }
  );

  /**
   * Delete a file
   * DELETE /admin/file-storage
   */
  static deleteFile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const key = req.query.key as string;

      if (!key) {
        throw new GatrixError('File key is required', 400);
      }

      const storage = getStorageProvider();
      await storage.delete(key);

      logger.info('File deleted via admin API', {
        key,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        data: { key },
      });
    }
  );
}
