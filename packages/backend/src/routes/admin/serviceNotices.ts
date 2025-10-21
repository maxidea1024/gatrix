import express from 'express';
import ServiceNoticeController from '../../controllers/ServiceNoticeController';
import {
  auditServiceNoticeCreate,
  auditServiceNoticeUpdate,
  auditServiceNoticeDelete,
  auditServiceNoticeBulkDelete,
  auditServiceNoticeToggleActive,
} from '../../middleware/auditLog';

const router = express.Router();

// Get all service notices with pagination and filters
router.get('/', ServiceNoticeController.getServiceNotices);

// Get service notice by ID
router.get('/:id', ServiceNoticeController.getServiceNoticeById);

// Create service notice
router.post('/', auditServiceNoticeCreate, ServiceNoticeController.createServiceNotice);

// Update service notice
router.put('/:id', auditServiceNoticeUpdate, ServiceNoticeController.updateServiceNotice);

// Delete service notice
router.delete('/:id', auditServiceNoticeDelete, ServiceNoticeController.deleteServiceNotice);

// Delete multiple service notices
router.post('/bulk-delete', auditServiceNoticeBulkDelete, ServiceNoticeController.deleteMultipleServiceNotices);

// Toggle active status
router.patch('/:id/toggle-active', auditServiceNoticeToggleActive, ServiceNoticeController.toggleActive);

export default router;

