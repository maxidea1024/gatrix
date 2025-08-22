import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { GameWorldController } from '../controllers/GameWorldController';

const router = Router();

// All game world routes require authentication
router.use(authenticate as any);

// Public routes (for authenticated users)
router.get('/', GameWorldController.getGameWorlds);
router.get('/id/:id', GameWorldController.getGameWorldById);
router.get('/world/:worldId', GameWorldController.getGameWorldByWorldId);

// Admin-only routes
router.use(requireAdmin as any);
router.post('/', GameWorldController.createGameWorld);
router.put('/:id', GameWorldController.updateGameWorld);
router.delete('/:id', GameWorldController.deleteGameWorld);
router.patch('/:id/toggle-visibility', GameWorldController.toggleVisibility);
router.patch('/:id/toggle-maintenance', GameWorldController.toggleMaintenance);
router.patch('/update-orders', GameWorldController.updateDisplayOrders);
router.patch('/:id/move-up', GameWorldController.moveUp);
router.patch('/:id/move-down', GameWorldController.moveDown);

export default router;
