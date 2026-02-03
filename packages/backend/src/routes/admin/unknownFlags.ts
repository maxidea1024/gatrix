import express from 'express';
import { unknownFlagService } from '../../services/UnknownFlagService';

const router = express.Router();

/**
 * GET /admin/unknown-flags
 * Get all unknown flags
 */
router.get('/', async (req, res) => {
  try {
    const includeResolved = req.query.includeResolved === 'true';
    const environment = req.query.environment as string | undefined;

    const flags = await unknownFlagService.getUnknownFlags({
      includeResolved,
      environment,
    });

    res.json({ success: true, data: { flags, total: flags.length } });
  } catch (error) {
    console.error('Error fetching unknown flags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unknown flags' });
  }
});

/**
 * GET /admin/unknown-flags/count
 * Get count of unresolved unknown flags
 */
router.get('/count', async (req, res) => {
  try {
    const count = await unknownFlagService.getUnresolvedCount();
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching unknown flag count:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch count' });
  }
});

/**
 * POST /admin/unknown-flags/:id/resolve
 * Resolve an unknown flag
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = (req as any).user;
    const resolvedBy = user?.username || 'unknown';

    await unknownFlagService.resolveUnknownFlag(id, resolvedBy);
    res.json({ success: true, data: { success: true } });
  } catch (error) {
    console.error('Error resolving unknown flag:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve flag' });
  }
});

/**
 * POST /admin/unknown-flags/:id/unresolve
 * Unresolve an unknown flag (mark as unresolved again)
 */
router.post('/:id/unresolve', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await unknownFlagService.unresolveUnknownFlag(id);
    res.json({ success: true, data: { success: true } });
  } catch (error) {
    console.error('Error unresolving unknown flag:', error);
    res.status(500).json({ success: false, message: 'Failed to unresolve flag' });
  }
});

/**
 * DELETE /admin/unknown-flags/:id
 * Delete an unknown flag record
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await unknownFlagService.deleteUnknownFlag(id);
    res.json({ success: true, data: { success: true } });
  } catch (error) {
    console.error('Error deleting unknown flag:', error);
    res.status(500).json({ success: false, message: 'Failed to delete flag' });
  }
});

export default router;
