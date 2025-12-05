import express from 'express';
import { auth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import EnvironmentController from '../../controllers/EnvironmentController';
import RemoteConfigTemplateController from '../../controllers/RemoteConfigTemplateController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth as any);

// Environment routes (admin only)
router.get('/environments', requireAdmin, EnvironmentController.getEnvironments);
router.get('/environments/:id', requireAdmin, EnvironmentController.getEnvironment);
router.post('/environments', requireAdmin, EnvironmentController.createEnvironment);
router.put('/environments/:id', requireAdmin, EnvironmentController.updateEnvironment);
router.delete('/environments/:id', requireAdmin, EnvironmentController.deleteEnvironment);
router.get('/environments/:id/segments', requireAdmin, EnvironmentController.getEnvironmentSegments);
router.post('/environments/:id/segments/predefined', requireAdmin, EnvironmentController.createPredefinedSegments);
router.get('/environments/:id/stats', requireAdmin, EnvironmentController.getEnvironmentStats);
router.post('/environments/validate-name', requireAdmin, EnvironmentController.validateEnvironmentName);

// Environment copy routes (admin only)
router.get('/environments/:sourceEnvironmentId/copy/:targetEnvironmentId/preview', requireAdmin, EnvironmentController.getCopyPreview);
router.post('/environments/:sourceEnvironmentId/copy/:targetEnvironmentId', requireAdmin, EnvironmentController.copyEnvironmentData);

// Template routes
router.get('/environments/:environmentId/templates', RemoteConfigTemplateController.getTemplates);
router.get('/templates/:id', RemoteConfigTemplateController.getTemplate);
router.post('/environments/:environmentId/templates', RemoteConfigTemplateController.createTemplate);
router.put('/templates/:id', RemoteConfigTemplateController.updateTemplate);
router.post('/templates/:id/publish', RemoteConfigTemplateController.publishTemplate);
router.post('/templates/:id/archive', RemoteConfigTemplateController.archiveTemplate);
router.get('/templates/:id/versions', RemoteConfigTemplateController.getTemplateVersions);
router.get('/templates/:id/history', RemoteConfigTemplateController.getTemplateHistory);
router.get('/templates/:id/compare', RemoteConfigTemplateController.compareVersions);
router.post('/templates/validate-name', RemoteConfigTemplateController.validateTemplateName);

export default router;
