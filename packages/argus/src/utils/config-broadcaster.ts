import Redis from 'ioredis';
import { CHANNELS } from '../config/redis-keys';
import { createLogger } from './logger';

const logger = createLogger('config-broadcaster');

/**
 * Publish config change notifications to all workers via Redis Pub/Sub.
 *
 * Used by API routes after CRUD operations on:
 * - Alert rules
 * - DSN keys
 * - Project settings
 * - Issue status changes
 */
export class ConfigBroadcaster {
  constructor(private redis: Redis) {}

  /**
   * Broadcast a config change event.
   * All workers subscribed to the channel will receive this notification
   * and invalidate their relevant in-memory caches.
   */
  async publish(payload: {
    type: string;
    projectId?: string | number;
    issueId?: number;
  }): Promise<void> {
    try {
      await this.redis.publish(
        CHANNELS.CONFIG_CHANGED,
        JSON.stringify(payload)
      );
    } catch (error) {
      logger.error('Failed to broadcast config change', {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
