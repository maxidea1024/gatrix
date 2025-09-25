import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AdminInvitationController } from '../../controllers/AdminInvitationController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

// GET /api/v1/admin/invitations/current
router.get('/current', AdminInvitationController.getCurrent as any);

export default router;

