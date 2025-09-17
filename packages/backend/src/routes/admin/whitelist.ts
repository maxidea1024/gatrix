import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { WhitelistController } from '../../controllers/WhitelistController';
import { auditLog } from '../../middleware/auditLog';

const router = Router();

// All whitelist routes require authentication and admin privileges
router.use(authenticate as any);
router.use(requireAdmin as any);

// Whitelist management routes
router.get('/', WhitelistController.getWhitelists);
router.get('/:id', WhitelistController.getWhitelistById);
router.post('/',
  auditLog({
    action: 'whitelist_create',
    resourceType: 'whitelist',
    // ?”ì´?¸ë¦¬?¤íŠ¸ ?ì„± ?œì—??IDê°€ ?„ì§ ?†ìœ¼ë¯€ë¡?getResourceId ?œê±°
    getNewValues: (req) => req.body,
    getResourceIdFromResponse: (res: any) => res?.data?.id,
  }) as any,
  WhitelistController.createWhitelist
);
router.put('/:id',
  auditLog({
    action: 'whitelist_update',
    resourceType: 'whitelist',
    getResourceId: (req) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  WhitelistController.updateWhitelist
);
router.delete('/:id',
  auditLog({
    action: 'whitelist_delete',
    resourceType: 'whitelist',
    getResourceId: (req) => req.params?.id,
    getNewValues: (req) => ({
      whitelistId: req.params?.id,
    }),
  }) as any,
  WhitelistController.deleteWhitelist
);

// Bulk operations
router.post('/bulk',
  auditLog({
    action: 'whitelist_bulk_create',
    resourceType: 'whitelist',
    getNewValues: (req) => req.body,
  }) as any,
  WhitelistController.bulkCreateWhitelists
);

// ?”ì´?¸ë¦¬?¤íŠ¸ ?ŒìŠ¤???¼ìš°??router.post('/test', WhitelistController.testWhitelist);

// ?œê·¸ ê´€???¼ìš°??(ê´€ë¦¬ìë§?
router.get('/:id/tags', requireAdmin as any, WhitelistController.getTags);
router.put('/:id/tags', requireAdmin as any, WhitelistController.setTags);

export default router;
