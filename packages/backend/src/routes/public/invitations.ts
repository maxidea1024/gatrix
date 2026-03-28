import { Router } from 'express';
import {
  PublicInvitationController,
  acceptInvitationValidation,
} from '../../controllers/public-invitation-controller';

const router = Router();

// GET /api/v1/invitations/validate/:token - Validate invitation token (Public API)
router.get(
  '/validate/:token',
  PublicInvitationController.validateInvitation as any
);

// POST /api/v1/invitations/accept/:token - Accept invitation and register user (Public API)
router.post(
  '/accept/:token',
  acceptInvitationValidation,
  PublicInvitationController.acceptInvitation as any
);

export default router;
