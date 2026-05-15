import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { SurveyTemplateController } from '../../controllers/survey-template-controller';

const router = Router();

// All survey template routes require authentication
router.use(authenticate as any);

// Template CRUD
router.get('/', SurveyTemplateController.list);
router.get('/:id', SurveyTemplateController.getById);
router.post('/', SurveyTemplateController.create);
router.put('/:id', SurveyTemplateController.update);
router.delete('/:id', SurveyTemplateController.remove);

// Actions
router.post('/:id/duplicate', SurveyTemplateController.duplicate);
router.patch('/:id/toggle-publish', SurveyTemplateController.togglePublish);

// Responses & Stats
router.get('/:id/responses', SurveyTemplateController.getResponses);
router.get('/:id/stats', SurveyTemplateController.getResponseStats);

export default router;
