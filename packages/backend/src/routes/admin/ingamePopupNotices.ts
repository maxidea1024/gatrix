import express from 'express';
import IngamePopupNoticeController from '../../controllers/IngamePopupNoticeController';

const router = express.Router();

// Get all ingame popup notices with pagination and filters
router.get('/', IngamePopupNoticeController.getIngamePopupNotices);

// Get ingame popup notice by ID
router.get('/:id', IngamePopupNoticeController.getIngamePopupNoticeById);

// Create ingame popup notice
router.post('/', IngamePopupNoticeController.createIngamePopupNotice);

// Update ingame popup notice
router.put('/:id', IngamePopupNoticeController.updateIngamePopupNotice);

// Delete ingame popup notice
router.delete('/:id', IngamePopupNoticeController.deleteIngamePopupNotice);

// Delete multiple ingame popup notices
router.post('/bulk-delete', IngamePopupNoticeController.deleteMultipleIngamePopupNotices);

// Toggle active status
router.patch('/:id/toggle-active', IngamePopupNoticeController.toggleActive);

export default router;

