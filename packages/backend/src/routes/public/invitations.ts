import { Router } from 'express';
import {
  PublicInvitationController,
  acceptInvitationValidation,
} from '../../controllers/public-invitation-controller';

const router = Router();

// GET /api/v1/invitations/validate/:token - 초대 Verify token (Public API)
router.get(
  '/validate/:token',
  PublicInvitationController.validateInvitation as any
);

// POST /api/v1/invitations/accept/:token - 초대 수락 및 Used자 Register (Public API)
router.post(
  '/accept/:token',
  acceptInvitationValidation,
  PublicInvitationController.acceptInvitation as any
);

export default router;
