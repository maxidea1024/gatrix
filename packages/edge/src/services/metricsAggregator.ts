import axios from 'axios';
import { config } from '../config/env';
import logger from '../config/logger';

interface ClientMetricBucket {
  start: Date;
  stop: Date;
  flags: Record<string, { yes: number; no: number; variants: Record<string, number> }>;
  missing: Record<string, number>;
}

interface ServerMetric {
  flagName: string;
  enabled: boolean;
  variantName?: string;
  count: number;
}

/**
 * MetricsAggregator - Buffers and aggregates metrics from SDKs before flushing to backend.
 * Reduces backend load by collapsing high-frequency requests from multiple SDK instances.
 */
class MetricsAggregator {
  // Key: environment:appName
  private clientBuffers: Map<string, ClientMetricBucket> = new Map();
  private serverBuffers: Map<string, Map<string, ServerMetric>> = new Map();
  private serverUnknownBuffers: Map<string, Map<string, number>> = new Map(); // Key: env:app, Val: Map<flagName, count>

  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds

  constructor() {
    this.startFlushTimer();
  }

  /**
   * Add Client SDK metrics to buffer
   */
  addClientMetrics(environment: string, appName: string, bucket: any): void {
    const key = `${environment}:${appName}`;
    let buffer = this.clientBuffers.get(key);

    if (!buffer) {
      buffer = {
        start: new Date(bucket.start || Date.now()),
        stop: new Date(bucket.stop || Date.now()),
        flags: {},
        missing: {},
      };
      this.clientBuffers.set(key, buffer);
    }

    // Update stop time to the latest
    const bucketStop = new Date(bucket.stop || Date.now());
    if (bucketStop > buffer.stop) {
      buffer.stop = bucketStop;
    }

    // Aggregate flags
    if (bucket.flags) {
      for (const [flagName, data] of Object.entries(bucket.flags as any)) {
        if (!buffer.flags[flagName]) {
          buffer.flags[flagName] = { yes: 0, no: 0, variants: {} };
        }

        const bFlag = buffer.flags[flagName];
        const incoming = data as any;

        bFlag.yes += incoming.yes || 0;
        bFlag.no += incoming.no || 0;

        if (incoming.variants) {
          for (const [vName, count] of Object.entries(incoming.variants)) {
            bFlag.variants[vName] = (bFlag.variants[vName] || 0) + (count as number);
          }
        }
      }
    }

    // Aggregate missing (unknown) flags
    if (bucket.missing) {
      for (const [flagName, count] of Object.entries(bucket.missing as any)) {
        buffer.missing[flagName] = (buffer.missing[flagName] || 0) + (count as number);
      }
    }
  }

  /**
   * Add Server SDK metrics to buffer
   */
  addServerMetrics(environment: string, appName: string, metrics: ServerMetric[]): void {
    const key = `${environment}:${appName}`;
    let buffer = this.serverBuffers.get(key);

    if (!buffer) {
      buffer = new Map();
      this.serverBuffers.set(key, buffer);
    }

    for (const metric of metrics) {
      const metricKey = `${metric.flagName}:${metric.enabled}:${metric.variantName || ''}`;
      const existing = buffer.get(metricKey);

      if (existing) {
        existing.count += metric.count;
      } else {
        buffer.set(metricKey, { ...metric });
      }
    }
  }

  /**
   * Add Server SDK unknown flag report to buffer
   */
  addServerUnknownReport(
    environment: string,
    appName: string,
    flagName: string,
    count: number = 1
  ): void {
    const key = `${environment}:${appName}`;
    let buffer = this.serverUnknownBuffers.get(key);

    if (!buffer) {
      buffer = new Map();
      this.serverUnknownBuffers.set(key, buffer);
    }

    const currentCount = buffer.get(flagName) || 0;
    buffer.set(flagName, currentCount + count);
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  /**
   * Flush all buffered metrics to the backend
   */
  async flush(): Promise<void> {
    const startTime = Date.now();
    const clientJobs = Array.from(this.clientBuffers.entries());
    const serverJobs = Array.from(this.serverBuffers.entries());
    const unknownJobs = Array.from(this.serverUnknownBuffers.entries());

    if (clientJobs.length === 0 && serverJobs.length === 0 && unknownJobs.length === 0) {
      return;
    }

    this.clientBuffers.clear();
    this.serverBuffers.clear();
    this.serverUnknownBuffers.clear();

    logger.debug(
      `Flushing aggregated metrics to backend: ${clientJobs.length} client, ${serverJobs.length} server, ${unknownJobs.length} unknown groups`
    );

    // Process Client Metrics
    const clientPromises = clientJobs.map(async ([key, buffer]) => {
      const [environment, appName] = key.split(':');
      try {
        await axios.post(
          `${config.gatrixUrl}/api/v1/client/features/${environment}/metrics`,
          {
            appName,
            bucket: {
              start: buffer.start.toISOString(),
              stop: buffer.stop.toISOString(),
              flags: buffer.flags,
              missing: buffer.missing,
            },
          },
          {
            headers: {
              'x-api-token': config.apiToken,
              'x-application-name': config.applicationName,
            },
            timeout: 10000,
          }
        );
      } catch (error: any) {
        logger.error(`Failed to flush client metrics for ${key}:`, error.message);
      }
    });

    // Process Server Metrics
    const serverPromises = serverJobs.map(async ([key, bufferMap]) => {
      const [environment, appName] = key.split(':');
      const metrics = Array.from(bufferMap.values());
      try {
        await axios.post(
          `${config.gatrixUrl}/api/v1/server/${environment}/features/metrics`,
          {
            metrics,
            bucket: {
              start: new Date(startTime - this.FLUSH_INTERVAL_MS).toISOString(),
              stop: new Date(startTime).toISOString(),
            },
            timestamp: new Date().toISOString(),
          },
          {
            headers: {
              'x-api-token': config.apiToken,
              'x-application-name': appName,
            },
            timeout: 10000,
          }
        );
      } catch (error: any) {
        logger.error(`Failed to flush server metrics for ${key}:`, error.message);
      }
    });

    // Process Server Unknown Reports
    const unknownPromises = unknownJobs.flatMap(([key, bufferMap]) => {
      const [environment, appName] = key.split(':');
      return Array.from(bufferMap.entries()).map(async ([flagName, count]) => {
        try {
          await axios.post(
            `${config.gatrixUrl}/api/v1/server/${environment}/features/unknown`,
            { flagName, count },
            {
              headers: {
                'x-api-token': config.apiToken,
                'x-application-name': appName,
              },
              timeout: 10000,
            }
          );
        } catch (error: any) {
          logger.error(
            `Failed to flush server unknown report for ${flagName} in ${key}:`,
            error.message
          );
        }
      });
    });

    await Promise.allSettled([...clientPromises, ...serverPromises, ...unknownPromises]);
  }

  /**
   * Shutdown aggregator
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

export const metricsAggregator = new MetricsAggregator();
