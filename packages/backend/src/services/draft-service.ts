/**
 * Generic Draft Service
 *
 * Provides a shared draft/publish mechanism for all content types.
 * Content-specific publish logic is delegated to registered DraftHandlers.
 *
 * Pattern follows service-registry.ts (ServiceHandler registry).
 */

import db from '../config/knex';
import { createLogger } from '../config/logger';
import { ulid } from 'ulid';
import { AuditLogModel } from '../models/audit-log';

const logger = createLogger('DraftService');

// ==================== Types ====================

export interface DraftHandler {
  /**
   * Create a snapshot from the current published state
   */
  createSnapshot(targetId: string, environmentId?: string): Promise<any>;

  /**
   * Apply draft data to real tables and perform side effects (cache invalidation, etc.)
   */
  publish(
    targetId: string,
    environmentId: string | undefined,
    draftData: any,
    userId: string
  ): Promise<any>;

  /**
   * (Optional) Validate draft data before saving
   */
  validate?(
    targetId: string,
    draftData: any
  ): Promise<{ valid: boolean; errors?: string[] }>;

  /**
   * (Optional) Get display name for a target
   */
  getDisplayName?(targetId: string): Promise<string | null>;
}

export interface DraftRecord {
  id: string;
  targetType: string;
  targetId: string;
  environmentId?: string | null;
  draftData: any;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Registry ====================

const draftHandlers = new Map<string, DraftHandler>();

export function registerDraftHandler(
  targetType: string,
  handler: DraftHandler
): void {
  draftHandlers.set(targetType, handler);
  logger.info(`Draft handler registered for '${targetType}'`);
}

function getHandler(targetType: string): DraftHandler {
  const handler = draftHandlers.get(targetType);
  if (!handler) {
    throw new Error(
      `No draft handler registered for type '${targetType}'. ` +
        `Registered types: ${Array.from(draftHandlers.keys()).join(', ')}`
    );
  }
  return handler;
}

// ==================== Helper ====================

function parseDraftRecord(row: any): DraftRecord {
  return {
    ...row,
    draftData:
      typeof row.draftData === 'string'
        ? JSON.parse(row.draftData)
        : row.draftData,
  };
}

// ==================== DraftService ====================

export class DraftService {
  /**
   * Get an existing draft
   */
  static async getDraft(
    targetType: string,
    targetId: string,
    environmentId?: string
  ): Promise<DraftRecord | null> {
    const query = db('g_drafts')
      .where('targetType', targetType)
      .where('targetId', targetId);

    if (environmentId) {
      query.where('environmentId', environmentId);
    } else {
      query.whereNull('environmentId');
    }

    const row = await query.first();
    if (!row) return null;
    return parseDraftRecord(row);
  }

  /**
   * Get existing draft, or create a snapshot from published state if none exists
   */
  static async getOrCreateSnapshot(
    targetType: string,
    targetId: string,
    environmentId?: string
  ): Promise<{ draftData: any; isExisting: boolean }> {
    const existing = await this.getDraft(targetType, targetId, environmentId);
    if (existing) {
      return { draftData: existing.draftData, isExisting: true };
    }

    const handler = getHandler(targetType);
    const snapshot = await handler.createSnapshot(targetId, environmentId);
    return { draftData: snapshot, isExisting: false };
  }

  /**
   * Get published (live) snapshot from registered handler
   */
  static async getPublishedSnapshot(
    targetType: string,
    targetId: string,
    environmentId?: string
  ): Promise<any> {
    const handler = getHandler(targetType);
    return handler.createSnapshot(targetId, environmentId);
  }

  /**
   * Get display name for a target (delegates to handler)
   */
  static async getTargetDisplayName(
    targetType: string,
    targetId: string
  ): Promise<string | null> {
    const handler = getHandler(targetType);
    if (handler.getDisplayName) {
      return handler.getDisplayName(targetId);
    }
    return null;
  }

