/**
 * OutboxService
 *
 * Implements the Outbox Pattern for reliable event publishing.
 * Events are recorded in the database within the same transaction as data changes,
 * then processed asynchronously by a worker.
 */
import { Transaction } from 'objection';
import { ulid } from 'ulid';
import { OutboxEvent, OutboxEventType, OUTBOX_EVENT_TYPES } from '../models/OutboxEvent';
import logger from '../config/logger';
import { pubSubService } from './PubSubService';
import knex from '../config/knex';

export interface OutboxEventData {
  changeRequestId: string;
  entityType: string;
  entityId: string;
  eventType: OutboxEventType;
  payload: Record<string, any>;
}

export class OutboxService {
  /**
   * Record an event in the outbox (within a transaction)
   */
  static async recordEvent(data: OutboxEventData, trx?: Transaction): Promise<OutboxEvent> {
    const event = await OutboxEvent.query(trx).insert({
      id: ulid(),
      changeRequestId: data.changeRequestId,
      entityType: data.entityType,
      entityId: data.entityId,
      eventType: data.eventType,
      payload: data.payload,
      status: 'pending',
      retryCount: 0,
    });

    logger.debug(
      `[OutboxService] Event recorded: ${data.entityType}:${data.entityId} (${data.eventType})`
    );
    return event;
  }

  /**
   * Record multiple events for a CR apply (within transaction)
   *
   * This method:
   * 1. Collects all changes
   * 2. Calculates final state diff
   * 3. Removes redundant events (e.g., create then delete = no event)
   * 4. Records deduplicated events
   */
  static async recordCREvents(
    changeRequestId: string,
    changes: Array<{
      entityType: string;
      entityId: string;
      beforeData: any;
      afterData: any;
      isCreate: boolean;
      isDelete: boolean;
    }>,
    trx?: Transaction
  ): Promise<OutboxEvent[]> {
    // Group by entity to detect redundant operations
    const entityMap = new Map<
      string,
      {
        entityType: string;
        entityId: string;
        originalBefore: any;
        finalAfter: any;
        wasCreated: boolean;
        wasDeleted: boolean;
      }
    >();

    for (const change of changes) {
      const key = `${change.entityType}:${change.entityId}`;
      const existing = entityMap.get(key);

      if (existing) {
        // Update final state
        existing.finalAfter = change.afterData;
        existing.wasDeleted = existing.wasDeleted || change.isDelete;
      } else {
        entityMap.set(key, {
          entityType: change.entityType,
          entityId: change.entityId,
          originalBefore: change.beforeData,
          finalAfter: change.afterData,
          wasCreated: change.isCreate,
          wasDeleted: change.isDelete,
        });
      }
    }

    const events: OutboxEvent[] = [];

    for (const [, entity] of entityMap) {
      // Skip if created and then deleted (no net change)
      if (entity.wasCreated && entity.wasDeleted) {
        logger.debug(
          `[OutboxService] Pruned event: ${entity.entityType}:${entity.entityId} (created then deleted)`
        );
        continue;
      }

      // Skip if no actual change (before === after)
      if (!entity.wasCreated && !entity.wasDeleted) {
        const hasChange =
          JSON.stringify(entity.originalBefore) !== JSON.stringify(entity.finalAfter);
        if (!hasChange) {
          logger.debug(
            `[OutboxService] Pruned event: ${entity.entityType}:${entity.entityId} (no net change)`
          );
          continue;
        }
      }

      // Determine event type
      let eventType: OutboxEventType;
      if (entity.wasCreated) {
        eventType = OUTBOX_EVENT_TYPES.CREATED;
      } else if (entity.wasDeleted) {
        eventType = OUTBOX_EVENT_TYPES.DELETED;
      } else {
        eventType = OUTBOX_EVENT_TYPES.UPDATED;
      }

      const event = await this.recordEvent(
        {
          changeRequestId,
          entityType: entity.entityType,
          entityId: entity.entityId,
          eventType,
          payload: {
            before: entity.originalBefore,
            after: entity.finalAfter,
          },
        },
        trx
      );

      events.push(event);
    }

    logger.info(
      `[OutboxService] Recorded ${events.length} events for CR ${changeRequestId} (pruned ${changes.length - events.length})`
    );
    return events;
  }

  /**
   * Process pending events (called by worker)
   */
  static async processPendingEvents(batchSize: number = 10): Promise<number> {
    let processed = 0;

    // Get pending events
    const events = await OutboxEvent.query()
      .where('status', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(batchSize);

    for (const event of events) {
      try {
        // Mark as processing
        await event.$query().patch({ status: 'processing' });

        // Publish event
        await this.publishEvent(event);

        // Mark as completed
        await event.$query().patch({
          status: 'completed',
          processedAt: new Date(),
        });

        processed++;
        logger.debug(`[OutboxService] Processed event ${event.id}`);
      } catch (error: any) {
        // Mark as failed with retry
        const newRetryCount = event.retryCount + 1;
        const maxRetries = 3;

        if (newRetryCount >= maxRetries) {
          await event.$query().patch({
            status: 'failed',
            retryCount: newRetryCount,
            errorMessage: error.message,
          });
          logger.error(
            `[OutboxService] Event ${event.id} failed after ${maxRetries} retries:`,
            error
          );
        } else {
          await event.$query().patch({
            status: 'pending', // Back to pending for retry
            retryCount: newRetryCount,
            errorMessage: error.message,
          });
          logger.warn(
            `[OutboxService] Event ${event.id} failed, will retry (${newRetryCount}/${maxRetries})`
          );
        }
      }
    }

    return processed;
  }

  /**
   * Publish a single event via pubsub
   */
  private static async publishEvent(event: OutboxEvent): Promise<void> {
    // Map entity type to event channel
    const channelMap: Record<string, string> = {
      g_service_notices: 'service_notice',
      g_client_versions: 'client_version',
      g_store_products: 'store_product',
      g_surveys: 'survey',
      g_ingame_popup_notices: 'ingame_popup_notice',
      g_game_worlds: 'game_world',
      g_banners: 'banner',
      g_vars: 'vars',
      g_message_templates: 'message_template',
    };

    const channel = channelMap[event.entityType] || event.entityType.replace('g_', '');
    const eventName = `${channel}.${event.eventType}`;

    await pubSubService.publishSDKEvent({
      type: eventName,
      data: {
        entityId: event.entityId,
        eventType: event.eventType,
        payload: event.payload,
        changeRequestId: event.changeRequestId,
        timestamp: new Date().toISOString(),
      },
    });

    logger.debug(`[OutboxService] Published event: ${eventName}`);
  }

  /**
   * Clean up old completed/failed events
   */
  static async cleanupOldEvents(retentionDays: number = 7): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - retentionDays);
    const isoThreshold = thresholdDate.toISOString().slice(0, 19).replace('T', ' ');

    const deleted = await OutboxEvent.query()
      .whereIn('status', ['completed', 'failed'])
      .where('createdAt', '<', isoThreshold)
      .delete();

    if (deleted > 0) {
      logger.info(`[OutboxService] Cleaned up ${deleted} old events`);
    }
    return deleted;
  }

  /**
   * Get event statistics
   */
  static async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stats = await knex('g_outbox_events')
      .select('status')
      .count('* as count')
      .groupBy('status');

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of stats) {
      const status = row.status as keyof typeof result;
      result[status] = Number(row.count);
    }

    return result;
  }
}
