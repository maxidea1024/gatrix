/**
 * Segment Draft Handler
 *
 * Implements the DraftHandler interface for feature segments.
 * Segments are global (no per-environment data).
 * Draft data structure: { displayName, description, constraints, isActive, tags }
 */

import { FeatureSegmentModel } from '../../models/FeatureFlag';
import { registerDraftHandler } from '../draft-service';
import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('SegmentDraftHandler');

const segmentDraftHandler = {
  /**
   * Create a snapshot from the current published state
   */
  async createSnapshot(targetId: string): Promise<Record<string, any>> {
    const segment = await FeatureSegmentModel.findById(targetId);
    if (!segment) {
      throw new Error(`Segment '${targetId}' not found`);
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
   * Apply draft data to real tables
   */
  async publish(
    targetId: string,
    _environmentId: string | undefined,
    draftData: Record<string, any>,
    userId: string
  ): Promise<any> {
    const segment = await FeatureSegmentModel.findById(targetId);
    if (!segment) {
      throw new Error(`Segment '${targetId}' not found`);
    }

    const updateData: any = { updatedBy: userId };

    if (draftData.displayName !== undefined) {
      updateData.displayName = draftData.displayName;
    }
    if (draftData.description !== undefined) {
      updateData.description = draftData.description;
    }
    if (draftData.constraints !== undefined) {
      updateData.constraints = draftData.constraints;
    }
    if (draftData.isActive !== undefined) {
      updateData.isActive = draftData.isActive;
    }
    if (draftData.tags !== undefined) {
      updateData.tags = draftData.tags;
    }

    await FeatureSegmentModel.update(targetId, updateData);

    logger.info(`Segment draft published: ${targetId}`);

    return { segmentId: targetId };
  },

  /**
   * Get segment name for display
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
