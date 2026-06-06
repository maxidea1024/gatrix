import { redis } from '../config/redis';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { KNOWN_STREAMS, CONSUMER_GROUPS } from '../config/redis-keys';
import { pipelineConfig } from '../config/pipeline-config';

const logger = createLogger('log-worker');

/**
 * Log worker: consumes log events from Redis Streams and batch-inserts
 * them into ClickHouse.
 *
 * Decouples the HTTP ingest response from ClickHouse write latency,
 * enabling instant 202 responses under high log volumes.
 */
export class LogWorker {
  private running = false;
  private chBuffer: any[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    this.running = true;
    logger.info('Log worker started');

    // Periodic ClickHouse flush
    this.flushTimer = setInterval(
      () => this.flushBuffer(),
      pipelineConfig.clickhouseBuffer.flushIntervalMs
    );

    // Start consuming
    this.processLoop().catch((error) => {
      logger.error('Log worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    if (this.flushTimer) clearInterval(this.flushTimer);

    // Final flush
    await this.flushBuffer();
    logger.info('Log worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.consumeStreams();
      } catch (error) {
        logger.error('Error in log worker loop', {
          error: error instanceof Error ? error.message : String(error),
        });
        await this.sleep(1000);
      }
    }
  }

  /**
   * Discover and consume from all known log streams.
   */
  private async consumeStreams(): Promise<void> {
    const streamKeys = await redis.smembers(KNOWN_STREAMS.LOGS);
    if (streamKeys.length === 0) {
      await this.sleep(pipelineConfig.worker.blockMs);
      return;
    }

    // Ensure consumer groups exist
    for (const streamKey of streamKeys) {
      try {
        await redis.xgroup('CREATE', streamKey, CONSUMER_GROUPS.LOGS, '0', 'MKSTREAM');
      } catch {
        // Group already exists — expected
      }
    }

    // Read from all streams using xreadgroup
    const result = await (redis as any).xreadgroup(
      'GROUP', CONSUMER_GROUPS.LOGS, 'log-worker-1',
      'COUNT', '100',
      'BLOCK', String(pipelineConfig.worker.blockMs),
      'STREAMS',
      ...streamKeys,
      ...streamKeys.map(() => '>'),
    ) as any;
    if (!result) return;

    for (const [streamKey, entries] of result) {
      for (const [messageId, fields] of entries) {
        try {
          const data = JSON.parse(fields[1]); // fields = ['data', '...json...']

          this.chBuffer.push({
            log_id: data.log_id || '',
            project_id: data.project_id || '',
            trace_id: data.trace_id || '',
            span_id: data.span_id || '',
            issue_id: data.issue_id || 0,
            timestamp: data.timestamp || new Date().toISOString(),
            level: data.level || 'info',
            logger_name: data.logger_name || '',
            message: data.message || '',
            body: data.body || '',
            environment: data.environment || '',
            release: data.release || '',
            service: data.service || '',
            attributes: data.attributes || {},
          });

          // ACK the message
          await redis.xack(streamKey, CONSUMER_GROUPS.LOGS, messageId);
        } catch (e) {
          logger.warn('Failed to process log message', {
            streamKey,
            messageId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Flush if buffer exceeds batch size
    if (this.chBuffer.length >= pipelineConfig.clickhouseBuffer.maxBatchSize) {
      await this.flushBuffer();
    }
  }

  /**
   * Batch insert buffered logs into ClickHouse.
   */
  private async flushBuffer(): Promise<void> {
    if (this.chBuffer.length === 0) return;

    const batch = this.chBuffer.splice(0);
    try {
      await clickhouse.insert({
        table: 'argus.logs',
        values: batch,
        format: 'JSONEachRow',
      });

      logger.debug('Log batch flushed to ClickHouse', { count: batch.length });
    } catch (error) {
      logger.error('Failed to flush logs to ClickHouse', {
        count: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });

      // Put failed records back at the front of the buffer for retry
      this.chBuffer.unshift(...batch);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
