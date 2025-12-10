import { Router } from 'express';
import { StoreProductController } from '../../controllers/StoreProductController';

const router = Router();

// Store product CRUD routes
router.get('/', StoreProductController.getStoreProducts);
router.get('/:id', StoreProductController.getStoreProductById);
router.post('/', StoreProductController.createStoreProduct);
router.put('/:id', StoreProductController.updateStoreProduct);
router.delete('/:id', StoreProductController.deleteStoreProduct);
router.delete('/', StoreProductController.deleteStoreProducts);
router.patch('/:id/toggle-active', StoreProductController.toggleActive);

export default router;

