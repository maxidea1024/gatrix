import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';

interface TokenUsageStats {
  usageCount: number;
  lastUsedAt: Date;
}

/**
 * TokenUsageTracker - Tracks API token usage in Edge server
 * Periodically reports usage statistics to backend for aggregation
 */
class TokenUsageTracker {
  private usageMap: Map<number, TokenUsageStats> = new Map(); // tokenId (number) -> stats
  private reportIntervalMs: number;
  private reportTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private readonly edgeInstanceId: string;

  constructor() {
    this.reportIntervalMs = parseInt(process.env.TOKEN_USAGE_REPORT_INTERVAL_MS || '60000');
    this.edgeInstanceId = `edge-${config.group}-${process.pid}`;
  }

  /**
   * Initialize the usage tracker
   * Starts periodic reporting to backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[TokenUsageTracker] Already initialized');
      return;
    }

    logger.info('[TokenUsageTracker] Initializing token usage tracker...', {
      reportIntervalMs: this.reportIntervalMs,
      edgeInstanceId: this.edgeInstanceId,
    });

    // Start periodic reporting
    this.reportTimer = setInterval(() => {
      this.reportUsageToBackend().catch(err => {
        logger.error('[TokenUsageTracker] Failed to report usage:', err.message);
      });
    }, this.reportIntervalMs);

    this.initialized = true;
    logger.info('[TokenUsageTracker] Initialized');
  }

  /**
   * Shutdown the usage tracker
   * Reports any remaining usage before shutdown
   */
  async shutdown(): Promise<void> {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    // Report remaining usage before shutdown
    if (this.usageMap.size > 0) {
      try {
        await this.reportUsageToBackend();
      } catch (error) {
        logger.error('[TokenUsageTracker] Failed to report usage during shutdown:', error);
      }
    }

    this.usageMap.clear();
    this.initialized = false;
    logger.info('[TokenUsageTracker] Shutdown complete');
  }

  /**
   * Record token usage
   * Called when a token is successfully validated and used
   * @param tokenId - The numeric token ID from the database
   */
  recordUsage(tokenId: number): void {
    const existing = this.usageMap.get(tokenId);
    const now = new Date();

    if (existing) {
      existing.usageCount++;
      existing.lastUsedAt = now;
    } else {
      this.usageMap.set(tokenId, {
        usageCount: 1,
        lastUsedAt: now,
      });
    }
  }

  /**
   * Report usage statistics to backend
   * Clears local usage data after successful report
   */
  private async reportUsageToBackend(): Promise<void> {
    if (this.usageMap.size === 0) {
      return;
    }

    // Collect and clear usage data atomically
    const usageData: Array<{
      tokenId: number;
      usageCount: number;
      lastUsedAt: string;
    }> = [];

    for (const [tokenId, stats] of this.usageMap) {
      usageData.push({
        tokenId,
        usageCount: stats.usageCount,
        lastUsedAt: stats.lastUsedAt.toISOString(),
      });
    }

    // Clear the map before sending to avoid losing data if request fails
    const backupMap = new Map(this.usageMap);
    this.usageMap.clear();

    try {
      const response = await axios.post(
        `${config.gatrixUrl}/api/v1/server/internal/token-usage-report`,
        {
          edgeInstanceId: this.edgeInstanceId,
          usageData,
          reportedAt: new Date().toISOString(),
        },
        {
          headers: {
            'x-api-token': config.apiToken,
            'x-application-name': config.applicationName,
          },
          timeout: 10000,
        }
      );

      if (response.data?.success) {
        logger.info('[TokenUsageTracker] Usage reported successfully', {
          tokenCount: usageData.length,
          totalUsage: usageData.reduce((sum, d) => sum + d.usageCount, 0),
        });
      } else {
        throw new Error(response.data?.message || 'Unknown error');
      }
    } catch (error: any) {
      // Restore usage data on failure
      for (const [tokenId, stats] of backupMap) {
        const existing = this.usageMap.get(tokenId);
        if (existing) {
          existing.usageCount += stats.usageCount;
          if (stats.lastUsedAt > existing.lastUsedAt) {
            existing.lastUsedAt = stats.lastUsedAt;
          }
        } else {
          this.usageMap.set(tokenId, stats);
        }
      }
      throw error;
    }
  }
}

export const tokenUsageTracker = new TokenUsageTracker();

