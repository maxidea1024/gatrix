/**
 * SafeguardService
 *
 * Manages safeguard configurations for release flow milestones.
 * Safeguards monitor impact metrics and automatically pause release plans
 * when metric thresholds are breached.
 *
 * - CRUD operations on g_release_flow_safeguards table
 * - Evaluation: queries ImpactMetricsService (Prometheus) and compares against thresholds
 * - Used by releaseFlowScheduler to evaluate safeguards before milestone transitions
 */

import db from '../config/knex';
import logger from '../config/logger';
import { impactMetricsService } from './ImpactMetricsService';
import { ulid } from 'ulid';

// ==================== Types ====================

export interface Safeguard {
  id: string;
  flowId: string;
  milestoneId: string;
  metricName: string;
  displayName: string | null;
  aggregationMode: string; // rps, count, avg, sum, p50, p95, p99
  operator: string; // > or <
  threshold: number;
  timeRangeMinutes: number; // time range in minutes
  labelFilters: Record<string, string> | null; // label-based filtering
  action: string; // pause
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSafeguardInput {
  flowId: string;
  milestoneId: string;
  metricName: string;
  displayName?: string;
  aggregationMode?: string;
  operator?: string;
  threshold: number;
  timeRangeMinutes?: number;
  labelFilters?: Record<string, string>;
  action?: string;
}

export interface UpdateSafeguardInput {
  metricName?: string;
  displayName?: string | null;
  aggregationMode?: string;
  operator?: string;
  threshold?: number;
  timeRangeMinutes?: number;
  labelFilters?: Record<string, string> | null;
  action?: string;
}

export interface SafeguardEvaluationResult {
  safeguardId: string;
  metricName: string;
  currentValue: number | null;
  threshold: number;
  operator: string;
  triggered: boolean;
  error?: string;
}

// ==================== Service ====================

const TABLE_NAME = 'g_release_flow_safeguards';

class SafeguardService {
  // ==================== CRUD ====================

  /**
   * Create a new safeguard
   */
  async create(input: CreateSafeguardInput): Promise<Safeguard> {
    const id = ulid();
    const safeguard: Record<string, any> = {
      id,
      flowId: input.flowId,
      milestoneId: input.milestoneId,
      metricName: input.metricName,
      displayName: input.displayName || null,
      aggregationMode: input.aggregationMode || 'count',
      operator: input.operator || '>',
      threshold: input.threshold,
      timeRangeMinutes: input.timeRangeMinutes || 60,
      labelFilters: input.labelFilters ? JSON.stringify(input.labelFilters) : null,
      action: input.action || 'pause',
      isTriggered: false,
      triggeredAt: null,
    };

    await db(TABLE_NAME).insert(safeguard);

    logger.info('[Safeguard] Created safeguard', {
      id,
      flowId: input.flowId,
      milestoneId: input.milestoneId,
      metricName: input.metricName,
    });

    return this.getById(id) as Promise<Safeguard>;
  }

  /**
   * Get safeguard by ID
   */
  async getById(id: string): Promise<Safeguard | null> {
    const row = await db(TABLE_NAME).where({ id }).first();
    return row || null;
  }

  /**
   * Get all safeguards for a release flow
   */
  async getByFlowId(flowId: string): Promise<Safeguard[]> {
    return db(TABLE_NAME).where({ flowId }).orderBy('createdAt', 'asc');
  }

  /**
   * Get all safeguards for a specific milestone
   */
  async getByMilestoneId(milestoneId: string): Promise<Safeguard[]> {
    return db(TABLE_NAME).where({ milestoneId }).orderBy('createdAt', 'asc');
  }

  /**
   * Update a safeguard
   */
  async update(id: string, input: UpdateSafeguardInput): Promise<Safeguard | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updateData: Record<string, any> = { ...input };
    if (updateData.labelFilters !== undefined) {
      updateData.labelFilters = updateData.labelFilters
        ? JSON.stringify(updateData.labelFilters)
        : null;
    }

    await db(TABLE_NAME).where({ id }).update(updateData);

    logger.info('[Safeguard] Updated safeguard', { id, ...input });

    return this.getById(id);
  }

  /**
   * Delete a safeguard
   */
  async delete(id: string): Promise<boolean> {
    const deleted = await db(TABLE_NAME).where({ id }).del();
    if (deleted > 0) {
      logger.info('[Safeguard] Deleted safeguard', { id });
    }
    return deleted > 0;
  }

