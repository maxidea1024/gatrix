import { Router } from 'express';
import { OperationEventController } from '../../controllers/operation-event-controller';

const router = Router();

// HotTimeBuff overrides
router.get(
  '/hottime-overrides',
  OperationEventController.getHottimeOverrides as any
);
router.put(
  '/hottime-overrides',
  OperationEventController.applyHottimeOverrides as any
);
router.delete(
  '/hottime-overrides/:cmsId',
  OperationEventController.deleteHottimeOverride as any
);

export default router;
