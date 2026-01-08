import express from 'express';
import { ChangeRequestController } from '../../controllers/ChangeRequestController';
import { authenticate, requireAdmin } from '../../middleware/auth';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

/**
 * @route GET /api/v1/admin/change-requests
 * @desc Get list of change requests for current environment
 * @access Admin
 */
router.get('/', ChangeRequestController.list);

/**
 * @route GET /api/v1/admin/change-requests/my
 * @desc Get my pending requests (as requester or approver)
 * @access Admin
 */
router.get('/my', ChangeRequestController.getMyRequests);

/**
 * @route GET /api/v1/admin/change-requests/:id
 * @desc Get single change request details
 * @access Admin
 */
router.get('/:id', ChangeRequestController.getById);

/**
 * @route PATCH /api/v1/admin/change-requests/:id
 * @desc Update change request metadata (Draft only)
 * @access Admin
 */
router.patch('/:id', ChangeRequestController.updateMetadata);

/**
 * @route DELETE /api/v1/admin/change-requests/:id
 * @desc Delete draft change request
 * @access Admin
 */
router.delete('/:id', ChangeRequestController.delete);

/**
 * @route POST /api/v1/admin/change-requests/:id/submit
 * @desc Submit change request for review (Draft -> Open)
 * @access Admin
 */
router.post('/:id/submit', ChangeRequestController.submit);

/**
 * @route POST /api/v1/admin/change-requests/:id/approve
 * @desc Approve change request
 * @access Admin
 */
router.post('/:id/approve', ChangeRequestController.approve);

/**
 * @route POST /api/v1/admin/change-requests/:id/reject
 * @desc Reject change request
 * @access Admin
 */
router.post('/:id/reject', ChangeRequestController.reject);

/**
 * @route POST /api/v1/admin/change-requests/:id/reopen
 * @desc Reopen rejected change request (Reset to Draft)
 * @access Admin
 */
router.post('/:id/reopen', ChangeRequestController.reopen);

/**
 * @route POST /api/v1/admin/change-requests/:id/execute
 * @desc Execute approved change request
 * @access Admin
 */
router.post('/:id/execute', ChangeRequestController.execute);

/**
 * @route POST /api/v1/admin/change-requests/:id/rollback
 * @desc Rollback applied change request
 * @access Admin
 */
router.post('/:id/rollback', ChangeRequestController.rollback);

export default router;
