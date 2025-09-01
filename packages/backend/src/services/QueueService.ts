import { Queue, Worker, Job, QueueEvents, RepeatableJob } from 'bullmq';
import logger from '../config/logger';
import { BullBoardConfig } from '../config/bullboard';

export interface QueueJobData {
  type: string;
  payload: any;
  timestamp: number;
}

export class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private isInitialized = false;

  private getRedisConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      // Per BullMQ recommendation, set to null so BullMQ can manage retries
      maxRetriesPerRequest: null as any,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
    };
  }

  /**
   * Initialize queue service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize default queues
      await this.createQueue('email', this.processEmailJob.bind(this));
      await this.createQueue('audit-log', this.processAuditLogJob.bind(this));
      await this.createQueue('cleanup', this.processCleanupJob.bind(this));
      await this.createQueue('scheduler', this.processSchedulerJob.bind(this));


      this.isInitialized = true;
      logger.info('Queue service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue service:', error);
      throw error;
    }
  }

  /**
   * Create a new queue with worker
   */
  async createQueue(
    queueName: string,
    processor: (job: Job<QueueJobData>) => Promise<void>,
    options: {
      concurrency?: number;
      removeOnComplete?: number;
      removeOnFail?: number;
      attempts?: number;
    } = {}
  ): Promise<void> {
    const redisConfig = this.getRedisConfig();

    // Create queue
    const queue = new Queue(queueName, {
      connection: redisConfig,
      defaultJobOptions: {
        removeOnComplete: options.removeOnComplete || 100,
        removeOnFail: options.removeOnFail || 50,
        attempts: options.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Create worker
    const worker = new Worker(queueName, processor, {
      connection: redisConfig,
      concurrency: options.concurrency || 5,
    });

    // Create queue events
    const queueEvents = new QueueEvents(queueName, {
      connection: redisConfig,
    });

    // Setup event handlers
    queue.on('error', (error: Error) => {
      logger.error(`Queue ${queueName} error:`, error);
    });

    worker.on('error', (error: Error) => {
      logger.error(`Worker ${queueName} error:`, error);
    });

    worker.on('completed', (job: Job) => {
      logger.debug(`Job completed in queue ${queueName}:`, job.id);
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(`Job failed in queue ${queueName}:`, {
        jobId: job?.id,
        error: error.message
      });
    });

    queueEvents.on('completed', ({ jobId }: { jobId: string }) => {
      logger.debug(`Job ${jobId} completed in queue ${queueName}`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      logger.error(`Job ${jobId} failed in queue ${queueName}:`, failedReason);
    });

    // Store references
    this.queues.set(queueName, queue);
    this.workers.set(queueName, worker);
    this.queueEvents.set(queueName, queueEvents);

    // Add to Bull Board
    BullBoardConfig.addQueue(queue);

    logger.info(`Queue ${queueName} created successfully`);
  }

  /**
   * Add job to queue
   */
  async addJob(
    queueName: string,
    jobType: string,
    payload: any,
    options: {
      priority?: number;
      delay?: number;
      repeat?: any;
    } = {}
  ): Promise<Job<QueueJobData> | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error(`Queue ${queueName} not found`);
      return null;
    }

    try {
      const jobData: QueueJobData = {
        type: jobType,
        payload,
        timestamp: Date.now(),
      };

      const job = await queue.add(jobType, jobData, {
        priority: options.priority || 0,
        delay: options.delay || 0,
        repeat: options.repeat,
      });

      logger.debug(`Job added to queue ${queueName}:`, {
        jobId: job.id,
        type: jobType
      });

      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<any> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        name: queueName,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    } catch (error) {
      logger.error(`Failed to get stats for queue ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<any[]> {
    const stats = [];
    for (const queueName of this.queues.keys()) {
      const queueStats = await this.getQueueStats(queueName);
      if (queueStats) {
        stats.push(queueStats);
      }
    }
    return stats;
  }
  /**
   * List delayed jobs in range [startMs, endMs]
   */
  async getScheduledJobsInRange(queueName: string, startMs: number, endMs: number) {
    const queue = this.queues.get(queueName);
    if (!queue) return [];

    try {
      const jobs = await queue.getJobs(['delayed', 'waiting'], 0, -1, true);
      const events = jobs.map((job) => {
        const delay = (job.opts as any)?.delay || 0;
        const payload: any = (job.data as any)?.payload || {};
        const payloadStart = payload.start ? Date.parse(payload.start) : undefined;
        const scheduledAt = Number.isFinite(payloadStart) ? (payloadStart as number) : ((job.timestamp || 0) + delay);
        return {
          id: job.id,
          title: payload.title || payload.message || 'Scheduled Job',
          description: payload.description,
          start: scheduledAt,
          end: payload.end ? new Date(payload.end).getTime() : scheduledAt + 60 * 60 * 1000,
          tags: payload.tags,
          resource: payload.resource,
          payload,
        };
      }).filter((e) => e.start >= startMs && e.start <= endMs);

      return events;
    } catch (error) {
      logger.error('Failed to list scheduled jobs:', error);
      return [];
    }
  }

  /**
   * Remove a job by ID
   */
  async removeJob(queueName: string, jobId: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return false;
    try {
      const job = await queue.getJob(jobId);
      if (!job) return false;
      await job.remove();
      return true;
    } catch (error) {
      logger.error(`Failed to remove job ${jobId} from ${queueName}:`, error);
      return false;
    }
  }
  /** Repeatable jobs management */
  async listRepeatable(queueName: string): Promise<RepeatableJob[]> {
    const queue = this.queues.get(queueName);
    if (!queue) return [] as any;
    try {
      return await queue.getRepeatableJobs();
    } catch (e) {
      logger.error('Failed to list repeatable jobs:', e);
      return [] as any;
    }
  }

  async removeRepeatable(queueName: string, repeatJobKey: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;
    try {
      await queue.removeRepeatableByKey(repeatJobKey);
      return true;
    } catch (e) {
      logger.error('Failed to remove repeatable job:', e);
      return false;
    }
  }

  /** History listing */
  async listHistory(queueName: string, status: 'completed' | 'failed' | 'waiting' | 'active' | 'delayed' = 'completed', start = 0, end = 50) {
    const queue = this.queues.get(queueName);
    if (!queue) return [];
    switch (status) {
      case 'completed': return queue.getCompleted(start, end);
      case 'failed': return queue.getFailed(start, end);
      case 'waiting': return queue.getWaiting(start, end);
      case 'active': return queue.getActive(start, end);
      case 'delayed': return queue.getDelayed(start, end);
      default: return [];
    }
  }

  async retryJob(queueName: string, jobId: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return false;
    const job = await queue.getJob(jobId);
    if (!job) return false;
    await job.retry();
    return true;
  }

  async getJobCounts(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return {} as any;
    return queue.getJobCounts('completed', 'failed', 'waiting', 'active', 'delayed');
  }

  /** Expose queues for integrations (read-only) */
  getQueue(name: string): Queue | undefined { return this.queues.get(name); }
  getQueues(): Queue[] { return Array.from(this.queues.values()); }

  /**
   * Process email job
   */
  private async processEmailJob(job: Job<QueueJobData>): Promise<void> {
    const { payload } = job.data;
    logger.info('Processing email job:', { jobId: job.id, to: payload.to });

    try {
      // 이메일 발송 로직 구현
      const nodemailer = require('nodemailer');

      // 개발 환경에서는 Ethereal Email 사용
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
          pass: process.env.SMTP_PASS || 'ethereal.pass'
        }
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@gatrix.com',
        to: payload.to,
        subject: payload.subject || 'Notification',
        text: payload.body || payload.text,
        html: payload.html
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info('Email sent successfully:', { jobId: job.id, messageId: info.messageId });
    } catch (error) {
      logger.error('Email sending failed:', { jobId: job.id, error });
      throw error;
    }

    logger.info('Email job completed:', job.id);
  }

  /**
   * Process audit log job
   */
  private async processAuditLogJob(job: Job<QueueJobData>): Promise<void> {
    const { payload } = job.data;
    logger.info('Processing audit log job:', { jobId: job.id });

    // TODO: Implement audit log processing
    // await auditLogService.processLog(payload);

    logger.info('Audit log job completed:', job.id);
  }

  /**
   * Process cleanup job
   */
  private async processCleanupJob(job: Job<QueueJobData>): Promise<void> {
    const { payload } = job.data;
    logger.info('Processing cleanup job:', { jobId: job.id, type: payload.type });

    // TODO: Implement cleanup logic
    // await cleanupService.cleanup(payload);

    logger.info('Cleanup job completed:', job.id);
  }

  /**
   * Process scheduler job - for now just console.log
   */
  private async processSchedulerJob(job: Job<QueueJobData>): Promise<void> {
    logger.info('Processing scheduler job (console only):', {
      jobId: job.id,
      payload: job.data?.payload,
      timestamp: new Date().toISOString(),
    });

    logger.info('[SchedulerJob]', {
      id: job.id,
      data: job.data,
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      // Close all workers
      for (const [name, worker] of this.workers) {
        await worker.close();
        logger.info(`Worker ${name} closed`);
      }

      // Close all queue events
      for (const [name, queueEvents] of this.queueEvents) {
        await queueEvents.close();
        logger.info(`Queue events ${name} closed`);
      }

      // Close all queues
      for (const [name, queue] of this.queues) {
        await queue.close();
        logger.info(`Queue ${name} closed`);
      }

      this.isInitialized = false;
      logger.info('Queue service shutdown completed');
    } catch (error) {
      logger.error('Error during queue service shutdown:', error);
    }
  }

  /**
   * Get service status
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const queueService = new QueueService();
