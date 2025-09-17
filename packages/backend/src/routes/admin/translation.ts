import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { TranslationController } from '../../controllers/TranslationController';

const router = Router();

// ëª¨ë“  ë²ˆì—­ API???¸ì¦???¬ìš©?ë§Œ ?¬ìš© ê°€??router.use(authenticate as any);

// ?¨ì¼ ?¸ì–´ ë²ˆì—­
router.post('/translate', TranslationController.translateText);

// ?¤ì¤‘ ?¸ì–´ ë²ˆì—­
router.post('/translate/multiple', TranslationController.translateToMultipleLanguages);

// ?¸ì–´ ê°ì?
router.post('/detect-language', TranslationController.detectLanguage);

export default router;
