import { Router } from 'express';
import { UserController } from '../controllers/user-controller';
import { authenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(authenticate as any);

router.get(
  '/search',
  generalLimiter as any, // Rate limiting
  UserController.searchUsers
);

router.get(
  '/me',
  generalLimiter as any, // Rate limiting
  UserController.getCurrentUser
);

router.put(
  '/me',
  generalLimiter as any, // Rate limiting
  UserController.updateCurrentUser
);

export default router;
