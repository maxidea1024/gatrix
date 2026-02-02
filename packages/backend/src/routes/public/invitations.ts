import { Router } from "express";
import {
  PublicInvitationController,
  acceptInvitationValidation,
} from "../../controllers/PublicInvitationController";

const router = Router();

// GET /api/v1/invitations/validate/:token - 초대 토큰 검증 (공개 API)
router.get(
  "/validate/:token",
  PublicInvitationController.validateInvitation as any,
);

// POST /api/v1/invitations/accept/:token - 초대 수락 및 사용자 등록 (공개 API)
router.post(
  "/accept/:token",
  acceptInvitationValidation,
  PublicInvitationController.acceptInvitation as any,
);

export default router;
