import { Worker, Job } from 'bullmq';
import { clickhouse } from '../config/clickhouse';
import { redis } from '../config/redis';
import { config } from '../config';
import logger from '../utils/logger';
import { Event } from '../types';

export class EventWorker {
  private worker: Worker;
  private batch: Event[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor() {
    this.worker = new Worker(
      'event-lens:events',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: config.worker.concurrency,
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Event job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Event job failed', { 
        jobId: job?.id, 
        error: error.message 
      });
    });

    logger.info('✅ Event Worker started', {
      concurrency: config.worker.concurrency,
      batchSize: config.worker.batchSize,
      batchTimeout: config.worker.batchTimeout,
    });
  }

  private async processJob(job: Job): Promise<void> {
    const { event } = job.data;
    
    this.batch.push(event);

    // 배치 크기에 도달하면 즉시 flush
    if (this.batch.length >= config.worker.batchSize) {
      await this.flush();
    } else if (!this.batchTimer) {
      // 타이머 설정
      this.batchTimer = setTimeout(() => {
        this.flush();
      }, config.worker.batchTimeout);
    }
  }

  private async flush(): Promise<void> {
    if (this.isProcessing || this.batch.length === 0) {
      return;
    }

    this.isProcessing = true;

    // 타이머 클리어
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const events = [...this.batch];
    this.batch = [];

    try {
      logger.info('Flushing events to ClickHouse', { count: events.length });

      await clickhouse.insert({
        table: 'events',
        values: events,
        format: 'JSONEachRow',
      });

      logger.info('✅ Events inserted successfully', { count: events.length });
    } catch (error: any) {
      logger.error('❌ Failed to insert events', { 
        error: error.message,
        count: events.length 
      });

      // 실패한 이벤트를 다시 배치에 추가 (재시도)
      this.batch.unshift(...events);
    } finally {
      this.isProcessing = false;
    }
  }

  async close(): Promise<void> {
    logger.info('Closing Event Worker...');
    
    // 남은 배치 처리
    await this.flush();
    
    await this.worker.close();
    logger.info('✅ Event Worker closed');
  }
}

export default EventWorker;

