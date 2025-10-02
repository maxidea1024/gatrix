import { Router } from 'express';
import { ClientVersionController } from '../../controllers/ClientVersionController';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { auditLog } from '../../middleware/auditLog';

const router = Router();

// ëª¨ë“  ?¼ìš°?¸ì— ?¸ì¦ ë¯¸ë“¤?¨ì–´ ?ìš©
router.use((req, res, next) => {
  authenticate(req as any, res, next);
});

// ë©”í??°ì´???¼ìš°??(/:idë³´ë‹¤ ë¨¼ì? ?•ì˜?´ì•¼ ??
// ?Œë«??ëª©ë¡ ì¡°íšŒ (ê´€ë¦¬ìë§?
router.get('/meta/platforms', requireAdmin as any, ClientVersionController.getPlatforms);

// ?¬ìš© ê°€?¥í•œ ë²„ì „ ëª©ë¡ ì¡°íšŒ (ê´€ë¦¬ìë§?
router.get('/meta/versions', requireAdmin as any, ClientVersionController.getAvailableVersions);

// ?´ë¼?´ì–¸??ë²„ì „ ëª©ë¡ ì¡°íšŒ (ê´€ë¦¬ìë§?
router.get('/', requireAdmin as any, ClientVersionController.getClientVersions);

// ?´ë¼?´ì–¸??ë²„ì „ ?´ë³´?´ê¸° (ê´€ë¦¬ìë§?
router.get('/export', requireAdmin as any, ClientVersionController.exportClientVersions);

// ?¼ê´„ ?íƒœ ë³€ê²?(ê´€ë¦¬ìë§?
router.patch('/bulk-status', requireAdmin as any, ClientVersionController.bulkUpdateStatus);

// ?´ë¼?´ì–¸??ë²„ì „ ?ì„¸ ì¡°íšŒ (ê´€ë¦¬ìë§?
router.get('/:id', requireAdmin as any, ClientVersionController.getClientVersionById);

// ?´ë¼?´ì–¸??ë²„ì „ ?ì„± (ê´€ë¦¬ìë§?
router.post('/',
  requireAdmin as any,
  auditLog({
    action: 'client_version_create',
    resourceType: 'client_version',
    getResourceId: (req) => req.body?.version,
    getNewValues: (req) => req.body,
  }) as any,
  ClientVersionController.createClientVersion
);

// ?´ë¼?´ì–¸??ë²„ì „ ê°„í¸ ?ì„± (ê´€ë¦¬ìë§?
router.post('/bulk',
  requireAdmin as any,
  auditLog({
    action: 'client_version_bulk_create',
    resourceType: 'client_version',
    // ?¼ê´„ ?ì„±??ê²½ìš° ?¨ì¼ IDê°€ ?†ìœ¼ë¯€ë¡?getResourceId ?œê±°
    getNewValues: (req) => req.body,
    // ?‘ë‹µ?ì„œ ?ì„±??ì²?ë²ˆì§¸ ?´ë¼?´ì–¸??ë²„ì „??IDë¥??¬ìš©
    getResourceIdFromResponse: (res: any) => res?.data?.[0]?.id,
  }) as any,
  ClientVersionController.bulkCreateClientVersions
);

// ?´ë¼?´ì–¸??ë²„ì „ ?˜ì • (ê´€ë¦¬ìë§?
router.put('/:id',
  requireAdmin as any,
  auditLog({
    action: 'client_version_update',
    resourceType: 'client_version',
    getResourceId: (req) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  ClientVersionController.updateClientVersion
);

// ?´ë¼?´ì–¸??ë²„ì „ ?? œ (ê´€ë¦¬ìë§?
router.delete('/:id',
  requireAdmin as any,
  auditLog({
    action: 'client_version_delete',
    resourceType: 'client_version',
    getResourceId: (req) => req.params?.id,
    getNewValues: () => ({}),
  }) as any,
  ClientVersionController.deleteClientVersion
);

// ?œê·¸ ê´€???¼ìš°??(ê´€ë¦¬ìë§?
router.get('/:id/tags', requireAdmin as any, ClientVersionController.getTags);
router.put('/:id/tags', requireAdmin as any, ClientVersionController.setTags);

export default router;
