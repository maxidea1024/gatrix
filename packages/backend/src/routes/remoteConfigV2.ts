import express from 'express';
import { auth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import RemoteConfigEnvironmentController from '../controllers/RemoteConfigEnvironmentController';
import RemoteConfigTemplateController from '../controllers/RemoteConfigTemplateController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth as any);

// Environment routes (admin only)
router.get('/environments', requireAdmin, RemoteConfigEnvironmentController.getEnvironments);
router.get('/environments/:id', requireAdmin, RemoteConfigEnvironmentController.getEnvironment);
router.post('/environments', requireAdmin, RemoteConfigEnvironmentController.createEnvironment);
router.put('/environments/:id', requireAdmin, RemoteConfigEnvironmentController.updateEnvironment);
router.delete('/environments/:id', requireAdmin, RemoteConfigEnvironmentController.deleteEnvironment);
router.get('/environments/:id/segments', requireAdmin, RemoteConfigEnvironmentController.getEnvironmentSegments);
router.post('/environments/:id/segments/predefined', requireAdmin, RemoteConfigEnvironmentController.createPredefinedSegments);
router.get('/environments/:id/stats', requireAdmin, RemoteConfigEnvironmentController.getEnvironmentStats);
router.post('/environments/validate-name', requireAdmin, RemoteConfigEnvironmentController.validateEnvironmentName);

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
