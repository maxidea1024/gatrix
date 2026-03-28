import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { MessageTemplateController } from '../../controllers/message-template-controller';
import { auditLog } from '../../middleware/audit-log';

const router = Router();

router.use(authenticate as any);
router.get('/', MessageTemplateController.list as any);
router.get('/:id', MessageTemplateController.get as any);
router.post(
  '/',
  auditLog({
    action: 'message_template_create',
    resourceType: 'message_template',
    // ID does not exist yet before message template creation, so getResourceId is removed
    getNewValues: (req) => req.body,
    getResourceIdFromResponse: (res: any) => res?.data?.id,
  }) as any,
  MessageTemplateController.create as any
);
router.post(
  '/bulk-delete',
  auditLog({
    action: 'message_template_bulk_delete',
    resourceType: 'message_template',
    getNewValues: (req) => req.body,
  }) as any,
  MessageTemplateController.bulkDelete as any
);
router.put(
  '/:id',
  auditLog({
    action: 'message_template_update',
    resourceType: 'message_template',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  MessageTemplateController.update as any
);
router.delete(
  '/:id',
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

export default router;
