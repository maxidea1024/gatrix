import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { PlatformDefaultsController } from '../../controllers/PlatformDefaultsController';

const router = Router();

// 모든 ?�우?�에 ?�증 �?관리자 권한 ?�요
router.use(authenticate as any);
router.use(requireAdmin as any);

// 모든 ?�랫?�의 기본�?조회/?�정
router.get('/', PlatformDefaultsController.getAllDefaults as any);
router.put('/', PlatformDefaultsController.setAllDefaults as any);

// ?�정 ?�랫?�의 기본�?조회/?�정/??��
router.get('/:platform', PlatformDefaultsController.getPlatformDefaults as any);
router.put('/:platform', PlatformDefaultsController.setPlatformDefaults as any);
router.delete('/:platform', PlatformDefaultsController.deletePlatformDefaults as any);

export default router;
