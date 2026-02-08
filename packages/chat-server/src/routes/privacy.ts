import { Router } from 'express';
import { UserPrivacyController } from '../controllers/UserPrivacyController';
import { authenticate, rateLimiter } from '../middleware/auth';

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 현재 사용자의 프라이버시 설정 조회
router.get(
  '/settings',
  rateLimiter(60000, 60), // 1분에 60회 요청 제한
  UserPrivacyController.getMySettings
);

// 프라이버시 설정 업데이트
router.put(
  '/settings',
  rateLimiter(60000, 30), // 1분에 30회 업데이트 제한
  UserPrivacyController.updateSettings
);

// 사용자 차단
router.post(
  '/block',
  rateLimiter(60000, 20), // 1분에 20회 차단 제한
  UserPrivacyController.blockUser
);

// 사용자 차단 해제
router.post(
  '/unblock',
  rateLimiter(60000, 20), // 1분에 20회 차단 해제 제한
  UserPrivacyController.unblockUser
);

// 차단된 사용자 목록 조회
router.get(
  '/blocked-users',
  rateLimiter(60000, 30), // 1분에 30회 요청 제한
  UserPrivacyController.getBlockedUsers
);

// 초대 가능 여부 확인 (내부 API)
router.post(
  '/check-invite-permission',
  rateLimiter(60000, 100), // 1분에 100회 확인 제한
  UserPrivacyController.checkInvitePermission
);

export default router;
