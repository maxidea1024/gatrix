import { Router } from 'express';
import { ApiTokenController } from '../controllers/api-token-controller';
import { authenticateApiToken, requireAdmin } from '../middleware/api-auth';

const router = Router();

// 모든 라우트에 API 토큰 인증 적용
router.use(authenticateApiToken);

// 토큰 생성 (API 토큰 인증만 필요)
router.post('/', ApiTokenController.createToken);

// 관리자 권한이 필요한 라우트들
router.get('/', requireAdmin, ApiTokenController.listTokens);
router.delete('/:token', requireAdmin, ApiTokenController.revokeToken);
router.post('/verify', ApiTokenController.verifyToken);

export default router;
