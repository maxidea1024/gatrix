import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { PlayerConnectionsController } from '../../controllers/player-connections-controller';

const router = Router();

// All player connection routes require authentication
router.use(authenticate as any);

// CCU endpoints
router.get('/ccu', PlayerConnectionsController.getCcu);
router.get('/ccu/history', PlayerConnectionsController.getCcuHistory);

// Connected users
router.get('/users', PlayerConnectionsController.getConnectedUsers);

// Kick
router.post('/kick', PlayerConnectionsController.kickPlayers);

export default router;
