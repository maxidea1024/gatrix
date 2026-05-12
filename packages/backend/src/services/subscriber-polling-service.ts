import { createLogger } from '../config/logger';
import { PlayerHistoryModel } from '../models/player-history';
import { CharacterHistoryModel } from '../models/character-history';
import serviceDiscoveryService from '../services/service-discovery-service';

const logger = createLogger('SubscriberPollingService');

// Default retention (days) — 6 months
const DEFAULT_RETENTION_DAYS = 180;

/**
 * Subscriber Polling Service
 *
 * Polls admind API for total/new player and character counts.
 * - Player stats → g_player_history (global, no world)
 * - Character stats → g_character_history (total + per-world)
 *
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
          logger.warn('admind instance missing internalApi port, skipping', {
            instanceId: inst.instanceId,
          });
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

      // Cleanup old records
      const retentionDays = this.getRetentionDays();
      await PlayerHistoryModel.cleanupOlderThan(retentionDays);
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

    // ── 1. Player (account) stats → g_player_history ────────────
    let totalPlayers = 0;
    let newPlayers = 0;
    try {
      const playerData = await this.fetchJson(
        `${baseUrl}/gatrix/v1/all-players?limit=1`,
        timeout
      );
      totalPlayers = playerData?.total || 0;

      // Calculate newPlayers as delta from previous record
      const prevPlayer = await PlayerHistoryModel.getLatest(environmentId);
      if (prevPlayer) {
        newPlayers = Math.max(0, totalPlayers - prevPlayer.totalPlayers);
      } else {
        // First record ever — count all as new
        newPlayers = totalPlayers;
      }
    } catch (err: any) {
      logger.warn(
        `Failed to fetch player stats for env ${environmentId}: ${err.message}`
      );
    }

    // ── 2. Character stats (total) ────────────
    let totalCharacters = 0;
    let newCharacters = 0;
    try {
      const charData = await this.fetchJson(
        `${baseUrl}/gatrix/v1/all-characters?limit=1`,
        timeout
      );
      totalCharacters = charData?.total || 0;

      // Calculate newCharacters as delta from previous record
      const prevPlayer = await PlayerHistoryModel.getLatest(environmentId);
      if (prevPlayer) {
        newCharacters = Math.max(
          0,
          totalCharacters - prevPlayer.totalCharacters
        );
      } else {
        newCharacters = totalCharacters;
      }
    } catch (err: any) {
      logger.warn(
        `Failed to fetch character stats for env ${environmentId}: ${err.message}`
      );
    }

    // Insert player stats into g_player_history
    await PlayerHistoryModel.insertRecord({
      environmentId,
      totalPlayers,
      newPlayers,
      totalCharacters,
      newCharacters,
      recordedAt,
    });

    // ── 3. Per-world character stats → g_character_history ────────────
    const characterRecords: Array<{
      environmentId: string;
      worldId: string | null;
      worldName: string | null;
      totalCharacters: number;
      newCharacters: number;
      recordedAt: Date;
    }> = [];

    // Total record (worldId = null)
    characterRecords.push({
      environmentId,
      worldId: null,
      worldName: null,
      totalCharacters,
      newCharacters,
      recordedAt,
    });

    // Get world list from CCU endpoint (already being polled)
    try {
      const ccuData = await this.fetchJson(`${baseUrl}/gatrix/v1/ccu`, timeout);

      if (Array.isArray(ccuData?.worlds)) {
        for (const world of ccuData.worlds) {
          const wId = world.worldId || world.id;
          if (!wId) continue;

          try {
            const worldCharData = await this.fetchJson(
              `${baseUrl}/gatrix/v1/all-characters?limit=1&worldId=${wId}`,
              timeout
            );
            const worldTotal = worldCharData?.total || 0;

            // Calculate worldNew as delta from previous per-world record
            let worldNew = 0;
            const prevWorld = await CharacterHistoryModel.getLatestByWorld(
              environmentId,
              wId
            );
            if (prevWorld) {
              worldNew = Math.max(0, worldTotal - prevWorld.totalCharacters);
            } else {
              worldNew = worldTotal;
            }

            characterRecords.push({
              environmentId,
              worldId: wId,
              worldName: wId,
              totalCharacters: worldTotal,
              newCharacters: worldNew,
              recordedAt,
            });
          } catch {
            // Skip this world
          }
        }
      }
    } catch (err: any) {
      logger.debug(
        `Could not fetch per-world character stats for env ${environmentId}: ${err.message}`
      );
    }

    // Insert character records
    await CharacterHistoryModel.insertBatch(characterRecords);

    logger.debug(
      `Subscriber polled for env ${environmentId}: players=${totalPlayers}(+${newPlayers}), chars=${totalCharacters}(+${newCharacters}), worlds=${characterRecords.length - 1}`
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
