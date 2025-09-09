import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { PlatformDefaultsController } from '../controllers/PlatformDefaultsController';

const router = Router();

// 모든 라우트에 인증 및 관리자 권한 필요
router.use(authenticate as any);
router.use(requireAdmin as any);

// 모든 플랫폼의 기본값 조회/설정
router.get('/', PlatformDefaultsController.getAllDefaults as any);
router.put('/', PlatformDefaultsController.setAllDefaults as any);

// 특정 플랫폼의 기본값 조회/설정/삭제
router.get('/:platform', PlatformDefaultsController.getPlatformDefaults as any);
router.put('/:platform', PlatformDefaultsController.setPlatformDefaults as any);
router.delete('/:platform', PlatformDefaultsController.deletePlatformDefaults as any);

export default router;
