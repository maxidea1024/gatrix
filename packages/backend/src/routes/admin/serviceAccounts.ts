/**
 * Service Account Routes
 *
 * Admin API endpoints for managing service accounts.
 */

import { Router, Request, Response } from 'express';
import { ServiceAccountModel } from '../../models/ServiceAccount';
import { createLogger } from '../../config/logger';

const router = Router();
const logger = createLogger('ServiceAccountRoutes');

/**
 * GET /admin/service-accounts
 * Get all service accounts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await ServiceAccountModel.findAll();
    res.json({ data: accounts });
  } catch (error) {
    logger.error('Error getting service accounts:', error);
    res.status(500).json({ error: 'Failed to get service accounts' });
  }
});

/**
 * GET /admin/service-accounts/:id
 * Get a specific service account
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const account = await ServiceAccountModel.findById(id);

    if (!account) {
      return res.status(404).json({ error: 'Service account not found' });
    }

    res.json({ data: account });
  } catch (error) {
    logger.error('Error getting service account:', error);
    res.status(500).json({ error: 'Failed to get service account' });
  }
});

/**
 * POST /admin/service-accounts
 * Create a new service account
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, role, permissions, allowAllEnvironments, environments } = req.body;
    const user = req.user as { id: number; name: string };

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const account = await ServiceAccountModel.create({
      name: name.trim(),
      role,
      permissions,
      allowAllEnvironments,
      environments,
      createdBy: user.id,
    });

    res.status(201).json({ data: account });
  } catch (error) {
    logger.error('Error creating service account:', error);
    const message = error instanceof Error ? error.message : 'Failed to create service account';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /admin/service-accounts/:id
 * Update a service account
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, role, permissions, allowAllEnvironments, environments } = req.body;
    const user = req.user as { id: number; name: string };

    const account = await ServiceAccountModel.update(id, {
      name,
      role,
      permissions,
      allowAllEnvironments,
      environments,
      updatedBy: user.id,
    });

    if (!account) {
      return res.status(404).json({ error: 'Service account not found' });
    }

    res.json({ data: account });
  } catch (error) {
    logger.error('Error updating service account:', error);
    const message = error instanceof Error ? error.message : 'Failed to update service account';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /admin/service-accounts/:id
 * Delete a service account
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await ServiceAccountModel.delete(id);

    if (!success) {
      return res.status(404).json({ error: 'Service account not found' });
    }

    res.json({ message: 'Service account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting service account:', error);
    res.status(500).json({ error: 'Failed to delete service account' });
  }
});

/**
 * POST /admin/service-accounts/:id/tokens
 * Create a new token for a service account
 */
router.post('/:id/tokens', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, description, expiresAt } = req.body;
    const user = req.user as { id: number; name: string };

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Token name is required' });
    }

    // Check if service account exists
    const account = await ServiceAccountModel.findById(userId);
    if (!account) {
      return res.status(404).json({ error: 'Service account not found' });
    }

    const { token, plainToken } = await ServiceAccountModel.createToken(
      userId,
      name.trim(),
      user.id,
      description,
      expiresAt ? new Date(expiresAt) : undefined
    );

    // Return the plain token only once
    res.status(201).json({
      data: {
        ...token,
        secret: plainToken,
      },
    });
  } catch (error) {
    logger.error('Error creating service account token:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create service account token';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /admin/service-accounts/:id/tokens/:tokenId
 * Delete a service account token
 */
router.delete('/:id/tokens/:tokenId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const tokenId = parseInt(req.params.tokenId);

    const success = await ServiceAccountModel.deleteToken(tokenId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    logger.error('Error deleting service account token:', error);
    res.status(500).json({ error: 'Failed to delete service account token' });
  }
});

export default router;
