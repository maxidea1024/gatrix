import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { createLogger } from '../config/logger';

const logger = createLogger('ServerFileController');

export interface ServerFileRequest extends Request {
  apiToken?: any;
}

class ServerFileController {
  // Generate file upload URL
  static async getUploadUrl(req: ServerFileRequest, res: Response) {
    try {
      const { fileName, fileSize, mimeType, userId } = req.body;

      // Validate required fields
      if (!fileName || !fileSize || !mimeType || !userId) {
        return res.status(400).json({
          success: false,
          error: 'fileName, fileSize, mimeType, and userId are required',
        });
      }

      // File size limit (10MB)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (fileSize > maxFileSize) {
        return res.status(400).json({
          success: false,
          error: `File size exceeds maximum limit of ${maxFileSize / (1024 * 1024)}MB`,
        });
      }

      // Validate allowed MIME types
      const allowedMimeTypes = [
        // Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        // Documents
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // Archives
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        // Videos
        'video/mp4',
        'video/webm',
        'video/ogg',
        // Audio
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
      ];

      if (!allowedMimeTypes.includes(mimeType)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type',
        });
      }

      // Extract file extension
      const fileExtension = path.extname(fileName);

      // Generate unique file ID
      const fileId = uuidv4();
      const timestamp = Date.now();

      // Generate upload path (년/월/일 구조)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadPath = `chat-files/${year}/${month}/${day}`;
      const uniqueFileName = `${fileId}_${timestamp}${fileExtension}`;
      const fullPath = `${uploadPath}/${uniqueFileName}`;

      // In production environment AWS S3, Google Cloud Storage 등의 presigned URL을 Create
      // 여기서는 로컬 업로드 URL을 시뮬레이션
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const uploadUrl = `${baseUrl}/api/v1/upload/file/${fileId}`;
      const fileUrl = `${baseUrl}/uploads/${fullPath}`;

      // 업로드 정보를 임시 Save (실제로는 Redis나 DB에 저장)
      // 여기서는 메모리에 Save하는 것으로 시뮬레이션
      const uploadInfo = {
        fileId,
        fileName,
        fileSize,
        mimeType,
        userId,
        uploadPath: fullPath,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1시간 후 Expired
        createdAt: new Date(),
      };

      logger.info(`Upload URL generated for user ${userId}:`, {
        fileId,
        fileName,
        fileSize,
        mimeType,
      });

      res.json({
        success: true,
        data: {
          uploadUrl,
          fileUrl,
          fileId,
          expiresAt: uploadInfo.expiresAt,
          maxFileSize,
          allowedMimeTypes,
        },
      });
    } catch (error) {
      logger.error('Failed to generate upload URL:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // 업로드된 파일 정보 조회
  static async getFileInfo(req: ServerFileRequest, res: Response) {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'File ID is required',
        });
      }

      // 실제로는 DB에서 파일 정보 조회
      // 여기서는 시뮬레이션
      res.json({
        success: true,
        data: {
          fileId,
          fileName: 'example.jpg',
          fileSize: 1024000,
          mimeType: 'image/jpeg',
          uploadedAt: new Date(),
          status: 'uploaded',
        },
      });
    } catch (error) {
      logger.error('Failed to get file info:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default ServerFileController;
