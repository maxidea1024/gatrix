import Redis from 'ioredis';
import { config } from '../config';
import { CHANNELS, CONFIG_TYPES } from '../config/redis-keys';
import { createLogger } from './logger';
import { issueLookupCache } from '../processing/issue-cache';

const logger = createLogger('config-subscriber');

/**
 * Central subscriber for config change notifications in the worker process.
 *
 * Coordinates cache invalidation across all in-memory stores when the
 * API broadcasts changes via Redis Pub/Sub.
 *
 * Note: AlertRuleStore and DsnStore each manage their own subscriptions.
 * This subscriber handles issue-level invalidation (status changes)
 * that affect IssueLookupCache.
 */
export class ConfigSubscriber {
  private subscriber: Redis | null = null;

  async init(): Promise<void> {
    this.subscriber = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: null,
    });

    await this.subscriber.subscribe(CHANNELS.CONFIG_CHANGED);
    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const payload = JSON.parse(message);

        switch (payload.type) {
          case CONFIG_TYPES.ISSUE_STATUS:
            if (payload.issueId) {
              issueLookupCache.invalidateByIssueId(payload.issueId);
              logger.debug('Issue cache invalidated', { issueId: payload.issueId });
            }
            break;

          case CONFIG_TYPES.PROJECT_SETTINGS:
            if (payload.projectId) {
              issueLookupCache.invalidateByProjectId(payload.projectId);
              logger.debug('Project issue cache invalidated', { projectId: payload.projectId });
            }
            break;

          // AlertRuleStore and DsnStore handle their own types
        }
      } catch (e) {
        logger.warn('Failed to process config change in subscriber', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });

    logger.info('ConfigSubscriber initialized');
  }

  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

export const configSubscriber = new ConfigSubscriber();
