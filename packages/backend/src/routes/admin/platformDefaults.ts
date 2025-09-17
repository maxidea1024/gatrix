import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { PlatformDefaultsController } from '../../controllers/PlatformDefaultsController';

const router = Router();

// ëª¨ë“  ?¼ìš°?¸ì— ?¸ì¦ ë°?ê´€ë¦¬ì ê¶Œí•œ ?„ìš”
router.use(authenticate as any);
router.use(requireAdmin as any);

// ëª¨ë“  ?Œë«?¼ì˜ ê¸°ë³¸ê°?ì¡°íšŒ/?¤ì •
router.get('/', PlatformDefaultsController.getAllDefaults as any);
router.put('/', PlatformDefaultsController.setAllDefaults as any);

// ?¹ì • ?Œë«?¼ì˜ ê¸°ë³¸ê°?ì¡°íšŒ/?¤ì •/?? œ
router.get('/:platform', PlatformDefaultsController.getPlatformDefaults as any);
router.put('/:platform', PlatformDefaultsController.setPlatformDefaults as any);
router.delete('/:platform', PlatformDefaultsController.deletePlatformDefaults as any);

export default router;
