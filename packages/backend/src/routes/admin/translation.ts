import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { TranslationController } from '../../controllers/translation-controller';

const router = Router();

router.post('/translate', TranslationController.translateText);
router.post(
  '/translate/multiple',
  TranslationController.translateToMultipleLanguages
);
router.post('/detect-language', TranslationController.detectLanguage);

export default router;
