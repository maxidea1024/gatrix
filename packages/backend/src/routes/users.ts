import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();
/**
 * @openapi
 * /users/search:
 *   get:
 *     tags: [Users]
 *     summary: Search users
 *     description: Returns a limited list of users whose email, username, or name match the query. This endpoint is rate limited.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Partial email, username, or display name to search
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Max number of results to return (capped at 50)
 *     responses:
 *       200:
 *         description: Matched users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     additionalProperties: true
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 12
 *                       email: "john@example.com"
 *                       name: "John"
 *                     - id: 34
 *                       email: "jane@example.com"
 *                       name: "Jane"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/TooManyRequestsError'
 *
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     user:
 *                       id: 1
 *                       email: "admin@example.com"
 *                       username: "admin"
 *                       displayName: "Admin"
 *                       role: "admin"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *
 *   put:
 *     tags: [Users]
 *     summary: Update current user profile
 *     description: Update own profile fields. Only name, avatarUrl, and preferredLanguage can be changed.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *               preferredLanguage:
 *                 type: string
 *                 enum: [en, ko, zh]
 *           examples:
 *             default:
 *               value:
 *                 name: "홍길동"
 *                 preferredLanguage: "ko"
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/TooManyRequestsError'
 */

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate as any);

// 사용자 검색 (채팅 시스템용)
router.get(
  '/search',
  generalLimiter as any, // Rate limiting
  UserController.searchUsers
);

// 현재 사용자 정보 조회
router.get(
  '/me',
  generalLimiter as any, // Rate limiting
  UserController.getCurrentUser
);

// 현재 사용자 정보 업데이트
router.put(
  '/me',
  generalLimiter as any, // Rate limiting
  UserController.updateCurrentUser
);

export default router;
