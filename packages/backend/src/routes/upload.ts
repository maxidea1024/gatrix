import { Router } from 'express';
import { UploadController } from '../controllers/UploadController';
import { authenticate } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';

const router = Router();

// All upload routes require authentication
router.use(authenticate as any);

// Avatar upload
router.post('/avatar', uploadAvatar as any, UploadController.uploadAvatar);

export default router;