  /**
   * Delete all safeguards for a flow
   */
  async deleteByFlowId(flowId: string): Promise<number> {
    const deleted = await db(TABLE_NAME).where({ flowId }).del();
    logger.info('[Safeguard] Deleted safeguards for flow', { flowId, count: deleted });
    return deleted;
  }

  // ==================== Evaluation ====================

  /**
   * Evaluate all safeguards for a specific milestone
   * Queries Prometheus via ImpactMetricsService and compares against thresholds
   *
   * @returns Array of evaluation results, plus whether any safeguard was triggered
   */
  async evaluateMilestoneSafeguards(milestoneId: string): Promise<{
    results: SafeguardEvaluationResult[];
    anyTriggered: boolean;
  }> {
    const safeguards = await this.getByMilestoneId(milestoneId);

    if (safeguards.length === 0) {
      return { results: [], anyTriggered: false };
    }

    const results: SafeguardEvaluationResult[] = [];
    let anyTriggered = false;

    for (const safeguard of safeguards) {
      // Skip already triggered safeguards
      if (safeguard.isTriggered) {
        results.push({
          safeguardId: safeguard.id,
          metricName: safeguard.metricName,
          currentValue: null,
          threshold: safeguard.threshold,
          operator: safeguard.operator,
          triggered: true,
        });
        anyTriggered = true;
        continue;
      }

      const result = await this.evaluateSingleSafeguard(safeguard);
      results.push(result);

      if (result.triggered) {
        anyTriggered = true;
        // Mark safeguard as triggered in DB
        await db(TABLE_NAME)
          .where({ id: safeguard.id })
          .update({
            isTriggered: true,
            triggeredAt: db.raw('UTC_TIMESTAMP()'),
          });

        logger.warn('[Safeguard] Safeguard triggered!', {
          safeguardId: safeguard.id,
          metricName: safeguard.metricName,
          currentValue: result.currentValue,
          threshold: safeguard.threshold,
          operator: safeguard.operator,
        });
      }
    }

    return { results, anyTriggered };
  }

  /**
   * Evaluate a single safeguard against Prometheus
   */
  private async evaluateSingleSafeguard(safeguard: Safeguard): Promise<SafeguardEvaluationResult> {
    try {
      // Convert minutes to time range string for Prometheus query
      const timeRangeStr = this.minutesToPromRange(safeguard.timeRangeMinutes);
      const currentValue = await impactMetricsService.queryInstant(
        safeguard.metricName,
        safeguard.aggregationMode,
        safeguard.labelFilters || undefined,
        timeRangeStr
      );

      if (currentValue === null) {
        return {
          safeguardId: safeguard.id,
          metricName: safeguard.metricName,
          currentValue: null,
          threshold: safeguard.threshold,
          operator: safeguard.operator,
          triggered: false,
          error: 'No metric data available',
        };
      }

      const triggered = this.compareValue(currentValue, safeguard.operator, safeguard.threshold);

      return {
        safeguardId: safeguard.id,
        metricName: safeguard.metricName,
        currentValue,
        threshold: safeguard.threshold,
        operator: safeguard.operator,
        triggered,
      };
    } catch (error: any) {
      logger.error('[Safeguard] Evaluation error', {
        safeguardId: safeguard.id,
        error: error.message,
      });

      return {
        safeguardId: safeguard.id,
        metricName: safeguard.metricName,
        currentValue: null,
        threshold: safeguard.threshold,
        operator: safeguard.operator,
        triggered: false,
        error: error.message,
      };
    }
  }

  /**
   * Convert minutes to Prometheus-compatible time range string
   */
  private minutesToPromRange(minutes: number): string {
    if (minutes <= 0) return 'hour';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  }

  /**
   * Compare value against threshold using operator
   */
  private compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      default:
        return value > threshold;
    }
  }

  /**
   * Reset a triggered safeguard (for manual override)
   */
  async resetTriggered(id: string): Promise<boolean> {
    const updated = await db(TABLE_NAME).where({ id }).update({
      isTriggered: false,
      triggeredAt: null,
    });

    if (updated > 0) {
      logger.info('[Safeguard] Reset triggered safeguard', { id });
    }
    return updated > 0;
  }
}

export const safeguardService = new SafeguardService();
