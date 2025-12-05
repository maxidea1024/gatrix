import express from 'express';
import { auth, requirePermission } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import EnvironmentController from '../../controllers/EnvironmentController';
import { PERMISSIONS } from '../../types/permissions';

const router = express.Router();

// Apply authentication to all routes
router.use(auth as any);

// List environments - no special permission required (returns only user's accessible environments)
// This is needed for AppBar environment selector
router.get('/', requireAdmin, EnvironmentController.getEnvironments);

// Read-only access requires environments.view permission
const viewPermission = requirePermission([PERMISSIONS.ENVIRONMENTS_VIEW, PERMISSIONS.ENVIRONMENTS_MANAGE]) as any;
router.get('/:id', requireAdmin, viewPermission, EnvironmentController.getEnvironment);
router.get('/:id/stats', requireAdmin, viewPermission, EnvironmentController.getEnvironmentStats);
router.get('/:id/related-data', requireAdmin, viewPermission, EnvironmentController.getEnvironmentRelatedData);

// Write access requires environments.manage permission
const managePermission = requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE) as any;
router.post('/', requireAdmin, managePermission, EnvironmentController.createEnvironment);
router.put('/:id', requireAdmin, managePermission, EnvironmentController.updateEnvironment);
router.delete('/:id', requireAdmin, managePermission, EnvironmentController.deleteEnvironment);
router.post('/validate-name', requireAdmin, managePermission, EnvironmentController.validateEnvironmentName);

// Environment copy routes (requires manage permission)
router.get('/:sourceEnvironmentId/copy/:targetEnvironmentId/preview', requireAdmin, managePermission, EnvironmentController.getCopyPreview);
router.post('/:sourceEnvironmentId/copy/:targetEnvironmentId', requireAdmin, managePermission, EnvironmentController.copyEnvironmentData);

export default router;

