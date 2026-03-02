/**
 * Signal Endpoint Routes
 *
 * Admin API endpoints for managing signal endpoints.
 */

import { Router, Request, Response } from 'express';
import { SignalEndpointModel } from '../../models/SignalEndpoint';
import { createLogger } from '../../config/logger';
import { sendConflict, sendBadRequest, sendNotFound, sendInternalError } from '../../utils/apiResponse';
import { ErrorCodes } from '@gatrix/shared';
import crypto from 'crypto';

const router = Router();
const logger = createLogger('SignalEndpointRoutes');

/**
 * GET /admin/signal-endpoints
 * Get all signal endpoints
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const endpoints = await SignalEndpointModel.findAll((req as any).projectId);
    res.json({ data: endpoints });
  } catch (error) {
    logger.error('Error getting signal endpoints:', error);
    res.status(500).json({ error: 'Failed to get signal endpoints' });
  }
});

/**
 * GET /admin/signal-endpoints/:id
 * Get a specific signal endpoint
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const endpoint = await SignalEndpointModel.findById(id);

    if (!endpoint) {
      return res.status(404).json({ error: 'Signal endpoint not found' });
    }

    res.json({ data: endpoint });
  } catch (error) {
    logger.error('Error getting signal endpoint:', error);
    res.status(500).json({ error: 'Failed to get signal endpoint' });
  }
});

/**
 * POST /admin/signal-endpoints
 * Create a new signal endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const user = req.user as { id: string; name: string };
    const projectId = (req as any).projectId;

    if (!name || !name.trim()) {
      return sendBadRequest(res, 'Name is required');
    }

    // Check for duplicate name within the same project
    const existing = await SignalEndpointModel.findByName(name.trim());
    if (existing) {
      return sendConflict(res, 'A signal endpoint with this name already exists', ErrorCodes.RESOURCE_ALREADY_EXISTS);
    }

    const endpoint = await SignalEndpointModel.create({
      name: name.trim(),
      description,
      projectId,
      createdBy: user.id,
    });

    res.status(201).json({ data: endpoint });
  } catch (error) {
    logger.error('Error creating signal endpoint:', error);
    return sendInternalError(res, 'Failed to create signal endpoint', error);
  }
});

/**
 * PUT /admin/signal-endpoints/:id
 * Update a signal endpoint
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { name, description, isEnabled } = req.body;
    const user = req.user as { id: string; name: string };

    // Check for duplicate name if name is being changed
    if (name && name.trim()) {
      const existing = await SignalEndpointModel.findByName(name.trim());
      if (existing && existing.id !== id) {
        return sendConflict(res, 'A signal endpoint with this name already exists', ErrorCodes.RESOURCE_ALREADY_EXISTS);
      }
    }

    const endpoint = await SignalEndpointModel.update(id, {
      name,
      description,
      isEnabled,
      updatedBy: user.id,
    });

    if (!endpoint) {
      return sendNotFound(res, 'Signal endpoint not found');
    }

    res.json({ data: endpoint });
  } catch (error) {
    logger.error('Error updating signal endpoint:', error);
    return sendInternalError(res, 'Failed to update signal endpoint', error);
  }
});

/**
 * DELETE /admin/signal-endpoints/:id
 * Delete a signal endpoint
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const success = await SignalEndpointModel.delete(id);

    if (!success) {
      return res.status(404).json({ error: 'Signal endpoint not found' });
    }

    res.json({ message: 'Signal endpoint deleted successfully' });
  } catch (error) {
    logger.error('Error deleting signal endpoint:', error);
    res.status(500).json({ error: 'Failed to delete signal endpoint' });
  }
});

/**
 * POST /admin/signal-endpoints/:id/toggle
 * Toggle signal endpoint enabled status
 */
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = req.user as { id: string; name: string };

    const endpoint = await SignalEndpointModel.toggleEnabled(id, user.id);

    if (!endpoint) {
      return res.status(404).json({ error: 'Signal endpoint not found' });
    }

    res.json({ data: endpoint });
  } catch (error) {
    logger.error('Error toggling signal endpoint:', error);
    res.status(500).json({ error: 'Failed to toggle signal endpoint' });
  }
});

/**
 * POST /admin/signal-endpoints/:id/tokens
 * Create a new token for a signal endpoint
 */
router.post('/:id/tokens', async (req: Request, res: Response) => {
  try {
    const endpointId = req.params.id;
    const { name } = req.body;
    const user = req.user as { id: string; name: string };

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Token name is required' });
    }

    // Check if endpoint exists
    const endpoint = await SignalEndpointModel.findById(endpointId);
    if (!endpoint) {
      return res.status(404).json({ error: 'Signal endpoint not found' });
    }

    // Generate a plain token and store its hash
    const plainToken = `gse_${crypto.randomBytes(32).toString('hex')}`;
    // For signal endpoint tokens, we store a simple SHA-256 hash
    // (not bcrypt) because we need to look up by hash for incoming signals
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    const token = await SignalEndpointModel.createToken(
      endpointId,
      name.trim(),
      tokenHash,
      user.id
    );

    res.status(201).json({
      data: {
        ...token,
        secret: plainToken,
      },
    });
  } catch (error) {
    logger.error('Error creating signal endpoint token:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create signal endpoint token';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /admin/signal-endpoints/:id/tokens/:tokenId
 * Delete a signal endpoint token
 */
router.delete('/:id/tokens/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = req.params.tokenId;
    const success = await SignalEndpointModel.deleteToken(tokenId);

    if (!success) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    logger.error('Error deleting signal endpoint token:', error);
    res.status(500).json({ error: 'Failed to delete signal endpoint token' });
  }
});

/**
 * GET /admin/signal-endpoints/:id/signals
 * Get signals received by a signal endpoint
 */
router.get('/:id/signals', async (req: Request, res: Response) => {
  try {
    const endpointId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const endpoint = await SignalEndpointModel.findById(endpointId);
    if (!endpoint) {
      return res.status(404).json({ error: 'Signal endpoint not found' });
    }

    const result = await SignalEndpointModel.findSignals(endpointId, limit, offset);

    res.json({
      data: result.signals,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('Error getting signals:', error);
    res.status(500).json({ error: 'Failed to get signals' });
  }
});

export default router;
