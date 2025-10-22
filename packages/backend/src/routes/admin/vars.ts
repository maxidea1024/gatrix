import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { VarsController } from '../../controllers/VarsController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

// KV management routes (must come before /:key to avoid conflicts)
router.get('/kv', VarsController.getAllKV as any);
router.post('/kv', VarsController.createKV as any);
router.get('/kv/:key', VarsController.getKV as any);
router.put('/kv/:key', VarsController.updateKV as any);
router.delete('/kv/:key', VarsController.deleteKV as any);

// Legacy single var routes
router.get('/:key', VarsController.getVar as any);
router.put('/:key', VarsController.setVar as any);

export default router;

