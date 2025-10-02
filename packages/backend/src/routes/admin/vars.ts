import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { VarsController } from '../../controllers/VarsController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/:key', VarsController.getVar as any);
router.put('/:key', VarsController.setVar as any);

export default router;

