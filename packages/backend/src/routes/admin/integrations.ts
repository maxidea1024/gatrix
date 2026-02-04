/**
 * Integration Routes
 *
 * Admin API endpoints for managing integrations.
 */

import { Router, Request, Response } from 'express';
import { IntegrationService } from '../../services/IntegrationService';
import { getAddonDefinition } from '../../addons/definitions';
import { createLogger } from '../../config/logger';

const router = Router();
const logger = createLogger('IntegrationRoutes');

/**
 * GET /admin/integrations/providers
 * Get all available integration providers
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = IntegrationService.getProviders();
    res.json({ data: providers });
  } catch (error) {
    logger.error('Error getting providers:', error);
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

/**
 * GET /admin/integrations
 * Get all configured integrations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const integrations = await IntegrationService.getAll();
    res.json({ data: integrations });
  } catch (error) {
    logger.error('Error getting integrations:', error);
    res.status(500).json({ error: 'Failed to get integrations' });
  }
});

/**
 * GET /admin/integrations/:id
 * Get a specific integration
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const integration = await IntegrationService.getById(id);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ data: integration });
  } catch (error) {
    logger.error('Error getting integration:', error);
    res.status(500).json({ error: 'Failed to get integration' });
  }
});

/**
 * POST /admin/integrations
 * Create a new integration
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { provider, description, isEnabled, parameters, events, environments } = req.body;
    const user = req.user as { id: number; name: string };

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'At least one event must be selected' });
    }

    // Validate required parameters based on provider definition
    const addonDefinition = getAddonDefinition(provider);
    if (!addonDefinition) {
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    const requiredParams = addonDefinition.parameters.filter((p) => p.required);
    for (const param of requiredParams) {
      const value = parameters?.[param.name];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return res.status(400).json({ error: `Required parameter missing: ${param.name}` });
      }
    }

    const integration = await IntegrationService.create(
      {
        provider,
        description,
        isEnabled: isEnabled !== false,
        parameters: parameters || {},
        events,
        environments: environments || [],
        createdBy: user.id,
      },
      user
    );

    res.status(201).json({ data: integration });
  } catch (error) {
    logger.error('Error creating integration:', error);
    const message = error instanceof Error ? error.message : 'Failed to create integration';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /admin/integrations/:id
 * Update an integration
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description, isEnabled, parameters, events, environments } = req.body;
    const user = req.user as { id: number; name: string };

    const integration = await IntegrationService.update(
      id,
      {
        description,
        isEnabled,
        parameters,
        events,
        environments,
        updatedBy: user.id,
      },
      user
    );

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ data: integration });
  } catch (error) {
    logger.error('Error updating integration:', error);
    const message = error instanceof Error ? error.message : 'Failed to update integration';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /admin/integrations/:id
 * Delete an integration
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as { id: number; name: string };

    const success = await IntegrationService.delete(id, user);

    if (!success) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    logger.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

/**
 * POST /admin/integrations/:id/toggle
 * Toggle integration enabled status
 */
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as { id: number; name: string };

    const integration = await IntegrationService.toggle(id, user);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ data: integration });
  } catch (error) {
    logger.error('Error toggling integration:', error);
    res.status(500).json({ error: 'Failed to toggle integration' });
  }
});

/**
 * GET /admin/integrations/:id/events
 * Get integration event logs
 */
router.get('/:id/events', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Check if integration exists
    const integration = await IntegrationService.getById(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const result = await IntegrationService.getIntegrationEvents(id, page, limit);

    res.json({
      data: result.events,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    logger.error('Error getting integration events:', error);
    res.status(500).json({ error: 'Failed to get integration events' });
  }
});

/**
 * POST /admin/integrations/:id/test
 * Send a test message to the integration
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as { id: number; name: string };

    const integration = await IntegrationService.getById(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await IntegrationService.sendTestMessage(id, user);
    res.json({ success: true, message: 'Test message sent successfully' });
  } catch (error) {
    logger.error('Error sending test message:', error);
    const message = error instanceof Error ? error.message : 'Failed to send test message';
    res.status(400).json({ error: message });
  }
});

export default router;
