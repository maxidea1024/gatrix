import express from 'express';
import { CrashController } from '../../controllers/CrashController';
import { authenticate, requireRole } from '../../middleware/auth';
import { param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(authenticate as any);
router.use(requireRole(['admin']) as any);

/**
 * @swagger
 * /admin/crashes:
 *   get:
 *     summary: Get crashes with filtering and pagination
 *     tags: [Crashes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by user nickname or user ID
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter crashes from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter crashes to this date
 *       - in: query
 *         name: serverGroup
 *         schema:
 *           type: string
 *           enum: [global, korea, china, japan, sea, na, eu, other]
 *         description: Server group filter
 *       - in: query
 *         name: marketType
 *         schema:
 *           type: string
 *           enum: [google_play, huawei, xiaomi, oppo, vivo, baidu, tencent, samsung, other]
 *         description: Market type filter (Android)
 *       - in: query
 *         name: deviceType
 *         schema:
 *           type: integer
 *           enum: [0, 1, 2, 3, 4, 5, 6]
 *         description: Platform/device type filter
 *       - in: query
 *         name: branch
 *         schema:
 *           type: integer
 *         description: Branch filter
 *       - in: query
 *         name: majorVer
 *         schema:
 *           type: integer
 *         description: Major version filter
 *       - in: query
 *         name: minorVer
 *         schema:
 *           type: integer
 *         description: Minor version filter
 *       - in: query
 *         name: buildNum
 *         schema:
 *           type: integer
 *         description: Build number filter
 *       - in: query
 *         name: patchNum
 *         schema:
 *           type: integer
 *         description: Patch number filter
 *       - in: query
 *         name: state
 *         schema:
 *           type: integer
 *           enum: [0, 1, 2]
 *         description: Crash state filter (0=Open, 1=Closed, 2=Deleted)
 *     responses:
 *       200:
 *         description: List of crashes
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('serverGroup').optional().isString(),
  query('marketType').optional().isString(),
  query('deviceType').optional().isInt({ min: 0, max: 6 }),
  query('branch').optional().isInt(),
  query('majorVer').optional().isInt(),
  query('minorVer').optional().isInt(),
  query('buildNum').optional().isInt(),
  query('patchNum').optional().isInt(),
  query('state').optional().isInt({ min: 0, max: 2 }),
  validateRequest,
  CrashController.getCrashes
);

/**
 * @swagger
 * /admin/crashes/summary:
 *   get:
 *     summary: Get crash summary statistics
 *     tags: [Crashes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Crash summary statistics
 */
router.get('/summary', CrashController.getCrashSummary);

/**
 * @swagger
 * /admin/crashes/filter-options:
 *   get:
 *     summary: Get available filter options
 *     tags: [Crashes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available filter options
 */
router.get('/filter-options', CrashController.getFilterOptions);

/**
 * @swagger
 * /admin/crashes/{id}:
 *   get:
 *     summary: Get crash details with instances
 *     tags: [Crashes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Crash ID
 *     responses:
 *       200:
 *         description: Crash details
 *       404:
 *         description: Crash not found
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  CrashController.getCrashDetail
);

/**
 * @swagger
 * /admin/crashes/{id}/instances:
 *   get:
 *     summary: Get crash instances with pagination
 *     tags: [Crashes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Crash ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Crash instances
 *       404:
 *         description: Crash not found
 */
router.get('/:id/instances',
  param('id').isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  CrashController.getCrashInstances
);

/**
 * @swagger
 * /admin/crashes/{id}/stats:
 *   get:
 *     summary: Get crash statistics
 *     tags: [Crashes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Crash ID
 *     responses:
 *       200:
 *         description: Crash statistics
 *       404:
 *         description: Crash not found
 */
router.get('/:id/stats',
  param('id').isInt({ min: 1 }),
  validateRequest,
  CrashController.getCrashStats
);

/**
 * @swagger
 * /admin/crashes/{id}/state:
 *   patch:
 *     summary: Update crash state
 *     tags: [Crashes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Crash ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - state
 *             properties:
 *               state:
 *                 type: integer
 *                 enum: [0, 1, 2]
 *                 description: New crash state (0=Open, 1=Closed, 2=Deleted)
 *     responses:
 *       200:
 *         description: Crash state updated
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Crash not found
 */
router.patch('/:id/state',
  param('id').isInt({ min: 1 }),
  validateRequest,
  CrashController.updateCrashState
);

export default router;
