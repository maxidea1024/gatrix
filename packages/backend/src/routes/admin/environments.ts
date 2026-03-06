import express from 'express';
import { auth, requirePermission } from '../../middleware/auth';
import EnvironmentController from '../../controllers/EnvironmentController';
import { PERMISSIONS } from '../../types/permissions';

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(auth as any);

// List environments - no special permission required (returns only user's accessible environments)
// This is needed for AppBar environment selector
router.get('/', EnvironmentController.getEnvironments);

// Read-only access requires environments.view permission
const viewPermission = requirePermission([
  PERMISSIONS.ENVIRONMENTS_VIEW,
  PERMISSIONS.ENVIRONMENTS_MANAGE,
]) as any;
router.get('/:environmentId', viewPermission, EnvironmentController.getEnvironment);
router.get(
  '/:environmentId/stats',
  viewPermission,
  EnvironmentController.getEnvironmentStats
);
router.get(
  '/:environmentId/related-data',
  viewPermission,
  EnvironmentController.getEnvironmentRelatedData
);

// Write access requires environments.manage permission
const managePermission = requirePermission(PERMISSIONS.ENVIRONMENTS_MANAGE) as any;
router.post('/', managePermission, EnvironmentController.createEnvironment);
router.put(
  '/:environmentId',
  managePermission,
  EnvironmentController.updateEnvironment
);
router.delete(
  '/:environmentId',
  managePermission,
  EnvironmentController.deleteEnvironment
);
router.post(
  '/validate-name',
  managePermission,
  EnvironmentController.validateEnvironmentName
);

// Environment copy routes (requires manage permission)
router.get(
  '/:sourceEnvironmentId/copy/:targetEnvironmentId/preview',
  managePermission,
  EnvironmentController.getCopyPreview
);
router.post(
  '/:sourceEnvironmentId/copy/:targetEnvironmentId',
  managePermission,
  EnvironmentController.copyEnvironmentData
);

export default router;
