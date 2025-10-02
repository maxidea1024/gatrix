import { Router } from 'express';
import { ClientVersionController } from '../../controllers/ClientVersionController';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { auditLog } from '../../middleware/auditLog';

const router = Router();

// 모든 ?�우?�에 ?�증 미들?�어 ?�용
router.use((req, res, next) => {
  authenticate(req as any, res, next);
});

// 메�??�이???�우??(/:id보다 먼�? ?�의?�야 ??
// ?�랫??목록 조회 (관리자�?
router.get('/meta/platforms', requireAdmin as any, ClientVersionController.getPlatforms);

// ?�용 가?�한 버전 목록 조회 (관리자�?
router.get('/meta/versions', requireAdmin as any, ClientVersionController.getAvailableVersions);

// ?�라?�언??버전 목록 조회 (관리자�?
router.get('/', requireAdmin as any, ClientVersionController.getClientVersions);

// ?�라?�언??버전 ?�보?�기 (관리자�?
router.get('/export', requireAdmin as any, ClientVersionController.exportClientVersions);

// ?�괄 ?�태 변�?(관리자�?
router.patch('/bulk-status', requireAdmin as any, ClientVersionController.bulkUpdateStatus);

// ?�라?�언??버전 ?�세 조회 (관리자�?
router.get('/:id', requireAdmin as any, ClientVersionController.getClientVersionById);

// ?�라?�언??버전 ?�성 (관리자�?
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

// ?�라?�언??버전 간편 ?�성 (관리자�?
router.post('/bulk',
  requireAdmin as any,
  auditLog({
    action: 'client_version_bulk_create',
    resourceType: 'client_version',
    // ?�괄 ?�성??경우 ?�일 ID가 ?�으므�?getResourceId ?�거
    getNewValues: (req) => req.body,
    // ?�답?�서 ?�성??�?번째 ?�라?�언??버전??ID�??�용
    getResourceIdFromResponse: (res: any) => res?.data?.[0]?.id,
  }) as any,
  ClientVersionController.bulkCreateClientVersions
);

// ?�라?�언??버전 ?�정 (관리자�?
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

// ?�라?�언??버전 ??�� (관리자�?
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

// ?�그 관???�우??(관리자�?
router.get('/:id/tags', requireAdmin as any, ClientVersionController.getTags);
router.put('/:id/tags', requireAdmin as any, ClientVersionController.setTags);

export default router;
