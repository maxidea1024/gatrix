import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { TagController } from '../controllers/TagController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/', TagController.list as any);
router.post('/', TagController.create as any);
router.put('/:id', TagController.update as any);
router.delete('/:id', TagController.delete as any);

// Generic assignments
router.get('/assignments', TagController.listForEntity as any);
router.put('/assignments', TagController.setForEntity as any);

export default router;

