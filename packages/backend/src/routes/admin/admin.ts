import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AdminController } from '../../controllers/AdminController';
import apiTokenRoutes from './apiTokens';
import {
  auditUserUpdate,
  auditUserDelete,
  auditUserApprove,
  auditUserReject,
  auditUserSuspend,
  auditUserUnsuspend,
  auditUserPromote,
  auditUserDemote
} from '../../middleware/auditLog';

const router = Router();

// All admin routes require authentication and admin privileges
router.use(authenticate as any);
router.use(requireAdmin as any);

// Dashboard and statistics
router.get('/dashboard', AdminController.getDashboard as any);
router.get('/stats', AdminController.getStats as any);
router.get('/stats/users', AdminController.getUserStats as any);

// Health check for debugging
router.get('/health', AdminController.healthCheck as any);

// User management
router.get('/users', AdminController.getAllUsers as any);
router.post('/users', AdminController.createUser as any);
router.get('/users/:id', AdminController.getUserById as any);

router.put('/users/:id', auditUserUpdate as any, AdminController.updateUser as any);
router.delete('/users/:id', auditUserDelete as any, AdminController.deleteUser as any);
router.post('/users/:id/activate', auditUserUnsuspend as any, AdminController.activateUser as any);
router.post('/users/:id/suspend', auditUserSuspend as any, AdminController.suspendUser as any);
router.post('/users/:id/promote', auditUserPromote as any, AdminController.promoteToAdmin as any);
router.post('/users/:id/demote', auditUserDemote as any, AdminController.demoteFromAdmin as any);
router.post('/users/:id/verify-email', AdminController.verifyUserEmail as any);

// Bulk user operations
router.post('/users/bulk/status', AdminController.bulkUpdateUserStatus as any);
router.post('/users/bulk/role', AdminController.bulkUpdateUserRole as any);
router.post('/users/bulk/email-verified', AdminController.bulkUpdateUserEmailVerified as any);
router.post('/users/bulk/tags', AdminController.bulkUpdateUserTags as any);
router.post('/users/bulk/delete', AdminController.bulkDeleteUsers as any);

// Audit logs
router.get('/audit-logs', AdminController.getAuditLogs as any);
router.get('/audit-logs/stats', AdminController.getAuditStats as any);

// System management
router.post('/cache/clear', AdminController.clearCache as any);
router.post('/audit-logs/cleanup', AdminController.cleanupAuditLogs as any);

// Pending user approvals
router.get('/pending-users', AdminController.getPendingUsers as any);
router.post('/users/:id/approve', auditUserApprove as any, AdminController.approveUser as any);
router.post('/users/:id/reject', auditUserReject as any, AdminController.rejectUser as any);

// API Token management
router.use('/api-tokens', apiTokenRoutes);

export default router;
