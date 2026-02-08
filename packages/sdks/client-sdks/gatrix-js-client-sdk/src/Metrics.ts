/**
 * Metrics - SDK usage tracking
 * Based on unleash-js-sdk metrics implementation
 *
 * Tracks:
 * - Flag access counts (yes/no)
 * - Variant usage counts
 * - Access to undefined flags
 */

import { Logger } from './Logger';
import { EventEmitter } from './EventEmitter';
import { EVENTS } from './events';
import ky from 'ky';

export interface MetricsOptions {
  appName: string;
  apiUrl: string;
  apiToken: string;
  environment: string;
  customHeaders?: Record<string, string>;
  metricsInterval?: number; // seconds (default: 60)
  metricsIntervalInitial?: number; // seconds before first send (default: 2)
  disableMetrics?: boolean;
  logger?: Logger;
  connectionId?: string;
  emitter?: EventEmitter;
}

interface VariantBucket {
  [variantName: string]: number;
}

interface FlagBucket {
  yes: number;
  no: number;
  variants: VariantBucket;
}

interface Bucket {
  start: Date;
  stop: Date | null;
  flags: {
    [flagName: string]: FlagBucket;
  };
  missing: {
    [flagName: string]: number;
  };
}

interface MetricsPayload {
  bucket: {
    start: Date;
    stop: Date | null;
    flags: { [flagName: string]: FlagBucket };
    missing: { [flagName: string]: number };
  };
  appName: string;
  instanceId: string;
}

export class Metrics {
  private bucket: Bucket;
  private appName: string;
  private apiUrl: string;
  private apiToken: string;
  private environment: string;
  private customHeaders: Record<string, string>;
  private metricsInterval: number;
  private metricsIntervalInitial: number;
  private disabled: boolean;
  private logger: Logger | undefined;
  private connectionId: string;
  private emitter: EventEmitter | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private started: boolean = false;

  constructor(options: MetricsOptions) {
    this.appName = options.appName;
    this.apiUrl = options.apiUrl;
    this.apiToken = options.apiToken;
    this.environment = options.environment;
    this.customHeaders = options.customHeaders ?? {};
    this.metricsInterval = (options.metricsInterval ?? 60) * 1000;
    this.metricsIntervalInitial = (options.metricsIntervalInitial ?? 2) * 1000;
    this.disabled = options.disableMetrics ?? false;
    this.logger = options.logger;
    this.connectionId = options.connectionId ?? '';
    this.emitter = options.emitter;
    this.bucket = this.createEmptyBucket();
  }

  /**
   * Start metrics collection and periodic sending
   */
  start(): void {
    if (this.disabled || this.started) {
      return;
    }
    this.started = true;

    if (this.metricsInterval > 0) {
      if (this.metricsIntervalInitial > 0) {
        setTimeout(() => {
          this.startTimer();
          this.sendMetrics();
        }, this.metricsIntervalInitial);
      } else {
        this.startTimer();
      }
    }
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.started = false;
  }

  /**
   * Count flag access
   * @param flagName Flag name
   * @param enabled Whether the flag was enabled
   */
  count(flagName: string, enabled: boolean): void {
    if (this.disabled) return;

    this.assertBucket(flagName);
    this.bucket.flags[flagName][enabled ? 'yes' : 'no']++;
  }

  /**
   * Count variant usage
   * @param flagName Flag name
   * @param variantName Variant name
   */
  countVariant(flagName: string, variantName: string): void {
    if (this.disabled) return;

    this.assertBucket(flagName);
    const variants = this.bucket.flags[flagName].variants;
    variants[variantName] = (variants[variantName] ?? 0) + 1;
  }

  /**
   * Count access to missing (not found) flags
   * @param flagName Flag name that was not found
   */
  countMissing(flagName: string): void {
    if (this.disabled) return;

    this.bucket.missing[flagName] = (this.bucket.missing[flagName] ?? 0) + 1;
  }

  /**
   * Get missing flags record for statistics
   */
  getMissingFlags(): Record<string, number> {
    return { ...this.bucket.missing };
  }

  /**
   * Send current metrics to server
   */
  async sendMetrics(): Promise<void> {
    if (this.disabled) return;

    const payload = this.getPayload();
    if (this.bucketIsEmpty(payload)) {
      return;
    }

    try {
      const metricsUrl = this.buildMetricsUrl();
      await ky.post(metricsUrl, {
        headers: this.getHeaders(),
        json: payload,
        retry: {
          limit: 2,
          methods: ['post'],
          statusCodes: [408, 429, 500, 502, 503, 504],
        },
        timeout: 10000,
      });
      this.logger?.debug('Metrics sent successfully');
      this.emitter?.emit(EVENTS.METRICS_SENT, payload);
    } catch (e) {
      this.logger?.error('Failed to send metrics', e);
      this.emitter?.emit(EVENTS.METRICS_ERROR, e);
    }
  }

  private createEmptyBucket(): Bucket {
    return {
      start: new Date(),
      stop: null,
      flags: {},
      missing: {},
    };
  }

  private assertBucket(flagName: string): void {
    if (!this.bucket.flags[flagName]) {
      this.bucket.flags[flagName] = {
        yes: 0,
        no: 0,
        variants: {},
      };
    }
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.sendMetrics();
    }, this.metricsInterval);
  }

  private bucketIsEmpty(payload: MetricsPayload): boolean {
    return (
      Object.keys(payload.bucket.flags).length === 0 &&
      Object.keys(payload.bucket.missing).length === 0
    );
  }

  private getPayload(): MetricsPayload {
    const bucket = { ...this.bucket, stop: new Date() };
    this.bucket = this.createEmptyBucket();

    return {
      bucket,
      appName: this.appName,
      instanceId: this.connectionId,
    };
  }

  private buildMetricsUrl(): string {
    // Metrics endpoint: {apiUrl}/client/features/{environment}/metrics
    return `${this.apiUrl}/client/features/${this.environment}/metrics`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Token': this.apiToken,
      'X-Application-Name': this.appName,
      'X-Connection-Id': this.connectionId,
      ...this.customHeaders,
    };
    return headers;
  }
}
