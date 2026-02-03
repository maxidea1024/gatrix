import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { GameWorldController } from '../../controllers/GameWorldController';
import {
  auditGameWorldCreate,
  auditGameWorldUpdate,
  auditGameWorldDelete,
  auditGameWorldToggleVisibility,
  auditGameWorldToggleMaintenance,
  auditGameWorldUpdateOrders,
  auditGameWorldMoveUp,
  auditGameWorldMoveDown,
} from '../../middleware/auditLog';

const router = Router();

// All game world routes require authentication
router.use(authenticate as any);

/**
 * @openapi
 * tags:
 *   - name: GameWorlds
 *     description: 관리자 권한으로 게임월드를 조회/생성/수정/삭제하는 엔드포인트입니다.
 * paths:
 *   /admin/game-worlds:
 *     get:
 *       summary: 게임월드 목록 조회
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: query
 *           name: search
 *           schema: { type: string }
 *           description: worldId, name, description, tags 필드에 대한 부분 일치 검색어
 *         - in: query
 *           name: isVisible
 *           schema: { type: boolean }
 *           description: 노출 여부로 필터링
 *         - in: query
 *           name: isMaintenance
 *           schema: { type: boolean }
 *           description: 점검 여부로 필터링
 *         - in: query
 *           name: tags
 *           schema: { type: string }
 *           description: 쉼표(,) 구분 태그 문자열. 모든 태그를 포함하는 항목만 반환됩니다.
 *         - in: query
 *           name: tagIds
 *           schema: { type: string }
 *           description: 쉼표(,) 구분된 태그 ID 목록. 서버가 각 항목의 태그를 조회한 뒤 필터링합니다.
 *         - in: query
 *           name: tags_operator
 *           schema:
 *             type: string
 *             enum: [any_of, include_all]
 *             default: include_all
 *           description: any_of(OR) 또는 include_all(AND) 방식으로 tagIds 필터를 적용합니다.
 *       responses:
 *         '200':
 *           description: 목록 조회 성공
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success: { type: boolean }
 *                   data:
 *                     type: object
 *                     properties:
 *                       worlds:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/GameWorld'
 *                       total: { type: integer }
 *                   message: { type: string }
 *               examples:
 *                 default:
 *                   summary: 기본 예시
 *                   value:
 *                     success: true
 *                     data:
 *                       worlds:
 *                         - id: 1
 *                           worldId: "sea-01"
 *                           name: "SEA 01"
 *                           isVisible: true
 *                           isMaintenance: false
 *                           displayOrder: 10
 *                           tags: [{ id: 2, name: "asia" }]
 *                       total: 1
 *                     message: gameWorlds.list.success
 *         '401':
 *           description: 인증 필요
 *     post:
 *       summary: 게임월드 생성
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [worldId, name]
 *               properties:
 *                 worldId: { type: string }
 *                 name: { type: string }
 *                 isVisible: { type: boolean }
 *                 isMaintenance: { type: boolean }
 *                 displayOrder: { type: integer }
 *                 description: { type: string }
 *                 maintenanceStartDate: { type: string, format: date-time, nullable: true }
 *                 maintenanceEndDate: { type: string, format: date-time, nullable: true }
 *                 maintenanceMessage: { type: string, nullable: true }
 *                 supportsMultiLanguage: { type: boolean }
 *                 maintenanceLocales:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       lang: { type: string, enum: [ko, en, zh] }
 *                       message: { type: string }
 *                 customPayload: { type: object, additionalProperties: true }
 *                 tagIds:
 *                   type: array
 *                   items: { type: integer }
 *             examples:
 *               sample:
 *                 value:
 *                   worldId: "sea-01"
 *                   name: "SEA 01"
 *                   isVisible: true
 *                   displayOrder: 10
 *       responses:
 *         '201':
 *           description: 생성 성공
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success: { type: boolean }
 *                   data:
 *                     type: object
 *                     properties:
 *                       world:
 *                         $ref: '#/components/schemas/GameWorld'
 *                   message: { type: string }
 *         '400':
 *           description: 유효성 검사 실패
 *         '409':
 *           description: worldId 중복 등으로 인한 충돌
 *   /admin/game-worlds/id/{id}:
 *     get:
 *       summary: ID로 게임월드 조회
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: path
 *           name: id
 *           schema: { type: integer }
 *           required: true
 *       responses:
 *         '200':
 *           description: 조회 성공
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success: { type: boolean }
 *                   data:
 *                     type: object
 *                     properties:
 *                       world:
 *                         $ref: '#/components/schemas/GameWorld'
 *                   message: { type: string }
 *         '404':
 *           description: 존재하지 않는 리소스
 *   /admin/game-worlds/{id}:
 *     put:
 *       summary: 게임월드 수정
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: path
 *           name: id
 *           schema: { type: integer }
 *           required: true
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 worldId: { type: string }
 *                 name: { type: string }
 *                 isVisible: { type: boolean }
 *                 isMaintenance: { type: boolean }
 *                 displayOrder: { type: integer }
 *                 description: { type: string }
 *                 maintenanceStartDate: { type: string, format: date-time, nullable: true }
 *                 maintenanceEndDate: { type: string, format: date-time, nullable: true }
 *                 maintenanceMessage: { type: string, nullable: true }
 *                 supportsMultiLanguage: { type: boolean }
 *                 maintenanceLocales:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       lang: { type: string, enum: [ko, en, zh] }
 *                       message: { type: string }
 *                 customPayload: { type: object, additionalProperties: true, nullable: true }
 *                 tagIds:
 *                   type: array
 *                   items: { type: integer }
 *       responses:
 *         '200':
 *           description: 수정 성공
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success: { type: boolean }
 *                   data:
 *                     type: object
 *                     properties:
 *                       world:
 *                         $ref: '#/components/schemas/GameWorld'
 *                   message: { type: string }
 *         '400':
 *           description: 유효성 검사 실패
 *         '404':
 *           description: 존재하지 않는 리소스
 *     delete:
 *       summary: 게임월드 삭제
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: path
 *           name: id
 *           schema: { type: integer }
 *           required: true
 *       responses:
 *         '200':
 *           description: 삭제 성공
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/SuccessResponse'
 *         '404':
 *           description: 존재하지 않는 리소스
 *   /admin/game-worlds/{id}/toggle-visibility:
 *     patch:
 *       summary: 노출 여부 토글
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: path
 *           name: id
 *           schema: { type: integer }
 *           required: true
 *       responses:
 *         '200':
 *           description: 토글 성공
 *   /admin/game-worlds/{id}/toggle-maintenance:
 *     patch:
 *       summary: 점검 여부 토글
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       parameters:
 *         - in: path
 *           name: id
 *           schema: { type: integer }
 *           required: true
 *       responses:
 *         '200':
 *           description: 토글 성공
 *   /admin/game-worlds/invalidate-cache:
 *     post:
 *       summary: 게임월드 캐시 무효화
 *       tags: [GameWorlds]
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         '200':
 *           description: 캐시 무효화 성공
 */

