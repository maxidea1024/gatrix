/**
 * Action Set Routes
 *
 * Admin API endpoints for managing action sets (automated actions).
 */

import { Router, Request, Response } from 'express';
import { ActionSetModel } from '../../models/ActionSet';
import { createLogger } from '../../config/logger';

const router = Router();
const logger = createLogger('ActionSetRoutes');

/**
 * GET /admin/actions
 * Get all action sets
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const actionSets = await ActionSetModel.findAll();
        res.json({ data: actionSets });
    } catch (error) {
        logger.error('Error getting action sets:', error);
        res.status(500).json({ error: 'Failed to get action sets' });
    }
});

/**
 * GET /admin/actions/:id
 * Get a specific action set
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const actionSet = await ActionSetModel.findById(id);

        if (!actionSet) {
            return res.status(404).json({ error: 'Action set not found' });
        }

        res.json({ data: actionSet });
    } catch (error) {
        logger.error('Error getting action set:', error);
        res.status(500).json({ error: 'Failed to get action set' });
    }
});

/**
 * POST /admin/actions
 * Create a new action set
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name, description, isEnabled, actorId, source, sourceId, filters, actions } = req.body;
        const user = req.user as { id: number; name: string };

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (!actions || !Array.isArray(actions) || actions.length === 0) {
            return res.status(400).json({ error: 'At least one action is required' });
        }

        const actionSet = await ActionSetModel.create({
            name: name.trim(),
            description,
            isEnabled,
            actorId,
            source,
            sourceId,
            filters,
            actions,
            createdBy: user.id,
        });

        res.status(201).json({ data: actionSet });
    } catch (error) {
        logger.error('Error creating action set:', error);
        const message = error instanceof Error ? error.message : 'Failed to create action set';
        res.status(400).json({ error: message });
    }
});

/**
 * PUT /admin/actions/:id
 * Update an action set
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const { name, description, isEnabled, actorId, source, sourceId, filters, actions } = req.body;
        const user = req.user as { id: number; name: string };

        const actionSet = await ActionSetModel.update(id, {
            name,
            description,
            isEnabled,
            actorId,
            source,
            sourceId,
            filters,
            actions,
            updatedBy: user.id,
        });

        if (!actionSet) {
            return res.status(404).json({ error: 'Action set not found' });
        }

        res.json({ data: actionSet });
    } catch (error) {
        logger.error('Error updating action set:', error);
        const message = error instanceof Error ? error.message : 'Failed to update action set';
        res.status(400).json({ error: message });
    }
});

/**
 * DELETE /admin/actions/:id
 * Delete an action set
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const success = await ActionSetModel.delete(id);

        if (!success) {
            return res.status(404).json({ error: 'Action set not found' });
        }

        res.json({ message: 'Action set deleted successfully' });
    } catch (error) {
        logger.error('Error deleting action set:', error);
        res.status(500).json({ error: 'Failed to delete action set' });
    }
});

/**
 * POST /admin/actions/:id/toggle
 * Toggle action set enabled status
 */
router.post('/:id/toggle', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const user = req.user as { id: number; name: string };

        const actionSet = await ActionSetModel.toggleEnabled(id, user.id);

        if (!actionSet) {
            return res.status(404).json({ error: 'Action set not found' });
        }

        res.json({ data: actionSet });
    } catch (error) {
        logger.error('Error toggling action set:', error);
        res.status(500).json({ error: 'Failed to toggle action set' });
    }
});

/**
 * GET /admin/actions/:id/events
 * Get execution events for an action set
 */
router.get('/:id/events', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const actionSet = await ActionSetModel.findById(id);
        if (!actionSet) {
            return res.status(404).json({ error: 'Action set not found' });
        }

        const result = await ActionSetModel.findEvents(id, limit, offset);

        res.json({
            data: result.events,
            pagination: {
                total: result.total,
                limit,
                offset,
            },
        });
    } catch (error) {
        logger.error('Error getting action set events:', error);
        res.status(500).json({ error: 'Failed to get action set events' });
    }
});

export default router;
