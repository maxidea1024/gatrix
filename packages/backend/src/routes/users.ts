import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate as any);

// 사용자 검색 (채팅 시스템용)
router.get(
  '/search',
  generalLimiter as any, // Rate limiting
  UserController.searchUsers
);

// 현재 사용자 정보 조회
router.get(
  '/me',
  generalLimiter as any, // Rate limiting
  UserController.getCurrentUser
);

// 현재 사용자 정보 업데이트
router.put(
  '/me',
  generalLimiter as any, // Rate limiting
  UserController.updateCurrentUser
);

export default router;
