import { Router } from 'express';
import { authenticate, requireOrgPermission } from '../../middleware/auth';
import { AdminController } from '../../controllers/admin-controller';
import apiTokenRoutes from './api-tokens';
import {
  auditUserUpdate,
  auditUserDelete,
  auditUserApprove,
  auditUserReject,
  auditUserSuspend,
  auditUserUnsuspend,
} from '../../middleware/audit-log';
import { P } from '@gatrix/shared/permissions';

const router = Router();

// Permission shorthands
const usersView = requireOrgPermission([P.USERS_READ, P.USERS_UPDATE]) as any;
const usersManage = requireOrgPermission(P.USERS_UPDATE) as any;
const systemManage = requireOrgPermission(P.SYSTEM_SETTINGS_UPDATE) as any;

// All admin routes require authentication and admin privileges
router.use(authenticate as any);

// Dashboard and statistics (any authenticated org member can view)
router.get('/dashboard', usersView, AdminController.getDashboard as any);
router.get('/stats', usersView, AdminController.getStats as any);
router.get('/stats/users', usersView, AdminController.getUserStats as any);

// Health check for debugging
router.get('/health', systemManage, AdminController.healthCheck as any);

// User management
router.get('/users', usersView, AdminController.getAllUsers as any);
router.post('/users', usersManage, AdminController.createUser as any);
router.get('/users/:id', usersView, AdminController.getUserById as any);

router.put(
  '/users/:id',
  usersManage,
  auditUserUpdate as any,
  AdminController.updateUser as any
);
router.delete(
  '/users/:id',
  usersManage,
  auditUserDelete as any,
  AdminController.deleteUser as any
);
router.post(
  '/users/:id/activate',
  usersManage,
  auditUserUnsuspend as any,
  AdminController.activateUser as any
);
router.post(
  '/users/:id/suspend',
  usersManage,
  auditUserSuspend as any,
  AdminController.suspendUser as any
);

router.post(
  '/users/:id/verify-email',
  usersManage,
  AdminController.verifyUserEmail as any
);

// User permissions (RBAC)
router.get('/permissions', usersView, AdminController.getAllPermissions as any);
router.get(
  '/users/:id/permissions',
  usersView,
  AdminController.getUserPermissions as any
);

// Bulk user operations
router.post(
  '/users/bulk/status',
  usersManage,
  AdminController.bulkUpdateUserStatus as any
);
router.post(
  '/users/bulk/email-verified',
  usersManage,
  AdminController.bulkUpdateUserEmailVerified as any
);
router.post(
  '/users/bulk/tags',
  usersManage,
  AdminController.bulkUpdateUserTags as any
);
router.post(
  '/users/bulk/delete',
  usersManage,
  AdminController.bulkDeleteUsers as any
);

// Audit logs
router.get('/audit-logs', usersView, AdminController.getAuditLogs as any);
router.get(
  '/audit-logs/stats',
  usersView,
  AdminController.getAuditStats as any
);

// System management (Super Admin only)
router.post('/cache/clear', systemManage, AdminController.clearCache as any);
router.post(
  '/audit-logs/cleanup',
  systemManage,
  AdminController.cleanupAuditLogs as any
);

// Pending user approvals
router.get('/pending-users', usersView, AdminController.getPendingUsers as any);
router.post(
  '/users/:id/approve',
  usersManage,
  auditUserApprove as any,
  AdminController.approveUser as any
);
router.post(
  '/users/:id/reject',
  usersManage,
  auditUserReject as any,
  AdminController.rejectUser as any
);

// API Token management
router.use('/api-tokens', apiTokenRoutes);

export default router;
