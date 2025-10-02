import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from '../config/logger';

export interface ServerFileRequest extends Request {
  apiToken?: any;
}

class ServerFileController {
  // 파일 업로드 URL 생성
  static async getUploadUrl(req: ServerFileRequest, res: Response) {
    try {
      const {
        fileName,
        fileSize,
        mimeType,
        userId
      } = req.body;

      // 필수 필드 검증
      if (!fileName || !fileSize || !mimeType || !userId) {
        return res.status(400).json({
          success: false,
          error: 'fileName, fileSize, mimeType, and userId are required'
        });
      }

      // 파일 크기 제한 (10MB)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (fileSize > maxFileSize) {
        return res.status(400).json({
          success: false,
          error: `File size exceeds maximum limit of ${maxFileSize / (1024 * 1024)}MB`
        });
      }

      // 허용된 MIME 타입 검증
      const allowedMimeTypes = [
        // 이미지
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        // 문서
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // 압축 파일
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        // 비디오
        'video/mp4',
        'video/webm',
        'video/ogg',
        // 오디오
        'audio/mpeg',
        'audio/wav',
        'audio/ogg'
      ];

      if (!allowedMimeTypes.includes(mimeType)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type'
        });
      }

      // 파일 확장자 추출
      const fileExtension = path.extname(fileName);
      
      // 고유한 파일 ID 생성
      const fileId = uuidv4();
      const timestamp = Date.now();
      
      // 업로드 경로 생성 (년/월/일 구조)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      
      const uploadPath = `chat-files/${year}/${month}/${day}`;
      const uniqueFileName = `${fileId}_${timestamp}${fileExtension}`;
      const fullPath = `${uploadPath}/${uniqueFileName}`;

      // 실제 환경에서는 AWS S3, Google Cloud Storage 등의 presigned URL을 생성
      // 여기서는 로컬 업로드 URL을 시뮬레이션
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const uploadUrl = `${baseUrl}/api/v1/upload/file/${fileId}`;
      const fileUrl = `${baseUrl}/uploads/${fullPath}`;

      // 업로드 정보를 임시 저장 (실제로는 Redis나 DB에 저장)
      // 여기서는 메모리에 저장하는 것으로 시뮬레이션
      const uploadInfo = {
        fileId,
        fileName,
        fileSize,
        mimeType,
        userId,
        uploadPath: fullPath,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1시간 후 만료
        createdAt: new Date()
      };

      logger.info(`Upload URL generated for user ${userId}:`, {
        fileId,
        fileName,
        fileSize,
        mimeType
      });

      res.json({
        success: true,
        data: {
          uploadUrl,
          fileUrl,
          fileId,
          expiresAt: uploadInfo.expiresAt,
          maxFileSize,
          allowedMimeTypes
        }
      });

    } catch (error) {
      logger.error('Failed to generate upload URL:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
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
          error: 'File ID is required'
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
          status: 'uploaded'
        }
      });

    } catch (error) {
      logger.error('Failed to get file info:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default ServerFileController;
