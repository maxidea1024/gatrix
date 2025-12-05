import express from 'express';
import { auth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import RemoteConfigEnvironmentController from '../../controllers/RemoteConfigEnvironmentController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth as any);

// Environment routes (admin only)
router.get('/', requireAdmin, RemoteConfigEnvironmentController.getEnvironments);
router.get('/:id', requireAdmin, RemoteConfigEnvironmentController.getEnvironment);
router.post('/', requireAdmin, RemoteConfigEnvironmentController.createEnvironment);
router.put('/:id', requireAdmin, RemoteConfigEnvironmentController.updateEnvironment);
router.delete('/:id', requireAdmin, RemoteConfigEnvironmentController.deleteEnvironment);
router.get('/:id/stats', requireAdmin, RemoteConfigEnvironmentController.getEnvironmentStats);
router.get('/:id/related-data', requireAdmin, RemoteConfigEnvironmentController.getEnvironmentRelatedData);
router.post('/validate-name', requireAdmin, RemoteConfigEnvironmentController.validateEnvironmentName);

// Environment copy routes (admin only)
router.get('/:sourceEnvironmentId/copy/:targetEnvironmentId/preview', requireAdmin, RemoteConfigEnvironmentController.getCopyPreview);
router.post('/:sourceEnvironmentId/copy/:targetEnvironmentId', requireAdmin, RemoteConfigEnvironmentController.copyEnvironmentData);

export default router;

