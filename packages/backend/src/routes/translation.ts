import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { TranslationController } from '../controllers/TranslationController';

const router = Router();

// 모든 번역 API는 인증된 사용자만 사용 가능
router.use(authenticate as any);

// 단일 언어 번역
router.post('/translate', TranslationController.translateText);

// 다중 언어 번역
router.post('/translate/multiple', TranslationController.translateToMultipleLanguages);

// 언어 감지
router.post('/detect-language', TranslationController.detectLanguage);

export default router;
