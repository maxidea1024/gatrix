import { mysqlPool, createLogger } from '@gatrix/argus';

const logger = createLogger('alert-rule-store');

interface AlertRule {
  id: number;
  project_id: string;
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
 * - ConfigSubscriber handles Pub/Sub dispatch for cache invalidation.
 * - No TTL — purely event-driven cache refresh.
 *
 * This eliminates per-event MySQL queries for alert rules.
 */
export class AlertRuleStore {
  private rules: Map<string, AlertRule[]> = new Map(); // projectId → rules[]

  /**
   * Initialize store: load all rules from MySQL.
   * Pub/Sub subscription is handled by ConfigSubscriber (single connection).
   */
  async init(): Promise<void> {
    await this.loadAll();
    logger.info('AlertRuleStore initialized', { totalRules: this.totalCount() });
  }

  /**
   * Get all enabled rules for a project. O(1) Map lookup.
   */
  getRules(projectId: string): AlertRule[] {
    return this.rules.get(projectId) || [];
  }

  /**
   * Get rules matching a specific condition type pattern.
   * Used to filter rules for error vs feedback evaluation.
   */
  getRulesWithCondition(projectId: string, conditionPatterns: string[]): AlertRule[] {
    const projectRules = this.rules.get(projectId) || [];
    return projectRules.filter((rule) =>
      conditionPatterns.some((pattern) => rule.conditions.includes(pattern))
    );
  }

  /**
   * Reload rules for a single project (called by ConfigSubscriber on Pub/Sub notification).
   */
  async reloadProject(projectId: string): Promise<void> {
    const [rows] = await mysqlPool.query(
      'SELECT * FROM g_argus_alert_rules WHERE project_id = ? AND enabled = 1',
      [projectId]
    );
    this.rules.set(projectId, rows as AlertRule[]);
    logger.info('Alert rules reloaded', { projectId });
  }

  /**
   * Reload all rules (called by ConfigSubscriber when full reload is needed).
   */
  async reloadAll(): Promise<void> {
    await this.loadAll();
    logger.info('Alert rules fully reloaded', { totalRules: this.totalCount() });
  }

  /**
   * Load all enabled rules from MySQL. Groups by project_id.
   * Builds a new Map and swaps atomically to prevent empty-window during reload.
   */
  private async loadAll(): Promise<void> {
    const [rows] = await mysqlPool.query(
      'SELECT * FROM g_argus_alert_rules WHERE enabled = 1'
    );

    const newRules = new Map<string, AlertRule[]>();
    for (const row of rows as AlertRule[]) {
      const existing = newRules.get(row.project_id) || [];
      existing.push(row);
      newRules.set(row.project_id, existing);
    }

    // Atomic swap — no empty window
    this.rules = newRules;
  }

  private totalCount(): number {
    let count = 0;
    for (const rules of this.rules.values()) count += rules.length;
    return count;
  }

  async close(): Promise<void> {
    // No-op: Pub/Sub is managed by ConfigSubscriber
  }
}

/**
 * Singleton instance — initialized in worker.ts, used by evaluators.
 */
export const alertRuleStore = new AlertRuleStore();