// Public routes (for authenticated users)
router.get('/', GameWorldController.getGameWorlds);
router.get('/id/:id', GameWorldController.getGameWorldById);
router.get('/world/:worldId', GameWorldController.getGameWorldByWorldId);

// Admin-only routes
router.use(requireAdmin as any);
router.post('/', auditGameWorldCreate as any, GameWorldController.createGameWorld);
router.put('/:id', auditGameWorldUpdate as any, GameWorldController.updateGameWorld);
router.delete('/:id', auditGameWorldDelete as any, GameWorldController.deleteGameWorld);
router.patch(
  '/:id/toggle-visibility',
  auditGameWorldToggleVisibility as any,
  GameWorldController.toggleVisibility
);
router.patch(
  '/:id/toggle-maintenance',
  auditGameWorldToggleMaintenance as any,
  GameWorldController.toggleMaintenance
);
router.patch(
  '/:id/maintenance',
  auditGameWorldUpdate as any,
  GameWorldController.updateMaintenance
);
router.patch(
  '/update-orders',
  auditGameWorldUpdateOrders as any,
  GameWorldController.updateDisplayOrders
);
router.patch('/:id/move-up', auditGameWorldMoveUp as any, GameWorldController.moveUp);
router.patch('/:id/move-down', auditGameWorldMoveDown as any, GameWorldController.moveDown);
router.post('/invalidate-cache', GameWorldController.invalidateCache);

export default router;
