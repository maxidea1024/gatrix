import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { TagController } from '../controllers/TagController';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/', TagController.list as any);
router.post('/',
  auditLog({
    action: 'tag_create',
    resourceType: 'tag',
    getResourceId: (req: any) => req.body?.name,
    getDetails: (req: any) => ({
      name: req.body?.name,
      color: req.body?.color,
      body: req.body,
    }),
  }) as any,
  TagController.create as any
);
router.put('/:id',
  auditLog({
    action: 'tag_update',
    resourceType: 'tag',
    getResourceId: (req: any) => req.params?.id,
    getDetails: (req: any) => ({
      id: req.params?.id,
      updates: req.body,
    }),
  }) as any,
  TagController.update as any
);
router.delete('/:id',
  auditLog({
    action: 'tag_delete',
    resourceType: 'tag',
    getResourceId: (req: any) => req.params?.id,
    getDetails: (req: any) => ({
      id: req.params?.id,
    }),
  }) as any,
  TagController.delete as any
);

// Generic assignments
router.get('/assignments', TagController.listForEntity as any);
router.put('/assignments', TagController.setForEntity as any);

export default router;

