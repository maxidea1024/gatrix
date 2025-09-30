import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { SystemConsoleController } from '../../controllers/SystemConsoleController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/commands', SystemConsoleController.listCommands as any);
router.post('/execute', SystemConsoleController.execute as any);

export default router;

