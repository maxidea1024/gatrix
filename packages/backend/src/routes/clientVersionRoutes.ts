import { Router } from 'express';
import { ClientVersionController } from '../controllers/ClientVersionController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use((req, res, next) => {
  authenticate(req as any, res, next);
});

// 메타데이터 라우트 (/:id보다 먼저 정의해야 함)
// 플랫폼 목록 조회 (관리자만)
router.get('/meta/platforms', requireAdmin as any, ClientVersionController.getPlatforms);

// 사용 가능한 버전 목록 조회 (관리자만)
router.get('/meta/versions', requireAdmin as any, ClientVersionController.getAvailableVersions);

// 클라이언트 버전 목록 조회 (관리자만)
router.get('/', requireAdmin as any, ClientVersionController.getClientVersions);

// 클라이언트 버전 내보내기 (관리자만)
router.get('/export', requireAdmin as any, ClientVersionController.exportClientVersions);

// 일괄 상태 변경 (관리자만)
router.patch('/bulk-status', requireAdmin as any, ClientVersionController.bulkUpdateStatus);

// 클라이언트 버전 상세 조회 (관리자만)
router.get('/:id', requireAdmin as any, ClientVersionController.getClientVersionById);

// 클라이언트 버전 생성 (관리자만)
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

// 클라이언트 버전 간편 생성 (관리자만)
router.post('/bulk',
  requireAdmin as any,
  auditLog({
    action: 'client_version_bulk_create',
    resourceType: 'client_version',
    // 일괄 생성의 경우 단일 ID가 없으므로 getResourceId 제거
    getNewValues: (req) => req.body,
    // 응답에서 생성된 첫 번째 클라이언트 버전의 ID를 사용
    getResourceIdFromResponse: (res: any) => res?.data?.[0]?.id,
  }) as any,
  ClientVersionController.bulkCreateClientVersions
);

// 클라이언트 버전 수정 (관리자만)
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

// 클라이언트 버전 삭제 (관리자만)
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

// 태그 관련 라우트 (관리자만)
router.get('/:id/tags', requireAdmin as any, ClientVersionController.getTags);
router.put('/:id/tags', requireAdmin as any, ClientVersionController.setTags);

export default router;
