import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { TranslationController } from '../../controllers/TranslationController';

const router = Router();

// 모든 번역 API???�증???�용?�만 ?�용 가??router.use(authenticate as any);

// ?�일 ?�어 번역
router.post('/translate', TranslationController.translateText);

// ?�중 ?�어 번역
router.post('/translate/multiple', TranslationController.translateToMultipleLanguages);

// ?�어 감�?
router.post('/detect-language', TranslationController.detectLanguage);

export default router;
