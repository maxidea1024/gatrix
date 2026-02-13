import express from 'express';
import { ReleaseFlowController } from '../../controllers/ReleaseFlowController';
import { requirePermission } from '../../middleware/auth';
import { PERMISSIONS } from '../../types/permissions';

const router = express.Router();

// Templates management
router.get('/templates', ReleaseFlowController.listTemplates as any);
router.get('/templates/:id', ReleaseFlowController.getTemplate as any);
router.post('/templates', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.createTemplate as any);
router.put('/templates/:id', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.updateTemplate as any);
router.delete('/templates/:id', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.deleteTemplate as any);

// Apply template to flag
router.post('/apply', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.applyTemplate as any);

// Plans management
router.get('/plans/flag/:flagId', ReleaseFlowController.getPlansByFlag as any);
router.get('/plans/:flagId/:environment', ReleaseFlowController.getPlan as any);
router.post('/plans/:planId/milestones/:milestoneId/start', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.startMilestone as any);

// Plan lifecycle
router.post('/plans/:id/start', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.startPlan as any);
router.post('/plans/:id/pause', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.pausePlan as any);
router.post('/plans/:id/resume', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.resumePlan as any);
router.post('/plans/:id/progress', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.progressToNext as any);

// Milestone transition conditions
router.put('/milestones/:milestoneId/transition', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.setTransitionCondition as any);
router.delete('/milestones/:milestoneId/transition', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.removeTransitionCondition as any);

// Safeguards (per-milestone)
router.get('/milestones/:milestoneId/safeguards', ReleaseFlowController.listSafeguards as any);
router.post('/safeguards', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.createSafeguard as any);
router.put('/safeguards/:safeguardId', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.updateSafeguard as any);
router.delete('/safeguards/:safeguardId', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.deleteSafeguard as any);
router.post('/milestones/:milestoneId/safeguards/evaluate', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.evaluateSafeguards as any);
router.post('/safeguards/:safeguardId/reset', requirePermission(PERMISSIONS.FEATURE_FLAGS_MANAGE) as any, ReleaseFlowController.resetSafeguard as any);

export default router;
