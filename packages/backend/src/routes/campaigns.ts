import { Router } from 'express';
import { CampaignController } from '../controllers/CampaignController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply authentication to all routes
router.use(authenticate as any);

// Campaign routes
router.get('/', asyncHandler(CampaignController.list));
router.post('/', asyncHandler(CampaignController.create));
router.get('/:id', asyncHandler(CampaignController.getById));
router.put('/:id', asyncHandler(CampaignController.update));
router.delete('/:id', asyncHandler(CampaignController.delete));

// Campaign-Config association routes
router.post('/:id/configs', asyncHandler(CampaignController.addConfig));
router.delete('/:id/configs/:configId', asyncHandler(CampaignController.removeConfig));

// Variant routes (nested under configs)
router.get('/configs/:configId/variants', asyncHandler(CampaignController.getVariants));
router.post('/configs/:configId/variants', asyncHandler(CampaignController.createVariant));
router.put('/configs/:configId/variants/:variantId', asyncHandler(CampaignController.updateVariant));
router.delete('/configs/:configId/variants/:variantId', asyncHandler(CampaignController.deleteVariant));

export default router;
