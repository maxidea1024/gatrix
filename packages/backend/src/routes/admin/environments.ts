import express from 'express';
import { auth, requirePermission } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import RemoteConfigEnvironmentController from '../../controllers/RemoteConfigEnvironmentController';
import { PERMISSIONS } from '../../types/permissions';

const router = express.Router();

// Apply authentication to all routes
router.use(auth as any);

// List environments - no special permission required (returns only user's accessible environments)
// This is needed for AppBar environment selector
router.get('/', requireAdmin, RemoteConfigEnvironmentController.getEnvironments);

// Read-only access requires environments.view permission
const viewPermission = requirePermission([PERMISSIONS.ENVIRONMENTS_VIEW, PERMISSIONS.ENVIRONMENTS_MANAGE]) as any;
router.get('/:id', requireAdmin, viewPermission, RemoteConfigEnvironmentController.getEnvironment);
router.get('/:id/stats', requireAdmin, viewPermission, RemoteConfigEnvironmentController.getEnvironmentStats);
router.get('/:id/related-data', requireAdmin, viewPermission, RemoteConfigEnvironmentController.getEnvironmentRelatedData);

// Write access requires environments.manage permission
const managePermission = requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE) as any;
router.post('/', requireAdmin, managePermission, RemoteConfigEnvironmentController.createEnvironment);
router.put('/:id', requireAdmin, managePermission, RemoteConfigEnvironmentController.updateEnvironment);
router.delete('/:id', requireAdmin, managePermission, RemoteConfigEnvironmentController.deleteEnvironment);
router.post('/validate-name', requireAdmin, managePermission, RemoteConfigEnvironmentController.validateEnvironmentName);

// Environment copy routes (requires manage permission)
router.get('/:sourceEnvironmentId/copy/:targetEnvironmentId/preview', requireAdmin, managePermission, RemoteConfigEnvironmentController.getCopyPreview);
router.post('/:sourceEnvironmentId/copy/:targetEnvironmentId', requireAdmin, managePermission, RemoteConfigEnvironmentController.copyEnvironmentData);

export default router;

