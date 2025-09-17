import { Router } from 'express';
import { UserController } from '../../controllers/UserController';
import { authenticate, requireAdmin } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

// Self-service routes (available to all authenticated users)
router.get('/me', UserController.getCurrentUser);
router.put('/me', UserController.updateCurrentUser);
router.put('/me/language', UserController.updateLanguage);

export default router;
