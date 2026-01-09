/**
 * Entity Lock Controller
 * 
 * REST API for soft-lock management
 */
import { Router, Request, Response, NextFunction } from 'express';
import { entityLockService } from '../services/EntityLockService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate as any);

/**
 * POST /entity-locks/acquire
 * Acquire a soft lock on an entity
 */
router.post('/acquire', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { table, entityId, environment } = req.body;
        const user = (req as any).user;

        if (!table || !entityId || !environment) {
            return res.status(400).json({ error: 'Missing required fields: table, entityId, environment' });
        }

        const result = await entityLockService.acquireLock(
            table,
            entityId,
            environment,
            user.id,
            user.name || user.email,
            user.email
        );

        if (result.success) {
            return res.json({ success: true, message: 'Lock acquired' });
        } else {
            return res.status(409).json({
                success: false,
                message: 'Entity is being edited by another user',
                lockedBy: {
                    userId: result.existingLock?.userId,
                    userName: result.existingLock?.userName,
                    userEmail: result.existingLock?.userEmail,
                    lockedAt: result.existingLock?.lockedAt,
                    expiresAt: result.existingLock?.expiresAt
                }
            });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * POST /entity-locks/force-acquire
 * Force acquire a lock (take over)
 */
router.post('/force-acquire', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { table, entityId, environment } = req.body;
        const user = (req as any).user;

        if (!table || !entityId || !environment) {
            return res.status(400).json({ error: 'Missing required fields: table, entityId, environment' });
        }

        const success = await entityLockService.forceAcquireLock(
            table,
            entityId,
            environment,
            user.id,
            user.name || user.email,
            user.email
        );

        return res.json({ success, message: success ? 'Lock acquired' : 'Failed to acquire lock' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /entity-locks/release
 * Release a soft lock
 */
router.post('/release', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { table, entityId, environment } = req.body;
        const user = (req as any).user;

        if (!table || !entityId || !environment) {
            return res.status(400).json({ error: 'Missing required fields: table, entityId, environment' });
        }

        const success = await entityLockService.releaseLock(
            table,
            entityId,
            environment,
            user.id
        );

        return res.json({ success, message: success ? 'Lock released' : 'Failed to release lock' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /entity-locks/extend
 * Extend (heartbeat) an existing lock
 */
router.post('/extend', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { table, entityId, environment } = req.body;
        const user = (req as any).user;

        if (!table || !entityId || !environment) {
            return res.status(400).json({ error: 'Missing required fields: table, entityId, environment' });
        }

        const success = await entityLockService.extendLock(
            table,
            entityId,
            environment,
            user.id
        );

        return res.json({ success });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /entity-locks/check
 * Check if an entity is locked and if there's a pending CR
 */
router.get('/check', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { table, entityId, environment } = req.query;

        if (!table || !entityId || !environment) {
            return res.status(400).json({ error: 'Missing required query params: table, entityId, environment' });
        }

        const [lockInfo, pendingCR] = await Promise.all([
            entityLockService.checkLock(table as string, entityId as string, environment as string),
            entityLockService.checkPendingCR(table as string, entityId as string, environment as string)
        ]);

        return res.json({
            locked: !!lockInfo,
            lockInfo: lockInfo ? {
                userId: lockInfo.userId,
                userName: lockInfo.userName,
                userEmail: lockInfo.userEmail,
                lockedAt: lockInfo.lockedAt,
                expiresAt: lockInfo.expiresAt
            } : null,
            pendingCR: pendingCR.hasPending ? {
                crId: pendingCR.crId,
                crTitle: pendingCR.crTitle
            } : null
        });
    } catch (error) {
        next(error);
    }
});

export default router;
