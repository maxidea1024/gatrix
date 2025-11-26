import { Response } from 'express';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

export class UploadController {
  static uploadAvatar = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new GatrixError('User not authenticated', 401);
    }

    if (!req.file) {
      throw new GatrixError('No file uploaded', 400);
    }

    // Generate file URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: fileUrl,
      },
      message: 'File uploaded successfully',
    });
  });
}
