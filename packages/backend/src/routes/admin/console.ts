import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { SystemConsoleController } from '../../controllers/system-console-controller';

const router = Router();

router.use(authenticate as any);
router.get('/commands', SystemConsoleController.listCommands as any);
router.post('/execute', SystemConsoleController.execute as any);

export default router;
