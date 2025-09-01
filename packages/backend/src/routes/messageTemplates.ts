import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { MessageTemplateController } from '../controllers/MessageTemplateController';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

router.get('/', MessageTemplateController.list as any);
router.get('/:id', MessageTemplateController.get as any);
router.post('/',
  auditLog({
    action: 'message_template_create',
    resourceType: 'message_template',
    getResourceId: (req: any) => req.body?.name,
    getNewValues: (req) => req.body,
  }) as any,
  MessageTemplateController.create as any
);
router.post('/bulk-delete',
  auditLog({
    action: 'message_template_bulk_delete',
    resourceType: 'message_template',
    getNewValues: (req) => req.body,
  }) as any,
  MessageTemplateController.bulkDelete as any
);
router.put('/:id',
  auditLog({
    action: 'message_template_update',
    resourceType: 'message_template',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  MessageTemplateController.update as any
);
router.delete('/:id',
  auditLog({
    action: 'message_template_delete',
    resourceType: 'message_template',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req: any) => ({
      id: req.params?.id,
    }),
  }) as any,
  MessageTemplateController.remove as any
);

// 태그 관련 라우트 (관리자만)
router.get('/:id/tags', MessageTemplateController.getTags as any);
router.put('/:id/tags',
  auditLog({
    action: 'message_template_set_tags',
    resourceType: 'message_template',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  MessageTemplateController.setTags as any
);

export default router;

