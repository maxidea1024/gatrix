import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { GatrixError } from '../../middleware/error-handler';
import { FileStorageController } from '../../controllers/file-storage-controller';

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((err: any) => err.msg)
      .join(', ');
    throw new GatrixError(`Validation failed: ${errorMessages}`, 400);
  }
  next();
};

const router = Router();

/**
 * @route   GET /admin/file-storage
 * @desc    List files by prefix
 * @access  Admin
 */
router.get(
  '/',
  [
    query('prefix').optional().isString(),
    query('maxResults').optional().isInt({ min: 1, max: 1000 }),
    validateRequest,
  ],
  FileStorageController.listFiles as any
);

/**
 * @route   GET /admin/file-storage/download
 * @desc    Download a file
 * @access  Admin
 */
router.get(
  '/download',
  [query('key').isString().notEmpty(), validateRequest],
  FileStorageController.downloadFile as any
);

/**
 * @route   GET /admin/file-storage/signed-url
 * @desc    Get a presigned download URL
 * @access  Admin
 */
router.get(
  '/signed-url',
  [
    query('key').isString().notEmpty(),
    query('expiresIn').optional().isInt({ min: 60, max: 86400 }),
    validateRequest,
  ],
  FileStorageController.getSignedUrl as any
);

/**
 * @route   GET /admin/file-storage/signed-upload-url
 * @desc    Get a presigned upload URL
 * @access  Admin
 */
router.get(
  '/signed-upload-url',
  [
    query('key').isString().notEmpty(),
    query('contentType').optional().isString(),
    query('expiresIn').optional().isInt({ min: 60, max: 86400 }),
    validateRequest,
  ],
  FileStorageController.getSignedUploadUrl as any
);

/**
 * @route   DELETE /admin/file-storage
 * @desc    Delete a file
 * @access  Admin
 */
router.delete(
  '/',
  [query('key').isString().notEmpty(), validateRequest],
  FileStorageController.deleteFile as any
);

export default router;
