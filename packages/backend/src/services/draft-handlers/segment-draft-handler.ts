/**
 * Segment Draft Handler
 *
 * Implements the DraftHandler interface for feature segments.
 * Segments are global (no per-environment data).
 *
 * Supports three actions via `_action` field:
 *   - 'create': Create a new segment on publish
 *   - 'update': Modify an existing segment on publish (default)
 *   - 'delete': Delete a segment on publish
 */

import { FeatureSegmentModel } from '../../models/FeatureFlag';
import { registerDraftHandler } from '../draft-service';
import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('SegmentDraftHandler');

const segmentDraftHandler = {
  /**
   * Create a snapshot from the current published state.
   * Returns null for new segments (create action).
   */
  async createSnapshot(targetId: string): Promise<Record<string, any> | null> {
    const segment = await FeatureSegmentModel.findById(targetId);
    if (!segment) {
      // New segment — no published state
      return null;
    }

    return {
      displayName: segment.displayName,
      description: segment.description,
      constraints: segment.constraints || [],
      isActive: segment.isActive ?? true,
      tags: segment.tags || [],
    };
  },

  /**
   * Apply draft data to real tables.
   * Handles create / update / delete based on _action.
   */
  async publish(
    targetId: string,
    _environmentId: string | undefined,
    draftData: Record<string, any>,
    userId: string
  ): Promise<any> {
    const action = draftData._action || 'update';

    if (action === 'create') {
      // Create a new segment
      const { _action, _projectId, ...segmentData } = draftData;
      const created = await FeatureSegmentModel.create({
        ...segmentData,
        projectId: _projectId,
        createdBy: userId,
      } as any);
      logger.info(`Segment draft published (create): ${created.id}`);
      return { segmentId: created.id, action: 'create' };
    }

    if (action === 'delete') {
      await FeatureSegmentModel.delete(targetId);
      logger.info(`Segment draft published (delete): ${targetId}`);
      return { segmentId: targetId, action: 'delete' };
    }

    // Default: update
    const segment = await FeatureSegmentModel.findById(targetId);
    if (!segment) {
      throw new Error(`Segment '${targetId}' not found`);
    }

    const { _action, ...updateFields } = draftData;
    await FeatureSegmentModel.update(targetId, {
      ...updateFields,
      updatedBy: userId,
    });

    logger.info(`Segment draft published (update): ${targetId}`);
    return { segmentId: targetId, action: 'update' };
  },

  /**
   * Get segment name for display.
   * For create drafts, returns the segmentName from draft data.
   */
  async getDisplayName(targetId: string): Promise<string | null> {
    const segment = await db('g_feature_segments')
      .select('segmentName')
      .where('id', targetId)
      .first();
    return segment?.segmentName || null;
  },
};

// ==================== Registration ====================

export function registerSegmentDraftHandler(): void {
  registerDraftHandler('segment', segmentDraftHandler);
}
