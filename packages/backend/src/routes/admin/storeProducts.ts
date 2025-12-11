import { Router } from 'express';
import { StoreProductController } from '../../controllers/StoreProductController';

const router = Router();

// Sync routes (must be before /:id to avoid conflict)
router.get('/sync/preview', StoreProductController.previewSync);
router.post('/sync/apply', StoreProductController.applySync);

// Stats route (must be before /:id to avoid conflict)
router.get('/stats', StoreProductController.getStats);

// Store product CRUD routes
router.get('/', StoreProductController.getStoreProducts);
router.get('/:id', StoreProductController.getStoreProductById);
router.post('/', StoreProductController.createStoreProduct);
router.put('/:id', StoreProductController.updateStoreProduct);
router.delete('/:id', StoreProductController.deleteStoreProduct);
router.delete('/', StoreProductController.deleteStoreProducts);
router.patch('/bulk-active', StoreProductController.bulkUpdateActiveStatus);
router.patch('/:id/toggle-active', StoreProductController.toggleActive);

export default router;

