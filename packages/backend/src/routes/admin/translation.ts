import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { TranslationController } from '../../controllers/TranslationController';

const router = Router();

// 紐⑤뱺 踰덉뿭 API???몄쬆???ъ슜?먮쭔 ?ъ슜 媛??router.use(authenticate as any);

// ?⑥씪 ?몄뼱 踰덉뿭
router.post('/translate', TranslationController.translateText);

// ?ㅼ쨷 ?몄뼱 踰덉뿭
router.post('/translate/multiple', TranslationController.translateToMultipleLanguages);

// ?몄뼱 媛먯?
router.post('/detect-language', TranslationController.detectLanguage);

export default router;
