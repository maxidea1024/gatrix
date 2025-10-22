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
router.post('/', auditServiceNoticeCreate as any, ServiceNoticeController.createServiceNotice as any);

// Update service notice
router.put('/:id', auditServiceNoticeUpdate as any, ServiceNoticeController.updateServiceNotice as any);

// Delete service notice
router.delete('/:id', auditServiceNoticeDelete as any, ServiceNoticeController.deleteServiceNotice as any);

// Delete multiple service notices
router.post('/bulk-delete', auditServiceNoticeBulkDelete as any, ServiceNoticeController.deleteMultipleServiceNotices as any);

// Toggle active status
router.patch('/:id/toggle-active', auditServiceNoticeToggleActive as any, ServiceNoticeController.toggleActive as any);

export default router;

