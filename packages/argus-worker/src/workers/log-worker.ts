import { redis, createLogger, KNOWN_STREAMS, CONSUMER_GROUPS, pipelineConfig } from '@gatrix/argus';
import { optic } from '@gatrix/argus-optic';

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
        // Group already exists ??expected
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
   * Maximum number of buffered log entries before dropping.
   * Prevents OOM when ClickHouse is unavailable for extended periods.
   */
  private readonly MAX_BUFFER_SIZE = 50_000;

  /**
   * Batch insert buffered logs into ClickHouse.
   */
  private async flushBuffer(): Promise<void> {
    if (this.chBuffer.length === 0) return;

    const batch = this.chBuffer.splice(0);
    try {
      await optic.insert({
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

      // Put failed records back for retry, but cap total buffer size
      const spaceAvailable = this.MAX_BUFFER_SIZE - this.chBuffer.length;
      if (spaceAvailable >= batch.length) {
        // Enough room ??prepend all failed records
        this.chBuffer = batch.concat(this.chBuffer);
      } else if (spaceAvailable > 0) {
        // Partial room ??keep only the newest records from the failed batch
        const kept = batch.slice(batch.length - spaceAvailable);
        this.chBuffer = kept.concat(this.chBuffer);
        logger.warn('Log buffer overflow, dropped oldest entries', {
          dropped: batch.length - spaceAvailable,
          bufferSize: this.chBuffer.length,
        });
      } else {
        // No room at all ??drop the entire failed batch
        logger.warn('Log buffer full, dropped entire failed batch', {
          dropped: batch.length,
          bufferSize: this.chBuffer.length,
        });
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
