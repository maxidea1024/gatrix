import express from 'express';
import LinkPreviewController from '../controllers/LinkPreviewController';

const router = express.Router();

// POST /api/v1/link-preview { url }
router.post('/', LinkPreviewController.getPreview);

// POST /api/v1/link-preview/batch { urls: string[] }
router.post('/batch', LinkPreviewController.getBatch);

export default router;

