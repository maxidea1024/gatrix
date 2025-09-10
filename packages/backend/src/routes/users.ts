import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

// Self-service routes (available to all authenticated users)
router.get('/me', UserController.getCurrentUser);
router.put('/me', UserController.updateCurrentUser);
router.put('/me/language', UserController.updateLanguage);

// Admin-only routes
router.use(requireAdmin as any);

// User management routes
router.get('/', UserController.getAllUsers);
router.post('/', UserController.createUser);
router.get('/stats', UserController.getUserStats);
router.get('/pending', UserController.getPendingUsers);
router.get('/:id', UserController.getUserById);
router.put('/:id', UserController.updateUser);
router.delete('/:id', UserController.deleteUser);

// User status management
router.post('/:id/approve', UserController.approveUser);
router.post('/:id/reject', UserController.rejectUser);
router.post('/:id/suspend', UserController.suspendUser);
router.post('/:id/unsuspend', UserController.unsuspendUser);

// Role management
router.post('/:id/promote', UserController.promoteToAdmin);
router.post('/:id/demote', UserController.demoteFromAdmin);

// Tag management
router.get('/:id/tags', UserController.getUserTags);
router.put('/:id/tags', UserController.setUserTags);
router.post('/:id/tags', UserController.addUserTag);
router.delete('/:id/tags/:tagId', UserController.removeUserTag);

// Email verification management
router.post('/:id/verify-email', UserController.verifyUserEmail);
router.post('/:id/resend-verification', UserController.resendVerificationEmail);

export default router;
