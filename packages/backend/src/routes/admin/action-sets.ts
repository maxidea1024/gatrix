/**
 * Action Set Routes
 *
 * Admin API endpoints for managing action sets (automated actions).
 */

import { Router, Request, Response } from 'express';
import { ActionSetModel } from '../../models/action-set';
import { createLogger } from '../../config/logger';
import {
  sendConflict,
  sendBadRequest,
  sendNotFound,
  sendInternalError,
} from '../../utils/api-response';
import { ErrorCodes } from '@gatrix/shared';
import { TagService } from '../../services/tag-service';

const router = Router();
const logger = createLogger('ActionSetRoutes');

/**
 * GET /admin/actions
 * Get all action sets
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const actionSets = await ActionSetModel.findAll((req as any).projectId);
    // Load tags for each action set
    const actionSetsWithTags = await Promise.all(
      actionSets.map(async (actionSet) => {
        const tags = await TagService.listTagsForEntity(
          'action_set',
          actionSet.id
        );
        return { ...actionSet, tags };
      })
    );
    res.json({ data: actionSetsWithTags });
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
    const id = req.params.id;
    const actionSet = await ActionSetModel.findById(id);

    if (!actionSet) {
      return res.status(404).json({ error: 'Action set not found' });
    }

    const tags = await TagService.listTagsForEntity('action_set', id);
    res.json({ data: { ...actionSet, tags } });
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
    const { tags, ...rest } = req.body;
    const {
      name,
      description,
      isEnabled,
      actorId,
      source,
      sourceId,
      filters,
      actions,
    } = rest;
    const user = req.user as { id: string; name: string };
    const projectId = (req as any).projectId;

    if (!name || !name.trim()) {
      return sendBadRequest(res, 'Name is required');
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return sendBadRequest(res, 'At least one action is required');
    }

    if (!sourceId) {
      return sendBadRequest(res, 'Signal endpoint selection is required');
    }

    // Check for duplicate name within the same project
    const allSets = await ActionSetModel.findAll(projectId);
    const duplicate = allSets.find((s) => s.name === name.trim());
    if (duplicate) {
      return sendConflict(
        res,
        'An action set with this name already exists',
        ErrorCodes.RESOURCE_ALREADY_EXISTS
      );
    }

    const actionSet = await ActionSetModel.create({
      name: name.trim(),
      description,
      isEnabled,
      actorId: actorId || user.id,
      source: source || 'signal-endpoint',
      sourceId,
      filters,
      actions,
      projectId,
      createdBy: user.id,
    });

    // Handle tags
    if (tags && Array.isArray(tags)) {
      const tagIds = tags.map((tag: any) => tag.id).filter((tid: any) => tid);
      await TagService.setTagsForEntity(
        'action_set',
        actionSet.id,
        tagIds,
        user.id
      );
    }

    const tagsForEntity = await TagService.listTagsForEntity(
      'action_set',
      actionSet.id
    );
    res.status(201).json({ data: { ...actionSet, tags: tagsForEntity } });
  } catch (error) {
    logger.error('Error creating action set:', error);
    return sendInternalError(res, 'Failed to create action set', error);
  }
});

/**
 * PUT /admin/actions/:id
 * Update an action set
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { tags, ...rest } = req.body;
    const {
      name,
      description,
      isEnabled,
      actorId,
      source,
      sourceId,
      filters,
      actions,
    } = rest;
    const user = req.user as { id: string; name: string };
    const projectId = (req as any).projectId;

    // Check for duplicate name if name is being changed
    if (name && name.trim()) {
      const allSets = await ActionSetModel.findAll(projectId);
      const duplicate = allSets.find(
        (s) => s.name === name.trim() && s.id !== id
      );
      if (duplicate) {
        return sendConflict(
          res,
          'An action set with this name already exists',
          ErrorCodes.RESOURCE_ALREADY_EXISTS
        );
      }
    }

    const actionSet = await ActionSetModel.update(id, {
      name,
      description,
      isEnabled,
      actorId,
      source: source || 'signal-endpoint',
      sourceId,
      filters,
      actions,
      updatedBy: user.id,
    });

    if (!actionSet) {
      return sendNotFound(res, 'Action set not found');
    }

    // Handle tags
    if (tags !== undefined) {
      const tagIds = Array.isArray(tags)
        ? tags.map((tag: any) => tag.id).filter((tid: any) => tid)
        : [];
      await TagService.setTagsForEntity('action_set', id, tagIds, user.id);
    }

    const tagsForEntity = await TagService.listTagsForEntity('action_set', id);
    res.json({ data: { ...actionSet, tags: tagsForEntity } });
  } catch (error) {
    logger.error('Error updating action set:', error);
    return sendInternalError(res, 'Failed to update action set', error);
  }
});

/**
 * DELETE /admin/actions/:id
 * Delete an action set
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
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
    const id = req.params.id;
    const user = req.user as { id: string; name: string };

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
    const id = req.params.id;
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
