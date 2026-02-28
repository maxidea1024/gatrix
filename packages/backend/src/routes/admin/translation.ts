import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { TranslationController } from '../../controllers/TranslationController';

const router = Router();

router.post('/translate', TranslationController.translateText);
router.post('/translate/multiple', TranslationController.translateToMultipleLanguages);
router.post('/detect-language', TranslationController.detectLanguage);

export default router;
