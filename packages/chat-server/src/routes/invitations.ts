import { Router } from 'express';
import { InvitationController } from '../controllers/InvitationController';
import { authenticate, rateLimiter } from '../middleware/auth';

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 내가 받은 초대 목록 조회
router.get(
  '/received',
  rateLimiter(60000, 60), // 1분에 60회 요청 제한
  InvitationController.getMyInvitations
);

// 내가 보낸 초대 목록 조회
router.get(
  '/sent',
  rateLimiter(60000, 60), // 1분에 60회 요청 제한
  InvitationController.getMySentInvitations
);

// 초대 응답 (수락/거절)
router.post(
  '/:invitationId/respond',
  rateLimiter(60000, 30), // 1분에 30회 응답 제한
  InvitationController.respondToInvitation
);

// 초대 취소
router.delete(
  '/:invitationId',
  rateLimiter(60000, 20), // 1분에 20회 취소 제한
  InvitationController.cancelInvitation
);

export default router;
