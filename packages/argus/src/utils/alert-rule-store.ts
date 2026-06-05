import { mysqlPool } from '../config/mysql';
import { createLogger } from './logger';
import { CHANNELS, CONFIG_TYPES } from '../config/redis-keys';
import Redis from 'ioredis';
import { config } from '../config';

const logger = createLogger('alert-rule-store');

interface AlertRule {
  id: number;
  project_id: number;
  name: string;
  conditions: string;
  actions: string;
  frequency: number;
  environment: string | null;
  level: string | null;
  enabled: boolean;
  tags: string | null;
  last_triggered_at: string | null;
  muted_until: string | null;
  condition_logic: string | null;
}

/**
 * In-memory store for alert rules.
 *
 * Strategy:
 * - Load all rules once on worker startup.
 * - Subscribe to Pub/Sub for instant invalidation on CRUD operations.
 * - No TTL — purely event-driven cache refresh.
 *
 * This eliminates per-event MySQL queries for alert rules.
 */
export class AlertRuleStore {
  private rules: Map<number, AlertRule[]> = new Map(); // projectId → rules[]
  private subscriber: Redis | null = null;

  /**
   * Initialize store: load all rules from MySQL, then subscribe to Pub/Sub.
   * Must be called once at worker startup.
   */
  async init(): Promise<void> {
    // 1. Full load from MySQL
    await this.loadAll();

    // 2. Subscribe to config changes for live invalidation
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
        const { type, projectId } = JSON.parse(message);
        if (type === CONFIG_TYPES.ALERT_RULES && projectId) {
          await this.reloadProject(projectId);
          logger.info('Alert rules reloaded via Pub/Sub', { projectId });
        }
      } catch (e) {
        logger.warn('Failed to process config change message', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });

    logger.info('AlertRuleStore initialized', { totalRules: this.totalCount() });
  }

  /**
   * Get all enabled rules for a project. O(1) Map lookup + filter.
   * Returns an empty array if the project has no rules.
   */
  getRules(projectId: number): AlertRule[] {
    return this.rules.get(projectId) || [];
  }

  /**
   * Get rules matching a specific condition type pattern.
   * Used to filter rules for error vs feedback evaluation.
   */
  getRulesWithCondition(projectId: number, conditionPatterns: string[]): AlertRule[] {
    const projectRules = this.rules.get(projectId) || [];
    return projectRules.filter((rule) =>
      conditionPatterns.some((pattern) => rule.conditions.includes(pattern))
    );
  }

  /**
   * Reload rules for a single project (called on Pub/Sub notification).
   */
  async reloadProject(projectId: number): Promise<void> {
    const [rows] = await mysqlPool.query(
      'SELECT * FROM g_argus_alert_rules WHERE project_id = ? AND enabled = 1',
      [projectId]
    );
    this.rules.set(projectId, rows as AlertRule[]);
  }

  /**
   * Load all enabled rules from MySQL. Groups by project_id.
   */
  private async loadAll(): Promise<void> {
    const [rows] = await mysqlPool.query(
      'SELECT * FROM g_argus_alert_rules WHERE enabled = 1'
    );

    this.rules.clear();
    for (const row of rows as AlertRule[]) {
      const existing = this.rules.get(row.project_id) || [];
      existing.push(row);
      this.rules.set(row.project_id, existing);
    }
  }

  private totalCount(): number {
    let count = 0;
    for (const rules of this.rules.values()) count += rules.length;
    return count;
  }

  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

/**
 * Singleton instance — initialized in worker.ts, used by evaluators.
 */
export const alertRuleStore = new AlertRuleStore();
