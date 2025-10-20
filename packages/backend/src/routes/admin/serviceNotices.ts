import express from 'express';
import ServiceNoticeController from '../../controllers/ServiceNoticeController';

const router = express.Router();

// Get all service notices with pagination and filters
router.get('/', ServiceNoticeController.getServiceNotices);

// Get service notice by ID
router.get('/:id', ServiceNoticeController.getServiceNoticeById);

// Create service notice
router.post('/', ServiceNoticeController.createServiceNotice);

// Update service notice
router.put('/:id', ServiceNoticeController.updateServiceNotice);

// Delete service notice
router.delete('/:id', ServiceNoticeController.deleteServiceNotice);

// Delete multiple service notices
router.post('/bulk-delete', ServiceNoticeController.deleteMultipleServiceNotices);

// Toggle active status
router.patch('/:id/toggle-active', ServiceNoticeController.toggleActive);

export default router;

