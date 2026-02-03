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
router.post(
  '/',
  auditLog({
    action: 'whitelist_create',
    resourceType: 'whitelist',
    // ?�이?�리?�트 ?�성 ?�에??ID가 ?�직 ?�으므�?getResourceId ?�거
    getNewValues: (req) => req.body,
    getResourceIdFromResponse: (res: any) => res?.data?.id,
  }) as any,
  WhitelistController.createWhitelist
);
router.put(
  '/:id',
  auditLog({
    action: 'whitelist_update',
    resourceType: 'whitelist',
    getResourceId: (req) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  WhitelistController.updateWhitelist
);
router.delete(
  '/:id',
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

router.patch(
  '/:id/toggle',
  auditLog({
    action: 'whitelist_toggle',
    resourceType: 'whitelist',
    getResourceId: (req) => req.params?.id,
    getNewValues: (req, res: any) => ({
      isEnabled: res?.data?.isEnabled,
    }),
  }) as any,
  WhitelistController.toggleWhitelistStatus
);

// Bulk operations
router.post(
  '/bulk',
  auditLog({
    action: 'whitelist_bulk_create',
    resourceType: 'whitelist',
    getNewValues: (req) => req.body,
  }) as any,
  WhitelistController.bulkCreateWhitelists
);

// ?�이?�리?�트 ?�스???�우??router.post('/test', WhitelistController.testWhitelist);

// ?�그 관???�우??(관리자�?
router.get('/:id/tags', requireAdmin as any, WhitelistController.getTags);
router.put('/:id/tags', requireAdmin as any, WhitelistController.setTags);

export default router;
