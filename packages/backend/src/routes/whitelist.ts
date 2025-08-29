import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { WhitelistController } from '../controllers/WhitelistController';
import { auditLog } from '../middleware/auditLog';

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
    getResourceId: (req) => req.body?.nickname,
    getDetails: (req) => ({
      nickname: req.body?.nickname,
      ipAddress: req.body?.ipAddress,
    }),
  }) as any,
  WhitelistController.createWhitelist
);
router.put('/:id',
  auditLog({
    action: 'whitelist_update',
    resourceType: 'whitelist',
    getResourceId: (req) => req.params?.id,
    getDetails: (req) => ({
      whitelistId: req.params?.id,
      updates: req.body,
    }),
  }) as any,
  WhitelistController.updateWhitelist
);
router.delete('/:id',
  auditLog({
    action: 'whitelist_delete',
    resourceType: 'whitelist',
    getResourceId: (req) => req.params?.id,
    getDetails: (req) => ({
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
    getDetails: (req) => ({
      entriesCount: req.body?.entries?.length || 0,
    }),
  }) as any,
  WhitelistController.bulkCreateWhitelists
);

// 태그 관련 라우트 (관리자만)
router.get('/:id/tags', requireAdmin as any, WhitelistController.getTags);
router.put('/:id/tags', requireAdmin as any, WhitelistController.setTags);

export default router;
