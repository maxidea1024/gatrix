import { Router } from 'express';
import { AdminController } from '../../controllers/admin-controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All audit log routes require admin authentication
router.use(authenticate as any);

router.get('/', AdminController.getAuditLogs as any);

router.get('/stats', AdminController.getAuditStats as any);

export default router;
