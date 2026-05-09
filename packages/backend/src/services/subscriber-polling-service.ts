import { createLogger } from '../config/logger';
import { SubscriberHistoryModel } from '../models/subscriber-history';
import { CharacterHistoryModel } from '../models/character-history';
import serviceDiscoveryService from '../services/service-discovery-service';

const logger = createLogger('SubscriberPollingService');

// Default retention (days) — 6 months
const DEFAULT_RETENTION_DAYS = 180;

/**
 * Subscriber Polling Service
 *
 * Polls admind API for total/new player and character counts and stores
 * the results in g_subscriber_history and g_character_history.
 * Uses service discovery to find admind instances.
 * Invoked by BullMQ scheduler job 'subscriber:poll' (every 10 minutes).
 */
export class SubscriberPollingService {
  /**
   * Get retention days from environment variable
   */
  getRetentionDays(): number {
    const envVal = process.env.SUBSCRIBER_HISTORY_RETENTION_DAYS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_RETENTION_DAYS;
  }

  /**
   * Poll all admind instances found via service discovery
   */
  async pollAll(): Promise<void> {
    try {
      const instances = await serviceDiscoveryService.getServices('admind');
      const ready = instances.filter((i) => i.status === 'ready');

      if (ready.length === 0) {
        logger.debug(
          'No admind instances found via service discovery, skipping subscriber poll'
        );
        return;
      }

      const now = new Date();

      for (const inst of ready) {
        const port = inst.ports?.internalApi;
        if (!port || !inst.internalAddress) {
          logger.warn(
            'admind instance missing internalApi port, skipping',
            { instanceId: inst.instanceId }
          );
          continue;
        }

        const admindUrl = `http://${inst.internalAddress}:${port}`;
        const environmentId =
          inst.labels?.environmentId || inst.labels?.env || 'default';

        try {
          await this.pollEnvironment(environmentId, admindUrl, now);
        } catch (err: any) {
          logger.warn(
            `Subscriber poll failed for admind ${inst.instanceId}: ${err.message}`
          );
        }
      }

      // Cleanup old records from both tables
      const retentionDays = this.getRetentionDays();
      await SubscriberHistoryModel.cleanupOlderThan(retentionDays);
      await CharacterHistoryModel.cleanupOlderThan(retentionDays);
    } catch (err: any) {
      logger.error('Subscriber pollAll error:', err);
    }
  }

  /**
   * Poll a single environment's admind API for subscriber stats
   */
  private async pollEnvironment(
    environmentId: string,
    admindApiUrl: string,
    recordedAt: Date
  ): Promise<void> {
    const baseUrl = admindApiUrl.replace(/\/+$/, '');
    const timeout = 8000;
    const todayStart = new Date(recordedAt);
    todayStart.setHours(0, 0, 0, 0);

    // ── 1. Player (account) stats — global ────────────────────────
    let totalPlayers = 0;
    let newPlayers = 0;
    try {
      const playerData = await this.fetchJson(
        `${baseUrl}/gatrix/v1/all-players?limit=1`,
        timeout
      );
      totalPlayers = playerData?.total || 0;

      // Fetch today's new players
      const todayNewData = await this.fetchJson(
        `${baseUrl}/gatrix/v1/all-players?limit=1&sortBy=createTimeUtc&sortDesc=true&createdAfter=${todayStart.toISOString()}`,
        timeout
      );
      newPlayers = todayNewData?.total || 0;
    } catch (err: any) {
      logger.warn(
        `Failed to fetch player stats for env ${environmentId}: ${err.message}`
      );
    }

    await SubscriberHistoryModel.insertRecord({
      environmentId,
      totalPlayers,
      newPlayers,
      recordedAt,
    });

    // ── 2. Character stats — per-world (CCU pattern) ──────────────
    const characterRecords: Array<{
      environmentId: string;
      worldId: string | null;
      worldName: string | null;
      totalCharacters: number;
      newCharacters: number;
      recordedAt: Date;
    }> = [];

    try {
      // Total characters across all worlds
      const charData = await this.fetchJson(
        `${baseUrl}/gatrix/v1/all-characters?limit=1`,
        timeout
      );
      const totalCharacters = charData?.total || 0;

      let totalNewCharacters = 0;
      try {
        const todayNewCharData = await this.fetchJson(
          `${baseUrl}/gatrix/v1/all-characters?limit=1&sortBy=createTimeUtc&sortDesc=true&createdAfter=${todayStart.toISOString()}`,
          timeout
        );
        totalNewCharacters = todayNewCharData?.total || 0;
      } catch {
        // Ignore — newCharacters stays 0
      }

      // Total row (worldId=null)
      characterRecords.push({
        environmentId,
        worldId: null,
        worldName: null,
        totalCharacters,
        newCharacters: totalNewCharacters,
        recordedAt,
      });

      // Per-world breakdown — fetch each world's characters
      // Use the worlds list from the character data or CCU data
      if (Array.isArray(charData?.worlds)) {
        for (const w of charData.worlds) {
          characterRecords.push({
            environmentId,
            worldId: w.worldId || w.id || 'unknown',
            worldName: w.worldId || null,
            totalCharacters: w.total || 0,
            newCharacters: w.newToday || 0,
            recordedAt,
          });
        }
      }
    } catch (err: any) {
      logger.warn(
        `Failed to fetch character stats for env ${environmentId}: ${err.message}`
      );
    }

    if (characterRecords.length > 0) {
      await CharacterHistoryModel.insertBatch(characterRecords);
    }

    logger.debug(
      `Subscriber polled for env ${environmentId}: totalPlayers=${totalPlayers}, newPlayers=${newPlayers}, charRecords=${characterRecords.length}`
    );
  }

  /**
   * Simple fetch helper with timeout
   */
  private async fetchJson(url: string, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    }
  }
}

// Singleton instance
export const subscriberPollingService = new SubscriberPollingService();
