import express from 'express';
import IngamePopupNoticeController from '../../controllers/IngamePopupNoticeController';

const router = express.Router();

// Get all ingame popup notices with pagination and filters
router.get('/', IngamePopupNoticeController.getIngamePopupNotices as any);

// Get ingame popup notice by ID
router.get('/:id', IngamePopupNoticeController.getIngamePopupNoticeById as any);

// Create ingame popup notice
router.post('/', IngamePopupNoticeController.createIngamePopupNotice as any);

// Update ingame popup notice
router.put('/:id', IngamePopupNoticeController.updateIngamePopupNotice as any);

// Delete ingame popup notice
router.delete('/:id', IngamePopupNoticeController.deleteIngamePopupNotice as any);

// Delete multiple ingame popup notices
router.post('/bulk-delete', IngamePopupNoticeController.deleteMultipleIngamePopupNotices as any);

// Toggle active status
router.patch('/:id/toggle-active', IngamePopupNoticeController.toggleActive as any);

export default router;

