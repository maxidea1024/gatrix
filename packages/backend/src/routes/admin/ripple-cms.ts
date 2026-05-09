import { Router } from 'express';
import { RippleCmsController } from '../../controllers/ripple-cms-controller';

const router = Router();

// ── Ripple Monitoring ──
router.get('/ripple/status', RippleCmsController.getRippleStatus);
router.post('/ripple/refresh', RippleCmsController.triggerRefresh);
router.get('/ripple/metrics', RippleCmsController.getRippleMetrics);
router.get('/ripple/history', RippleCmsController.getRippleHistory);
router.delete('/ripple/history', RippleCmsController.clearRippleHistory);

// ── CMS Data Management ──
router.get('/cms/tables', RippleCmsController.getCmsTables);
router.get('/cms/tables/:tableName', RippleCmsController.getCmsTableDetail);
router.get(
  '/cms/tables/:tableName/history',
  RippleCmsController.getCmsTableHistory
);
router.get(
  '/cms/tables/:tableName/history/:version/data',
  RippleCmsController.getCmsTableVersionData
);
router.get(
  '/cms/tables/:tableName/history/:version/diff',
  RippleCmsController.getCmsTableVersionDiff
);
router.post('/cms/upload', RippleCmsController.uploadCmsTable);
router.post('/cms/rollback', RippleCmsController.rollbackCmsTable);
router.get('/cms/refresh-history', RippleCmsController.getCmsRefreshHistory);

export default router;
