import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { MessageTemplateController } from '../controllers/MessageTemplateController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/', MessageTemplateController.list as any);
router.get('/:id', MessageTemplateController.get as any);
router.post('/', MessageTemplateController.create as any);
router.post('/bulk-delete', MessageTemplateController.bulkDelete as any);
router.put('/:id', MessageTemplateController.update as any);
router.delete('/:id', MessageTemplateController.remove as any);

export default router;

