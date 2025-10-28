import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { RewardTemplateController } from '../../controllers/RewardTemplateController';

const router = Router();

// All reward template routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

// Reward template CRUD routes
router.get('/', RewardTemplateController.getRewardTemplates);
router.get('/:id/references', RewardTemplateController.checkReferences);
router.get('/:id', RewardTemplateController.getRewardTemplateById);
router.post('/', RewardTemplateController.createRewardTemplate);
router.put('/:id', RewardTemplateController.updateRewardTemplate);
router.delete('/:id', RewardTemplateController.deleteRewardTemplate);

export default router;

