import { Router } from 'express';
import { ClientVersionController } from '../../controllers/client-version-controller';
import { authenticate } from '../../middleware/auth';
import { auditLog } from '../../middleware/audit-log';

const router = Router();

// Apply authentication middleware to all routes
router.use((req, res, next) => {
  authenticate(req as any, res, next);
});

// Meta routes (must be defined before /:id)
// Get platform list (admin)
router.get(
  '/meta/platforms' as any,
  ClientVersionController.getPlatforms as any
);

// Get available version list (admin)
router.get(
  '/meta/versions' as any,
  ClientVersionController.getAvailableVersions as any
);

// Get client version list (admin)
router.get('/' as any, ClientVersionController.getClientVersions as any);

// Export client versions (admin)
router.get(
  '/export' as any,
  ClientVersionController.exportClientVersions as any
);


// Bulk status update (admin)
router.patch(
  '/bulk-status' as any,
  ClientVersionController.bulkUpdateStatus as any
);

// Get client version detail (admin)
router.get('/:id' as any, ClientVersionController.getClientVersionById as any);

// Create client version (admin)
router.post(
  '/' as any,
  auditLog({
    action: 'client_version_create',
    resourceType: 'client_version',
    getResourceId: (req) => req.body?.version,
    getNewValues: (req) => req.body,
    getDescription: (req) =>
      `Client version '${req.body?.clientVersion}' (${req.body?.platform}) created with status '${req.body?.clientStatus}'`,
  }) as any,
  ClientVersionController.createClientVersion as any
);

// Bulk create client versions (admin)
router.post(
  '/bulk' as any,
  auditLog({
    action: 'client_version_bulk_create',
    resourceType: 'client_version',
    getNewValues: (req) => req.body,
    getResourceIdFromResponse: (res: any) => res?.data?.[0]?.id,
    getDescription: (req) =>
      `${req.body?.versions?.length || 0} client version(s) bulk created`,
  }) as any,
  ClientVersionController.bulkCreateClientVersions as any
);

// Update client version (admin)
router.put(
  '/:id' as any,
  auditLog({
    action: 'client_version_update',
    resourceType: 'client_version',
    getResourceId: (req) => req.params?.id,
    getNewValues: (req) => req.body,
    getDescription: (req) =>
      `Client version #${req.params?.id} updated${req.body?.clientStatus ? ` (status: ${req.body.clientStatus})` : ''}`,
  }) as any,
  ClientVersionController.updateClientVersion as any
);

// Delete client version (admin)
router.delete(
  '/:id' as any,
  auditLog({
    action: 'client_version_delete',
    resourceType: 'client_version',
    getResourceId: (req) => req.params?.id,
    getNewValues: () => ({}),
    getDescription: (req) => `Client version #${req.params?.id} deleted`,
  }) as any,
  ClientVersionController.deleteClientVersion as any
);

// Tag routes (admin)
router.get('/:id/tags' as any, ClientVersionController.getTags as any);
router.put('/:id/tags' as any, ClientVersionController.setTags as any);

// Reset all client versions and cache (for testing)
router.delete(
  '/reset/all' as any,
  ClientVersionController.resetAllClientVersions as any
);

export default router;
