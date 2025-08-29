import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { IpWhitelistController } from '../controllers/IpWhitelistController';

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
    action: 'ip_whitelist_create',
    resourceType: 'ip_whitelist',
    getResourceId: (req) => req.body?.ipAddress,
    getDetails: (req) => ({
      ipAddress: req.body?.ipAddress,
      purpose: req.body?.purpose,
      isEnabled: req.body?.isEnabled,
    }),
  }) as any,
  IpWhitelistController.createIpWhitelist
);

router.post('/bulk',
  auditLog({
    action: 'ip_whitelist_bulk_create',
    resourceType: 'ip_whitelist',
    getResourceId: (req) => `bulk_${req.body?.entries?.length || 0}_entries`,
    getDetails: (req) => ({
      entriesCount: req.body?.entries?.length || 0,
      entries: req.body?.entries?.map((e: any) => ({
        ipAddress: e.ipAddress,
        purpose: e.purpose,
      })) || [],
    }),
  }) as any,
  IpWhitelistController.bulkCreateIpWhitelists
);

router.put('/:id',
  auditLog({
    action: 'ip_whitelist_update',
    resourceType: 'ip_whitelist',
    getResourceId: (req) => req.params?.id,
    getDetails: (req) => ({
      ipWhitelistId: req.params?.id,
      updates: req.body,
    }),
  }) as any,
  IpWhitelistController.updateIpWhitelist
);

router.patch('/:id/toggle',
  auditLog({
    action: 'ip_whitelist_toggle_status',
    resourceType: 'ip_whitelist',
    getResourceId: (req) => req.params?.id,
    getDetails: (req) => ({
      ipWhitelistId: req.params?.id,
    }),
  }) as any,
  IpWhitelistController.toggleIpWhitelistStatus
);

router.delete('/:id',
  auditLog({
    action: 'ip_whitelist_delete',
    resourceType: 'ip_whitelist',
    getResourceId: (req) => req.params?.id,
    getDetails: (req) => ({
      ipWhitelistId: req.params?.id,
    }),
  }) as any,
  IpWhitelistController.deleteIpWhitelist
);

export default router;
