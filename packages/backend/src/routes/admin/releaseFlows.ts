import express from 'express';
import { ReleaseFlowController } from '../../controllers/ReleaseFlowController';
import { requireOrgPermission, requireProjectPermission, requireEnvPermission } from '../../middleware/auth';
import { P } from '@gatrix/shared/permissions';

const router = express.Router();

// Templates management
router.get('/templates', ReleaseFlowController.listTemplates as any);
router.get('/templates/:id', ReleaseFlowController.getTemplate as any);
router.post(
  '/templates',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.createTemplate as any
);
router.put(
  '/templates/:id',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.updateTemplate as any
);
router.delete(
  '/templates/:id',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.deleteTemplate as any
);

// Apply template to flag
router.post(
  '/apply',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.applyTemplate as any
);

// Plans management
router.get('/plans/flag/:flagId', ReleaseFlowController.getPlansByFlag as any);
router.get('/plans/:flagId/:environmentId', ReleaseFlowController.getPlan as any);
router.post(
  '/plans/:planId/milestones/:milestoneId/start',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.startMilestone as any
);

// Plan lifecycle
router.delete(
  '/plans/:id',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.deletePlan as any
);
router.post(
  '/plans/:id/start',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.startPlan as any
);
router.post(
  '/plans/:id/pause',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.pausePlan as any
);
router.post(
  '/plans/:id/resume',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.resumePlan as any
);
router.post(
  '/plans/:id/progress',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.progressToNext as any
);

// Milestone transition conditions
router.put(
  '/milestones/:milestoneId/transition',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.setTransitionCondition as any
);
router.delete(
  '/milestones/:milestoneId/transition',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.removeTransitionCondition as any
);

// Safeguards (per-milestone)
router.get('/milestones/:milestoneId/safeguards', ReleaseFlowController.listSafeguards as any);
router.post(
  '/safeguards',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.createSafeguard as any
);
router.put(
  '/safeguards/:safeguardId',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.updateSafeguard as any
);
router.delete(
  '/safeguards/:safeguardId',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.deleteSafeguard as any
);
router.post(
  '/milestones/:milestoneId/safeguards/evaluate',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.evaluateSafeguards as any
);
router.post(
  '/safeguards/:safeguardId/reset',
  requireOrgPermission(P.FEATURES_UPDATE) as any,
  ReleaseFlowController.resetSafeguard as any
);

export default router;
