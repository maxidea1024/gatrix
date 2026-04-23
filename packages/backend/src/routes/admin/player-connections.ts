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

// All players (DB query via admind)
router.get('/all-players', PlayerConnectionsController.getAllPlayers);
router.get('/all-characters', PlayerConnectionsController.getAllCharacters);

// Kick
router.post('/kick', PlayerConnectionsController.kickPlayers);

// Sync online status (fix stale isOnline flags in DB)
router.get(
  '/sync-online-status/preview',
  PlayerConnectionsController.previewSyncOnlineStatus
);
router.post(
  '/sync-online-status',
  PlayerConnectionsController.syncOnlineStatus
);

export default router;
