import { createLogger } from '../config/logger';
import { CcuHistoryModel } from '../models/ccu-history';
import db from '../config/knex';

const logger = createLogger('CcuPollingService');

// Default retention (days)
const DEFAULT_RETENTION_DAYS = 14;

/**
 * CCU Polling Service
 *
 * Polls admind API for concurrent user counts and stores
 * the results in g_ccu_history for historical graphing.
 * Invoked by BullMQ scheduler job 'ccu:poll' (every minute).
 */
export class CcuPollingService {
  /**
   * Get retention days from environment variable
   */
  getRetentionDays(): number {
    const envVal = process.env.CCU_HISTORY_RETENTION_DAYS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_RETENTION_DAYS;
  }

  /**
   * Poll all environments that have admindApiUrl configured
   */
  async pollAll(): Promise<void> {
    try {
      // Find all environments that have admindApiUrl set
      const rows = await db('g_vars')
        .select('environmentId', 'varValue')
        .where('varKey', 'admindApiUrl')
        .whereNotNull('varValue')
        .where('varValue', '!=', '');

      if (rows.length === 0) {
        logger.debug('No environments with admindApiUrl configured, skipping CCU poll');
        return;
      }

      const now = new Date();

      for (const row of rows) {
        try {
          await this.pollEnvironment(row.environmentId, row.varValue, now);
        } catch (err: any) {
          logger.warn(`CCU poll failed for env ${row.environmentId}: ${err.message}`);
        }
      }

      // Cleanup old records
      await CcuHistoryModel.cleanupOlderThan(this.getRetentionDays());
    } catch (err: any) {
      logger.error('CCU pollAll error:', err);
    }
  }

  /**
   * Poll a single environment's admind API
   */
  private async pollEnvironment(
    environmentId: string,
    admindApiUrl: string,
    recordedAt: Date
  ): Promise<void> {
    const baseUrl = admindApiUrl.replace(/\/+$/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${baseUrl}/gatrix/v1/ccu`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`Admind CCU endpoint returned ${response.status} for env ${environmentId}`);
        return;
      }

      const data: any = await response.json();

      const records: Array<{
        environmentId: string;
        worldId: string | null;
        worldName: string | null;
        playerCount: number;
        botCount: number;
        recordedAt: Date;
      }> = [];

      // Total CCU record
      const totalCount = typeof data.total === 'number' ? data.total : 0;
      const totalBotCount = typeof data.botTotal === 'number' ? data.botTotal : 0;
      records.push({
        environmentId,
        worldId: null,
        worldName: null,
        playerCount: totalCount,
        botCount: totalBotCount,
        recordedAt,
      });

      // Per-world records
      if (Array.isArray(data.worlds)) {
        for (const world of data.worlds) {
          records.push({
            environmentId,
            worldId: world.worldId || world.id || 'unknown',
            worldName: world.worldId || null,
            playerCount: typeof world.userCount === 'number' ? world.userCount : 0,
            botCount: typeof world.botCount === 'number' ? world.botCount : 0,
            recordedAt,
          });
        }
      }

      await CcuHistoryModel.insertBatch(records);
      logger.debug(`CCU polled for env ${environmentId}: total=${totalCount}, worlds=${records.length - 1}`);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        logger.warn(`Admind CCU request timed out for env ${environmentId}`);
      } else {
        throw err;
      }
    }
  }
}

// Singleton instance
export const ccuPollingService = new CcuPollingService();
