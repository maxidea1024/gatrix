import Redis from 'ioredis';
import {
  config,
  CHANNELS,
  CONFIG_TYPES,
  createLogger,
  dsnStore,
} from '@gatrix/argus';

import { issueLookupCache } from '../processing/issue-cache';
import { alertRuleStore } from './alert-rule-store';

const logger = createLogger('config-subscriber');

/**
 * Central subscriber for config change notifications in the worker process.
 *
 * Coordinates cache invalidation across ALL in-memory stores via a single
 * Redis Pub/Sub connection (instead of per-store connections):
 * - AlertRuleStore: reloads project-specific or all rules
 * - DsnStore: reloads all DSN keys
 * - IssueLookupCache: invalidates by issue or project
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
    this.subscriber.on('message', async (_channel: string, message: string) => {
      try {
        const payload = JSON.parse(message);

        switch (payload.type) {
          case CONFIG_TYPES.ALERT_RULES:
            if (payload.projectId) {
              await alertRuleStore.reloadProject(payload.projectId);
            } else {
              await alertRuleStore.reloadAll();
            }
            break;

          case CONFIG_TYPES.DSN_KEYS:
            await dsnStore.loadAll();
            logger.debug('DSN keys reloaded via Pub/Sub', {
              count: 'reloaded',
            });
            break;

          case CONFIG_TYPES.ISSUE_STATUS:
            if (payload.issueId) {
              issueLookupCache.invalidateByIssueId(payload.issueId);
              logger.debug('Issue cache invalidated', {
                issueId: payload.issueId,
              });
            }
            break;

          case CONFIG_TYPES.PROJECT_SETTINGS:
            if (payload.projectId) {
              issueLookupCache.invalidateByProjectId(payload.projectId);
              logger.debug('Project issue cache invalidated', {
                projectId: payload.projectId,
              });
            }
            break;
        }
      } catch (e) {
        logger.warn('Failed to process config change in subscriber', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });

    logger.info('ConfigSubscriber initialized (unified Pub/Sub handler)');
  }

  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

export const configSubscriber = new ConfigSubscriber();
