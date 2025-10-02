import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AdminInvitationController, createInvitationValidation } from '../../controllers/AdminInvitationController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

// POST /api/v1/admin/invitations - 사용자 초대 생성
router.post('/', createInvitationValidation, AdminInvitationController.createInvitation as any);

// GET /api/v1/admin/invitations/current
router.get('/current', AdminInvitationController.getCurrent as any);

// GET /api/v1/admin/invitations - 초대 목록 조회
router.get('/', AdminInvitationController.getInvitations as any);

// DELETE /api/v1/admin/invitations/:id - 초대 삭제
router.delete('/:id', AdminInvitationController.deleteInvitation as any);

export default router;

