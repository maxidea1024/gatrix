import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { GatrixError } from '../../middleware/error-handler';
import { CrashesController } from '../../controllers/crashes-controller';

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((err: any) => err.msg)
      .join(', ');
    throw new GatrixError(`Validation failed: ${errorMessages}`, 400);
  }
  next();
};

const router = Router();

/**
 * @route   GET /admin/crashes/filter-options
 * @desc    Get filter options for crashes
 * @access  Admin
 */
router.get('/filter-options', CrashesController.getFilterOptions as any);

/**
 * @route   GET /admin/crashes
 * @desc    Get all crash groups with pagination and filters
 * @access  Admin
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString(),
    query('platform').optional().isString(),
    query('environmentId').optional().isString(),
    query('branch').optional().isString(),
    query('channel').optional().isString(),
    query('subchannel').optional().isString(),
    query('isEditor').optional().isBoolean(),
    query('state').optional().isInt({ min: 0, max: 4 }),
    query('assignee').optional().isString(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    validateRequest,
  ],
  CrashesController.getCrashes as any
);

/**
 * @route   GET /admin/crashes/:id
 * @desc    Get crash by ID with stack trace
 * @access  Admin
 */
router.get(
  '/:id',
  [param('id').isString(), validateRequest],
  CrashesController.getCrashById as any
);

/**
 * @route   GET /admin/crashes/:id/events
 * @desc    Get crash events for a specific crash group
 * @access  Admin
 */
router.get(
  '/:id/events',
  [
    param('id').isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    validateRequest,
  ],
  CrashesController.getCrashEvents as any
);

/**
 * @route   PATCH /admin/crashes/:id/state
 * @desc    Update crash state
 * @access  Admin
 */
router.patch(
  '/:id/state',
  [
    param('id').isString(),
    body('state').isInt({ min: 0, max: 4 }),
    validateRequest,
  ],
  CrashesController.updateState as any
);

/**
 * @route   PATCH /admin/crashes/:id/assignee
 * @desc    Update crash assignee
 * @access  Admin
 */
router.patch(
  '/:id/assignee',
  [param('id').isString(), validateRequest],
  CrashesController.updateAssignee as any
);

/**
 * @route   PATCH /admin/crashes/:id/jira
 * @desc    Update crash Jira ticket
 * @access  Admin
 */
router.patch(
  '/:id/jira',
  [param('id').isString(), validateRequest],
  CrashesController.updateJiraTicket as any
);

export default router;
