import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { SurveyController } from '../../controllers/SurveyController';

const router = Router();

// All survey routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

// Survey configuration routes
router.get('/config', SurveyController.getSurveyConfig);
router.put('/config', SurveyController.updateSurveyConfig);

// Survey CRUD routes
router.get('/', SurveyController.getSurveys);
router.get('/platform/:platformSurveyId', SurveyController.getSurveyByPlatformId);
router.get('/:id', SurveyController.getSurveyById);
router.post('/', SurveyController.createSurvey);
router.put('/:id', SurveyController.updateSurvey);
router.delete('/:id', SurveyController.deleteSurvey);
router.patch('/:id/toggle-active', SurveyController.toggleActive);

export default router;
