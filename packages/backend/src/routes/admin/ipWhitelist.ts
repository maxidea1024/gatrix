import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { auditLog } from '../../middleware/auditLog';
import { IpWhitelistController } from '../../controllers/IpWhitelistController';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authenticate as any);
router.use(requireAdmin as any);

// IP Whitelist management routes
router.get('/', IpWhitelistController.getIpWhitelists);
router.get('/check', IpWhitelistController.checkIpWhitelist);
router.get('/:id', IpWhitelistController.getIpWhitelistById);

router.post('/',
  auditLog({
    action: 'whitelist_create',
    resourceType: 'whitelist',
    getResourceId: (req: any) => req.body?.ip,
    getNewValues: (req) => req.body,
  }) as any,
  IpWhitelistController.createIpWhitelist
);

router.post('/bulk',
  auditLog({
    action: 'whitelist_bulk_create',
    resourceType: 'whitelist',
    getResourceId: (req: any) => `bulk_${req.body?.entries?.length || 0}_entries`,
    getNewValues: (req: any) => req.body,
  }) as any,
  IpWhitelistController.bulkCreateIpWhitelists
);

router.put('/:id',
  auditLog({
    action: 'whitelist_update',
    resourceType: 'whitelist',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  IpWhitelistController.updateIpWhitelist
);

router.patch('/:id/toggle',
  auditLog({
    action: 'whitelist_toggle_status',
    resourceType: 'whitelist',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req: any) => ({
      id: req.params?.id,
    }),
  }) as any,
  IpWhitelistController.toggleIpWhitelistStatus
);

router.delete('/:id',
  auditLog({
    action: 'whitelist_delete',
    resourceType: 'whitelist',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req: any) => ({
      id: req.params?.id,
    }),
  }) as any,
  IpWhitelistController.deleteIpWhitelist
);

// bulk delete ê¸°ëŠ¥??êµ¬í˜„?˜ì? ?ŠìŒ

export default router;
