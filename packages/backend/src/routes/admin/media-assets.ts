import { Router } from 'express';
import multer from 'multer';
import { MediaAssetController } from '../../controllers/media-asset-controller';
import { config } from '../../config';

const router = Router();

// Configure multer with memory storage (we need the buffer for hash computation)
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (config.mediaAssets?.maxUploadSizeMB ?? 10) * 1024 * 1024,
  },
}).single('file');

// Wrap multer to provide clear error messages
const handleUpload = (req: any, res: any, next: any) => {
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `File exceeds maximum upload size of ${config.mediaAssets?.maxUploadSizeMB ?? 10}MB`,
          errorCode: 'FILE_TOO_LARGE',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message:
            'Unexpected file field. Use "file" as the field name for uploads.',
          errorCode: 'UNEXPECTED_FIELD',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
        errorCode: 'UPLOAD_ERROR',
      });
    }
    next();
  });
};

/**
 * @route   POST /admin/media-assets/upload
 * @desc    Upload a media asset (image/video)
 * @access  Admin
 */
router.post('/upload', handleUpload, MediaAssetController.uploadImage as any);

/**
 * @route   GET /admin/media-assets
 * @desc    List media assets with pagination and filtering
 * @access  Admin
 */
router.get('/', MediaAssetController.listAssets as any);

/**
 * @route   DELETE /admin/media-assets/bulk/unreferenced
 * @desc    Bulk-delete all unreferenced media assets (refCount = 0)
 * @access  Admin
 */
router.delete(
  '/bulk/unreferenced',
  MediaAssetController.bulkDeleteUnreferenced as any
);

/**
 * @route   GET /admin/media-assets/:id
 * @desc    Get a single media asset with referencing banners
 * @access  Admin
 */
router.get('/:id', MediaAssetController.getAsset as any);

/**
 * @route   DELETE /admin/media-assets/:id
 * @desc    Force-delete a media asset
 * @access  Admin
 */
router.delete('/:id', MediaAssetController.deleteAsset as any);

export default router;
