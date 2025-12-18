import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { PlatformDefaultsController } from '../../controllers/PlatformDefaultsController';

const router = Router();

// 紐⑤뱺 ?쇱슦?몄뿉 ?몄쬆 諛?愿由ъ옄 沅뚰븳 ?꾩슂
router.use(authenticate as any);
router.use(requireAdmin as any);

// 紐⑤뱺 ?뚮옯?쇱쓽 湲곕낯媛?議고쉶/?ㅼ젙
router.get('/', PlatformDefaultsController.getAllDefaults as any);
router.put('/', PlatformDefaultsController.setAllDefaults as any);

// ?뱀젙 ?뚮옯?쇱쓽 湲곕낯媛?議고쉶/?ㅼ젙/??젣
router.get('/:platform', PlatformDefaultsController.getPlatformDefaults as any);
router.put('/:platform', PlatformDefaultsController.setPlatformDefaults as any);
router.delete('/:platform', PlatformDefaultsController.deletePlatformDefaults as any);

export default router;
