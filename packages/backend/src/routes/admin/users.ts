import { Router } from "express";
import { UserController } from "../../controllers/UserController";
import { authenticate, requireAdmin } from "../../middleware/auth";

const router = Router();

/**
 * @openapi
 * /admin/users/me:
 *   get:
 *     tags: [Users, Admin]
 *     summary: Get current admin user profile
 *     description: Returns the authenticated admin user's profile.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current admin profile
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *
 *   put:
 *     tags: [Users, Admin]
 *     summary: Update current admin user profile
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
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *
 * /admin/users/me/language:
 *   put:
 *     tags: [Users, Admin]
 *     summary: Update language preference
 *     description: Update the admin user's preferred language. This controls localized messages shown in the UI.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [preferredLanguage]
 *             properties:
 *               preferredLanguage:
 *                 type: string
 *                 enum: [en, ko, zh]
 *           examples:
 *             default:
 *               value:
 *                 preferredLanguage: "ko"
 *     responses:
 *       200:
 *         description: Language preference updated
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
 *                     preferredLanguage:
 *                       type: string
 *                       enum: [en, ko, zh]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// All routes require authentication
router.use(authenticate as any);

// Self-service routes (available to all authenticated users)
router.get("/me", UserController.getCurrentUser);
router.put("/me", UserController.updateCurrentUser);
router.put("/me/language", UserController.updateLanguage);
router.get("/me/environments", UserController.getMyEnvironmentAccess);

export default router;
