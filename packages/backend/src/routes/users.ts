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

// Quick Links (self-service, per-user)
router.get(
  '/me/quick-links',
  generalLimiter as any,
  UserController.getQuickLinks
);

router.post(
  '/me/quick-links',
  generalLimiter as any,
  UserController.createQuickLink
);

router.put(
  '/me/quick-links/reorder',
  generalLimiter as any,
  UserController.reorderQuickLinks
);

router.put(
  '/me/quick-links/:id',
  generalLimiter as any,
  UserController.updateQuickLink
);

router.delete(
  '/me/quick-links/:id',
  generalLimiter as any,
  UserController.deleteQuickLink
);

export default router;
