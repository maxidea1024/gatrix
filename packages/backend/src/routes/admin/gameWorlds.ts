import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { GameWorldController } from '../../controllers/GameWorldController';
import { auditGameWorldCreate, auditGameWorldUpdate, auditGameWorldDelete, auditGameWorldToggleVisibility, auditGameWorldToggleMaintenance, auditGameWorldUpdateOrders, auditGameWorldMoveUp, auditGameWorldMoveDown } from '../../middleware/auditLog';

const router = Router();

// All game world routes require authentication
router.use(authenticate as any);

// Public routes (for authenticated users)
router.get('/', GameWorldController.getGameWorlds);
router.get('/id/:id', GameWorldController.getGameWorldById);
router.get('/world/:worldId', GameWorldController.getGameWorldByWorldId);

// Admin-only routes
router.use(requireAdmin as any);
router.post('/', auditGameWorldCreate as any, GameWorldController.createGameWorld);
router.put('/:id', auditGameWorldUpdate as any, GameWorldController.updateGameWorld);
router.delete('/:id', auditGameWorldDelete as any, GameWorldController.deleteGameWorld);
router.patch('/:id/toggle-visibility', auditGameWorldToggleVisibility as any, GameWorldController.toggleVisibility);
router.patch('/:id/toggle-maintenance', auditGameWorldToggleMaintenance as any, GameWorldController.toggleMaintenance);
router.patch('/update-orders', auditGameWorldUpdateOrders as any, GameWorldController.updateDisplayOrders);
router.patch('/:id/move-up', auditGameWorldMoveUp as any, GameWorldController.moveUp);
router.patch('/:id/move-down', auditGameWorldMoveDown as any, GameWorldController.moveDown);
router.post('/invalidate-cache', GameWorldController.invalidateCache);

export default router;
