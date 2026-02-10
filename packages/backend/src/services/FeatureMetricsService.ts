/**
 * Feature Metrics Service
 * Handles aggregation and storage of feature flag evaluation metrics from SDKs
 * Uses QueueService for efficient batch processing
 */

import db from '../config/knex';
import logger from '../config/logger';
import { queueService } from './QueueService';
import { Job } from 'bullmq';
import { FeatureFlagModel } from '../models/FeatureFlag';

// Queue name for feature metrics
const QUEUE_NAME = 'feature-metrics';

interface AggregatedMetric {
  flagName: string;
  enabled: boolean;
  variantName?: string;
  count: number;
}

interface MetricsJobPayload {
  environment: string;
  appName?: string;
  metrics: AggregatedMetric[];
  reportedAt: string;
  bucketStart?: string; // Start of metrics collection window for accurate hourBucket
  sdkVersion?: string;
}

class FeatureMetricsService {
  private isInitialized = false;

  /**
   * Initialize the feature metrics queue
   * Should be called during application startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await queueService.createQueue(QUEUE_NAME, this.processMetricsJob.bind(this), {
        concurrency: 2,
        removeOnComplete: 1000, // Keep last 1000 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
        attempts: 3, // Retry up to 3 times
      });

      this.isInitialized = true;
      logger.info('Feature metrics queue initialized');
    } catch (error) {
      logger.error('Failed to initialize feature metrics queue', { error });
      throw error;
    }
  }

  /**
   * Process aggregated metrics from SDK
   * Adds job to queue for async processing
   * @param environment - Environment name
   * @param metrics - Aggregated metrics array
   * @param timestamp - Reported timestamp (bucket.stop or legacy timestamp)
   * @param appName - Application name from header
   * @param bucketStart - Start of the metrics collection window (for accurate hourBucket calculation)
   */
  async processAggregatedMetrics(
    environment: string,
    metrics: AggregatedMetric[],
    timestamp?: string,
    appName?: string,
    bucketStart?: string,
    sdkVersion?: string
  ): Promise<void> {
    if (!metrics || metrics.length === 0) {
      return;
    }

    const reportedAt = timestamp || new Date().toISOString();

    // Add to queue for batch processing
    await queueService.addJob(QUEUE_NAME, 'aggregate-metrics', {
      environment,
      appName,
      metrics,
      reportedAt,
      bucketStart,
      sdkVersion,
    } as MetricsJobPayload);

    logger.debug('Feature metrics queued for processing', {
      environment,
      appName,
      count: metrics.length,
      bucketStart,
    });
  }

  /**
   * Process metrics job from queue
   */
  private async processMetricsJob(
    job: Job<{ type: string; payload: MetricsJobPayload; timestamp: number }>
  ): Promise<void> {
    const { environment, appName, metrics, reportedAt, bucketStart, sdkVersion } = job.data.payload;

    // Use bucketStart for more accurate hourBucket calculation (bucket window start)
    // Fallback to reportedAt for backward compatibility
    const bucketDate = bucketStart ? new Date(bucketStart) : new Date(reportedAt);
    const hourBucket = new Date(bucketDate);
    hourBucket.setMinutes(0, 0, 0);

    try {
      // Collect unique flagNames to update lastSeenAt
      const uniqueFlagNames = new Set<string>();

      // Batch upsert metrics
      for (const metric of metrics) {
        await this.upsertMetric(environment, appName, sdkVersion, metric, hourBucket);
        uniqueFlagNames.add(metric.flagName);
      }

      // Update lastSeenAt for all unique flags
      for (const flagName of uniqueFlagNames) {
        try {
          // Get flag by name to get the ID
          const flag = await db('g_feature_flags').where('flagName', flagName).first();
          if (flag) {
            await FeatureFlagModel.updateLastSeenAt(flag.id, environment);
          }
        } catch (err) {
          logger.debug('Failed to update lastSeenAt for flag', {
            flagName,
            error: err,
          });
        }
      }

      logger.debug('Feature metrics processed', {
        environment,
        count: metrics.length,
        jobId: job.id,
      });
    } catch (error) {
      logger.error('Failed to process feature metrics job', {
        error,
        jobId: job.id,
      });
      throw error; // Will trigger retry
    }
  }

  /**
   * Upsert a single metric into the aggregation tables
   */
  private async upsertMetric(
    environment: string,
    appName: string | undefined,
    sdkVersion: string | undefined,
    metric: AggregatedMetric,
    hourBucket: Date
  ): Promise<void> {
    const { flagName, enabled, variantName, count } = metric;

    // Format hour bucket for MySQL DATETIME (YYYY-MM-DD HH:00:00)
    const bucketDateTime = hourBucket.toISOString().slice(0, 13).replace('T', ' ') + ':00:00';

    // Update yesCount or noCount based on enabled value
    const yesIncrement = enabled ? count : 0;
    const noIncrement = enabled ? 0 : count;

    // Upsert main metrics (yesCount, noCount) with appName and sdkVersion
    await db.raw(
      `
            INSERT INTO g_feature_metrics (id, environment, appName, sdkVersion, flagName, metricsBucket, yesCount, noCount, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE 
                yesCount = yesCount + VALUES(yesCount), 
                noCount = noCount + VALUES(noCount)
        `,
      [
        require('ulid').ulid(),
        environment,
        appName || null,
        sdkVersion || null,
        flagName,
        bucketDateTime,
        yesIncrement,
        noIncrement,
      ]
    );

    // If there's a variant, upsert to variant metrics table with appName and sdkVersion
    if (variantName) {
      await db.raw(
        `
                INSERT INTO g_feature_variant_metrics (id, environment, appName, sdkVersion, flagName, metricsBucket, variantName, count, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
                ON DUPLICATE KEY UPDATE 
                    count = count + VALUES(count)
            `,
        [
          require('ulid').ulid(),
          environment,
          appName || null,
          sdkVersion || null,
          flagName,
          bucketDateTime,
          variantName,
          count,
        ]
      );
    }
  }

  /**
   * Get metrics for a specific flag
   */
  async getMetricsForFlag(
    environment: string,
    flagName: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const metrics = await db('g_feature_metrics')
        .where({ environment, flagName })
        .whereBetween('hourBucket', [startDate, endDate])
        .orderBy('hourBucket', 'asc');

      return metrics;
    } catch (error) {
      logger.error('Failed to get metrics for flag', {
        error,
        environment,
        flagName,
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return queueService.getQueueStats(QUEUE_NAME);
  }
}

export const featureMetricsService = new FeatureMetricsService();