  /**
   * Save (create or update) a draft
   */
  static async saveDraft(
    targetType: string,
    targetId: string,
    environmentId: string | undefined,
    draftData: any,
    userId: string
  ): Promise<DraftRecord> {
    // Validate if handler supports it
    const handler = getHandler(targetType);
    if (handler.validate) {
      const result = await handler.validate(targetId, draftData);
      if (!result.valid) {
        throw new Error(
          `Draft validation failed: ${result.errors?.join(', ')}`
        );
      }
    }

    const existing = await this.getDraft(targetType, targetId, environmentId);

    if (existing) {
      // Update existing draft
      await db('g_drafts')
        .where('id', existing.id)
        .update({
          draftData: JSON.stringify(draftData),
          updatedBy: userId,
          updatedAt: new Date(),
        });
    } else {
      // Create new draft
      const id = ulid();
      await db('g_drafts').insert({
        id,
        targetType,
        targetId,
        environmentId: environmentId || null,
        draftData: JSON.stringify(draftData),
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Audit log
    await AuditLogModel.create({
      action: `${targetType}.draft_saved`,
      description: `Draft saved for ${targetType} '${targetId}'${environmentId ? ` in [${environmentId}]` : ''}`,
      resourceType: targetType,
      resourceId: targetId,
      userId,
      environmentId,
      newValues: { draftData },
    });

    logger.info(
      `Draft saved: ${targetType}/${targetId}${environmentId ? `/${environmentId}` : ''}`
    );
    return (await this.getDraft(targetType, targetId, environmentId))!;
  }

  /**
   * Publish draft: delegate to handler to apply changes, then delete draft
   */
  static async publishDraft(
    targetType: string,
    targetId: string,
    environmentId: string | undefined,
    userId: string
  ): Promise<any> {
    const draft = await this.getDraft(targetType, targetId, environmentId);
    if (!draft) {
      throw new Error('No draft to publish');
    }

    const handler = getHandler(targetType);

    // Apply changes via handler
    const result = await handler.publish(
      targetId,
      environmentId,
      draft.draftData,
      userId
    );

    // Delete draft after successful publish
    await db('g_drafts').where('id', draft.id).del();

    // Audit log
    await AuditLogModel.create({
      action: `${targetType}.draft_published`,
      description: `Draft published for ${targetType} '${targetId}'${environmentId ? ` in [${environmentId}]` : ''}`,
      resourceType: targetType,
      resourceId: targetId,
      userId,
      environmentId,
      oldValues: { draftData: draft.draftData },
      newValues: result,
    });

    logger.info(
      `Draft published: ${targetType}/${targetId}${environmentId ? `/${environmentId}` : ''}`
    );
    return result;
  }

  /**
   * Discard draft without applying
   */
  static async discardDraft(
    targetType: string,
    targetId: string,
    environmentId?: string,
    userId?: string
  ): Promise<void> {
    const draft = await this.getDraft(targetType, targetId, environmentId);
    if (!draft) {
      // No draft exists — might have been auto-saved but not yet, or already discarded
      return;
    }

    await db('g_drafts').where('id', draft.id).del();

    // Audit log
    if (userId) {
      await AuditLogModel.create({
        action: `${targetType}.draft_discarded`,
        description: `Draft discarded for ${targetType} '${targetId}'${environmentId ? ` in [${environmentId}]` : ''}`,
        resourceType: targetType,
        resourceId: targetId,
        userId,
        environmentId,
      });
    }

    logger.info(
      `Draft discarded: ${targetType}/${targetId}${environmentId ? `/${environmentId}` : ''}`
    );
  }

  /**
   * Check if a draft exists
   */
  static async hasDraft(
    targetType: string,
    targetId: string,
    environmentId?: string
  ): Promise<boolean> {
    const draft = await this.getDraft(targetType, targetId, environmentId);
    return draft !== null;
  }

  /**
   * List all drafts for a given type (optionally filtered by environment)
   */
  static async listDrafts(
    targetType: string,
    environmentId?: string
  ): Promise<DraftRecord[]> {
    const query = db('g_drafts').where('targetType', targetType);

    if (environmentId) {
      query.where('environmentId', environmentId);
    }

    const rows = await query.orderBy('updatedAt', 'desc');
    return rows.map(parseDraftRecord);
  }
}
